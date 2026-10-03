"""Pronunciation scoring: Whisper transcription compared by reading, plus a
Praat pitch-contour comparison against a gTTS-generated reference recording.

Three independent measurements feed the score:

- what was said: the Whisper transcript and the expected text are both
  converted to their katakana pronunciation and compared there, so 猫 / ねこ /
  ネコ count as the same word;
- pitch: the F0 contour of the learner against the reference, each expressed
  in semitones around its own median — so a low voice and a high voice saying
  the same melody score the same — and aligned with DTW so speaking a little
  faster or slower is not punished as a pitch error;
- speed: morae per second.

The reference is machine speech (gTTS), not a recording of a native speaker.
Its pitch accent is usually right but not guaranteed, and the score
thresholds below are reasoned defaults that have not been calibrated against
human ratings — treat the pitch numbers as guidance, not as a grade.

The faster-whisper model is the process-wide one from
app.services.whisper_model, shared with the video transcript feature.
"""
import hashlib
import os
import tempfile
import threading
import unicodedata
from difflib import SequenceMatcher
from typing import Optional

import fugashi
import numpy as np
import parselmouth
from parselmouth import Sound
from pydub import AudioSegment
from gtts import gTTS

from app.services.whisper_model import get_whisper_model


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
    segments, _ = get_whisper_model().transcribe(
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


# ---------------------------------------------------------------- reading

_tagger = None
_tagger_lock = threading.Lock()

# Small kana that merge into the previous character's mora (キャ, ファ, ...).
# ッ (sokuon), ン and ー are each a mora of their own and are not listed.
_NON_MORA_KANA = set("ャュョァィゥェォヮ")


def _get_tagger():
    global _tagger
    if _tagger is None:
        with _tagger_lock:
            if _tagger is None:
                _tagger = fugashi.Tagger()
    return _tagger


def _to_katakana(text: str) -> str:
    return "".join(chr(ord(ch) + 0x60) if "ぁ" <= ch <= "ゖ" else ch for ch in text)


def to_pronunciation(text: str) -> str:
    """Katakana pronunciation of Japanese text with punctuation and spaces
    dropped, e.g. "学校に行きます。" -> "ガッコーニイキマス". Tokens the
    dictionary has no reading for fall back to their surface form."""
    text = unicodedata.normalize("NFKC", text or "")
    parts = []
    for word in _get_tagger()(text):
        feature = word.feature
        if getattr(feature, "pos1", "") in ("補助記号", "空白"):
            continue
        reading = getattr(feature, "pron", None) or getattr(feature, "kana", None)
        if not reading or reading == "*":
            reading = word.surface
        parts.append(_to_katakana(reading))
    return "".join(ch for ch in "".join(parts) if not ch.isspace())


def count_morae(pronunciation: str) -> int:
    return sum(1 for ch in pronunciation if ch not in _NON_MORA_KANA)


def text_match_score(recognized_text: str, expected_text: str) -> int:
    """0-100 similarity between what Whisper heard and what was expected,
    measured on pronunciation rather than spelling."""
    recognized = to_pronunciation(recognized_text)
    expected = to_pronunciation(expected_text)
    if not recognized or not expected:
        return 0
    return int(SequenceMatcher(None, recognized, expected).ratio() * 100)


def speed_score(mora_count: int, duration_seconds: float) -> int:
    """100 anywhere in a comfortable 4-9 morae/second band (careful learner
    speech up to brisk native speech), falling off outside it."""
    if duration_seconds <= 0 or mora_count <= 0:
        return 0
    rate = mora_count / duration_seconds
    if rate < 4:
        return max(0, int(100 - (4 - rate) * 25))
    if rate > 9:
        return max(0, int(100 - (rate - 9) * 15))
    return 100


# ------------------------------------------------------------------ pitch

_CONTOUR_POINTS = 60          # every contour is resampled to this many points
_MIN_VOICED_FRAMES = 8        # fewer than this and there is no contour to compare
_DTW_BAND = 12                # max time warp, in resampled points (20% of the contour)
_TOLERANCE_SEMITONES = 0.3    # mean deviation at or below this still scores 100
_MIN_SCALE_SEMITONES = 1.5    # floor for the "monotone" baseline (see compare_pitch)
_ACCENT_STEP_SEMITONES = 1.0  # smaller mora-to-mora changes count as "level"


def extract_pitch_contour(audio_path: str) -> Optional[np.ndarray]:
    """The recording's F0 over its voiced frames, in semitones relative to the
    speaker's own median and resampled to _CONTOUR_POINTS — i.e. the melody
    with the speaker's register and the utterance's length factored out.
    None when there isn't enough voiced audio to say anything."""
    sound = load_sound_for_praat(audio_path)
    f0 = sound.to_pitch(pitch_floor=75.0, pitch_ceiling=500.0).selected_array['frequency']
    f0 = f0[f0 > 0]
    if len(f0) < _MIN_VOICED_FRAMES:
        return None

    semitones = 12.0 * np.log2(f0 / np.median(f0))
    # Praat occasionally tracks an octave too high/low for a few frames;
    # a 5-frame median filter and a +-12 st clip keep those from dominating.
    padded = np.pad(semitones, 2, mode='edge')
    semitones = np.median(np.lib.stride_tricks.sliding_window_view(padded, 5), axis=1)
    semitones = np.clip(semitones, -12.0, 12.0)

    positions = np.linspace(0, len(semitones) - 1, _CONTOUR_POINTS)
    return np.interp(positions, np.arange(len(semitones)), semitones)


def voiced_span_seconds(audio_path: str) -> Optional[float]:
    """Time from the first to the last voiced frame — how long the speaker
    was actually talking, without leading/trailing silence. None if nothing
    voiced was found."""
    pitch = load_sound_for_praat(audio_path).to_pitch(pitch_floor=75.0, pitch_ceiling=500.0)
    times = pitch.xs()[pitch.selected_array['frequency'] > 0]
    if len(times) < _MIN_VOICED_FRAMES:
        return None
    return float(times[-1] - times[0])


def _dtw_mean_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Mean absolute difference (semitones) along the best alignment of two
    equal-length contours, allowing at most _DTW_BAND points of time warp."""
    n = len(a)
    cost = np.full((n + 1, n + 1), np.inf)
    steps = np.zeros((n + 1, n + 1), dtype=np.int32)
    cost[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(max(1, i - _DTW_BAND), min(n, i + _DTW_BAND) + 1):
            candidates = (cost[i - 1, j - 1], cost[i - 1, j], cost[i, j - 1])
            k = int(np.argmin(candidates))
            cost[i, j] = abs(a[i - 1] - b[j - 1]) + candidates[k]
            steps[i, j] = (steps[i - 1, j - 1], steps[i - 1, j], steps[i, j - 1])[k] + 1
    return float(cost[n, n] / max(1, steps[n, n]))


def _mora_steps(contour: np.ndarray, mora_count: int) -> np.ndarray:
    """Direction of the pitch movement from each mora to the next (+1 up,
    -1 down, 0 level), treating morae as equal-length slices of the contour —
    Japanese is mora-timed, so this is a fair approximation without a forced
    aligner. This is the high/low pattern that pitch accent is made of."""
    means = np.array([chunk.mean() for chunk in np.array_split(contour, mora_count)])
    diffs = np.diff(means)
    return np.where(diffs > _ACCENT_STEP_SEMITONES, 1, np.where(diffs < -_ACCENT_STEP_SEMITONES, -1, 0))


def compare_pitch(user: Optional[np.ndarray], reference: Optional[np.ndarray], mora_count: int) -> Optional[dict]:
    """{'intonation', 'accent'} as 0-100 scores, or None when either
    recording had too little voiced audio to compare.

    intonation: how closely the whole melody follows the reference.
    accent:     share of mora-to-mora rises/falls that go the same way as
                the reference (the pitch-accent pattern).
    """
    if user is None or reference is None:
        return None

    distance = _dtw_mean_distance(user, reference)
    # Scored against what a completely monotone delivery of this same
    # utterance would get (its distance is simply the reference's own mean
    # deviation from its median): matching the melody is 100, speaking it flat
    # is ~0. That keeps the scale meaningful for both lively sentences and
    # near-level words, with a floor so a level reference doesn't turn every
    # small wobble into a failing score.
    monotone_distance = max(float(np.mean(np.abs(reference))), _MIN_SCALE_SEMITONES)
    intonation = int(np.clip(100 * (1 - max(0.0, distance - _TOLERANCE_SEMITONES) / monotone_distance), 0, 100))

    # Slices need a few points each to average out jitter.
    slices = max(1, min(mora_count, _CONTOUR_POINTS // 4))
    if slices < 2:
        accent = intonation  # a single mora has no accent pattern of its own
    else:
        accent = int(100 * np.mean(_mora_steps(user, slices) == _mora_steps(reference, slices)))

    return {'intonation': intonation, 'accent': accent}


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
