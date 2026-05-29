import os
import io
import tempfile
import hashlib
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydub import AudioSegment
import parselmouth
from parselmouth import Sound
from gtts import gTTS
from faster_whisper import WhisperModel
from difflib import SequenceMatcher

router = APIRouter(prefix="/pronunciation", tags=["pronunciation"])

# ---------- Khởi tạo model Whisper (dùng chung) ----------
model_size = "base"
whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")

# ---------- Helper functions ----------
def normalize_audio_volume(audio_path: str) -> str:
    """Chuẩn hóa âm lượng để tránh méo và tăng độ nhạy cho Whisper"""
    try:
        audio = AudioSegment.from_file(audio_path)
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        rms = np.sqrt(np.mean(samples ** 2))
        target_amplitude = 32768 * 0.1  # -20dBFS
        if rms > 0:
            gain_db = 20 * np.log10(target_amplitude / rms)
            gain_db = np.clip(gain_db, -12, 12)
            audio = audio.apply_gain(gain_db)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            normalized_path = tmp.name
            audio.export(normalized_path, format="wav")
        return normalized_path
    except Exception as e:
        print(f"[Normalize] Error: {e}", flush=True)
        return audio_path

def transcribe_with_whisper(audio_path: str) -> list:
    """Trả về list các dict {text, start, end}"""
    segments, _ = whisper_model.transcribe(
        audio_path,
        language="ja",
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,
            speech_pad_ms=300,
        ),
        initial_prompt="以下は日本語の発音練習です",
    )
    result = []
    for seg in segments:
        result.append({
            "text": seg.text.strip(),
            "start": seg.start,
            "end": seg.end,
        })
    return result

def load_sound_for_praat(audio_path: str) -> Sound:
    """Đọc file âm thanh bằng parselmouth (hỗ trợ wav/mp3)"""
    return parselmouth.Sound(audio_path)

def extract_pitch_intensity(audio_path: str):
    sound = load_sound_for_praat(audio_path)
    # Pitch
    pitch = sound.to_pitch()
    pitch_values = pitch.selected_array['frequency']
    pitch_values = pitch_values[pitch_values > 0]
    mean_pitch = np.mean(pitch_values) if len(pitch_values) > 0 else 0
    std_pitch = np.std(pitch_values) if len(pitch_values) > 0 else 0
    # Intensity
    intensity = sound.to_intensity()
    intensity_values = intensity.values.T.flatten()
    intensity_values = intensity_values[~np.isnan(intensity_values)]
    mean_intensity = np.mean(intensity_values) if len(intensity_values) > 0 else 0
    std_intensity = np.std(intensity_values) if len(intensity_values) > 0 else 0
    return {
        'mean_pitch': mean_pitch,
        'std_pitch': std_pitch,
        'mean_intensity': mean_intensity,
        'std_intensity': std_intensity
    }

def compare_and_score(user_features: dict, ref_features: dict):
    pitch_diff = abs(user_features['mean_pitch'] - ref_features['mean_pitch'])
    pitch_max_diff = 180 
    pitch_score = max(0, 100 - (pitch_diff / pitch_max_diff) * 100)
    intensity_diff = abs(user_features['mean_intensity'] - ref_features['mean_intensity'])
    intensity_max_diff = 30  
    intensity_score = max(0, 100 - (intensity_diff / intensity_max_diff) * 100)
    overall = (pitch_score + intensity_score) / 2
    return {
        'overall': int(overall),
        'accent': int(pitch_score),
        'intonation': int(intensity_score),
    }

def get_cached_reference_path(text: str) -> str:
    hash_obj = hashlib.md5(text.encode('utf-8'))
    filename = f"ref_{hash_obj.hexdigest()}.mp3"
    cache_dir = os.path.join(tempfile.gettempdir(), "pronunciation_refs")
    os.makedirs(cache_dir, exist_ok=True)
    return os.path.join(cache_dir, filename)

def generate_reference_audio(text: str, output_path: str):
    tts = gTTS(text=text, lang='ja', slow=False)
    tts.save(output_path)
    print(f"Generated reference audio: {output_path}")

# ---------- Endpoint đánh giá phát âm ----------
@router.post("/assess")
async def pronunciation_assess(
    audio: UploadFile = File(...),
    expected_text: str = Form(...)
):
    user_audio_path = None
    normalized_path = None
    try:
        # Lưu file upload
        suffix = os.path.splitext(audio.filename or "recording.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await audio.read()
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
        normalized_path = normalize_audio_volume(user_audio_path)
        segments = transcribe_with_whisper(normalized_path)
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
        ref_audio_path = get_cached_reference_path(expected_text)
        if not os.path.exists(ref_audio_path):
            generate_reference_audio(expected_text, ref_audio_path)
        
        user_features = extract_pitch_intensity(normalized_path)
        ref_features = extract_pitch_intensity(ref_audio_path)
        praat_score = compare_and_score(user_features, ref_features)
        
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
                except:
                    pass

@router.post("/tts")
async def text_to_speech(text: str = Form(...)):
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