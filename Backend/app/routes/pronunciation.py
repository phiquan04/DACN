import io
import os
import tempfile

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from gtts import gTTS

from app.services import pronunciation_analysis as pa
from app.utils.rate_limit import rate_limit
from app.utils.uploads import copy_upload_limited

router = APIRouter(prefix="/pronunciation", tags=["pronunciation"])

# A practice recording is one word or one sentence — a few hundred KB of
# webm/opus. Both endpoints work without signing in, so they are capped and
# throttled per caller instead.
MAX_RECORDING_BYTES = 10 * 1024 * 1024
MAX_EXPECTED_TEXT_LENGTH = 300
MAX_TTS_TEXT_LENGTH = 2000  # the grammar page reads a whole corrected passage aloud (see schemas/grammar.py)


@router.post("/assess", dependencies=[Depends(rate_limit("pronunciation", limit=20, window_seconds=60))])
def pronunciation_assess(
    audio: UploadFile = File(...),
    expected_text: str = Form(..., max_length=MAX_EXPECTED_TEXT_LENGTH)
):
    user_audio_path = None
    normalized_path = None
    try:
        # Lưu file upload
        suffix = os.path.splitext(audio.filename or "recording.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            user_audio_path = tmp.name
            copy_upload_limited(audio, tmp, MAX_RECORDING_BYTES)

        file_size = os.path.getsize(user_audio_path)
        if file_size < 5000:
            return JSONResponse(status_code=400, content={
                "error": "File ghi âm quá nhỏ.",
                "recognized_text": "",
                "overall": 0, "accent": 0, "intonation": 0, "speed": 0,
                "tip": "Không nhận được đủ dữ liệu âm thanh. Vui lòng thử lại.",
                "wrong_word": False
            })

        # Chuẩn hóa âm lượng trước khi Whisper
        normalized_path = pa.normalize_audio_volume(user_audio_path)
        segments = pa.transcribe_with_whisper(normalized_path)
        recognized_text = " ".join([seg['text'] for seg in segments]).strip()

        # So sánh theo cách đọc (katakana), không theo mặt chữ: Whisper có thể
        # viết "猫" trong khi từ cần đọc là "ねこ" — cùng một âm, không phải sai từ.
        text_match_score = pa.text_match_score(recognized_text, expected_text)
        WRONG_WORD_THRESHOLD = 60

        if text_match_score < WRONG_WORD_THRESHOLD:
            tip = (f"Bạn đã phát âm sai từ. Hệ thống nhận ra: \"{recognized_text}\", "
                   f"nhưng từ cần đọc là: \"{expected_text}\". Hãy nghe lại mẫu và thử lại.")
            if not recognized_text:
                tip = "Không nhận diện được giọng nói. Hãy kiểm tra microphone, nói to và rõ hơn."
            return JSONResponse(content={
                "recognized_text": recognized_text,
                "overall": 0, "accent": 0, "intonation": 0, "speed": 0,
                "tip": tip, "wrong_word": True
            })

        # Lấy file tham khảo
        ref_audio_path = pa.get_cached_reference_path(expected_text)
        if not os.path.exists(ref_audio_path):
            pa.generate_reference_audio(expected_text, ref_audio_path)

        mora_count = pa.count_morae(pa.to_pronunciation(expected_text))

        pitch_score = pa.compare_pitch(
            pa.extract_pitch_contour(normalized_path),
            pa.extract_pitch_contour(ref_audio_path),
            mora_count,
        )

        # Tính điểm tốc độ: thời lượng lấy từ đoạn có tiếng thật sự; mốc thời
        # gian của Whisper đã cộng thêm phần đệm im lặng ở hai đầu nên chỉ
        # dùng khi không đo được.
        total_duration = pa.voiced_span_seconds(normalized_path)
        if total_duration is None:
            total_duration = segments[-1]['end'] - segments[0]['start'] if segments else 0
        speed_score = pa.speed_score(mora_count, total_duration)

        if pitch_score is None:
            # Không đủ âm hữu thanh để so cao độ (ghi âm quá ngắn/quá nhiễu):
            # chấm theo độ chính xác của từ, không bịa ra điểm ngữ điệu.
            overall = accent = intonation = text_match_score
        else:
            accent = pitch_score['accent']
            intonation = pitch_score['intonation']
            # 70% đúng từ, 30% cao độ (chia đều cho trọng âm và ngữ điệu)
            overall = int(text_match_score * 0.7 + accent * 0.15 + intonation * 0.15)

        # Gợi ý
        if pitch_score is None:
            tip = "Đã nhận đúng từ, nhưng bản ghi quá ngắn hoặc nhiễu nên chưa chấm được ngữ điệu. Hãy thử ghi âm lại."
        elif overall >= 85:
            tip = "Phát âm rất tốt, hãy duy trì!"
        elif text_match_score >= 85 and min(accent, intonation) < 60:
            tip = "Bạn đọc đúng từ, nhưng lên xuống giọng còn khác bản mẫu. Hãy nghe lại mẫu và chú ý chỗ lên/xuống giọng."
        elif overall >= 70:
            tip = "Phát âm khá ổn, cần chú ý một số âm."
        elif overall >= 50:
            tip = "Phát âm chưa rõ ràng, hãy nghe lại mẫu và luyện thêm."
        else:
            tip = "Hãy thử nói chậm và rõ hơn, chú ý từng âm tiết."

        return JSONResponse(content={
            "recognized_text": recognized_text,
            "overall": overall,
            "accent": accent,
            "intonation": intonation,
            "speed": speed_score,
            "tip": tip,
            "wrong_word": False,
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Assess] Error: {e}", flush=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for path in [user_audio_path, normalized_path]:
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except Exception:
                    pass


@router.post("/tts", dependencies=[Depends(rate_limit("tts", limit=60, window_seconds=60))])
def text_to_speech(text: str = Form(..., max_length=MAX_TTS_TEXT_LENGTH)):
    """
    Chuyển văn bản tiếng Nhật thành giọng nói bằng gTTS,
    trả về audio/mpeg dạng stream.
    """
    try:
        tts = gTTS(text=text, lang='ja', slow=False)
        audio_bytes = io.BytesIO()
        tts.write_to_fp(audio_bytes)
        audio_bytes.seek(0)
        return StreamingResponse(
            audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=tts.mp3"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
