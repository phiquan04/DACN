"""The one faster-whisper model shared by every feature that transcribes
audio (pronunciation scoring, video transcripts).

Loaded lazily on first use and then kept for the life of the process, so the
weights are read from disk once instead of once per feature — or, as the
video transcript route used to do, once per request. CTranslate2 models are
safe to call from several threads at once, so no per-call locking is needed;
the lock below only guards the first load.
"""
import threading

from faster_whisper import WhisperModel

MODEL_SIZE = "base"

_model = None
_load_lock = threading.Lock()


def get_whisper_model() -> WhisperModel:
    global _model
    if _model is None:
        with _load_lock:
            if _model is None:
                _model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    return _model
