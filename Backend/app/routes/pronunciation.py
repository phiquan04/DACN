import io
import os
import tempfile
from difflib import SequenceMatcher

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from gtts import gTTS

from app.services import pronunciation_analysis as pa

router = APIRouter(prefix="/pronunciation", tags=["pronunciation"])


@router.post("/assess")
def pronunciation_assess(
    audio: UploadFile = File(...),
    expected_text: str = Form(...)
):
    user_audio_path = None
    normalized_path = None
    try:
        # Lưu file upload
        suffix = os.path.splitext(audio.filename or "recording.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = audio.file.read()
            tmp.write(content)
            user_audio_path = tmp.name

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

        # So sánh văn bản
        similarity = SequenceMatcher(None, recognized_text, expected_text).ratio()
        text_match_score = int(similarity * 100)
        WRONG_WORD_THRESHOLD = 60

        if text_match_score < WRONG_WORD_THRESHOLD:
            tip = (f"❌ Bạn đã phát âm sai từ! Hệ thống nhận ra: \"{recognized_text}\", "
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

        user_features = pa.extract_pitch_intensity(normalized_path)
        ref_features = pa.extract_pitch_intensity(ref_audio_path)
        praat_score = pa.compare_and_score(user_features, ref_features)

        # Tính điểm tốc độ
        total_duration = segments[-1]['end'] - segments[0]['start'] if segments else 1
        mora_count = len(recognized_text.replace(' ', ''))
        mora_per_sec = mora_count / total_duration if total_duration > 0 else 0
        speed_score = max(0, min(100, int(100 - abs(mora_per_sec - 7.5) * 10)))

        # Điều chỉnh trọng số: 30% praat, 70% text match
        overall = int(praat_score['overall'] * 0.3 + text_match_score * 0.7)
        accent = praat_score['accent']
        intonation = praat_score['intonation']

        # Gợi ý
        if overall >= 85:
            tip = "Phát âm rất tốt, hãy duy trì!"
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


@router.post("/tts")
def text_to_speech(text: str = Form(...)):
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
