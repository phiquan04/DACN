"""Pronunciation scoring: Whisper transcription plus Praat-based pitch/
intensity comparison against a gTTS-generated reference recording.

Loads the faster-whisper model once at import time (module-level singleton —
importing this module twice in the same process reuses the same instance).
"""
import hashlib
import os
import tempfile

import numpy as np
import parselmouth
from parselmouth import Sound
from pydub import AudioSegment
from gtts import gTTS
from faster_whisper import WhisperModel

model_size = "base"
whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")


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
