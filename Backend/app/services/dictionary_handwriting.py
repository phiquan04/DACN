"""Kanji handwriting recognition: turns drawn strokes into candidate characters.

No local model is trained or shipped for this — strokes are forwarded to
Google's public (undocumented but widely used) handwriting-recognition
endpoint and the returned candidates are passed straight through. This
module owns no state beyond the HTTP call itself; matching those candidates
against JMdict/KANJIDIC2 is still done by dictionary_jmdict, same as a
normal typed-text lookup.
"""
import httpx

_RECOGNITION_URL = "https://inputtools.google.com/request"
_TIMEOUT = 10.0


async def recognize_kanji(strokes: list[list[list[float]]]) -> list[str]:
    """strokes: one list of [x, y] points per stroke, in drawing order."""
    strokes = [s for s in strokes if len(s) >= 2]
    if not strokes:
        return []

    ink = [[[p[0] for p in stroke], [p[1] for p in stroke]] for stroke in strokes]

    payload = {
        "app_version": 0.4,
        "api_level": "537.36",
        "device": "Chrome/JA",
        "input_type": 0,
        "options": "enable_pre_space",
        "requests": [
            {
                "writing_guide": {"writing_area_width": 800, "writing_area_height": 800},
                "pre_context": "",
                "max_num_results": 10,
                "max_completions": 0,
                "language": "ja",
                "ink": ink,
            }
        ],
    }
    params = {"itc": "ja-t-i0-handwrit", "app": "manabi-ai", "cs": "1", "oe": "UTF-8"}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            res = await client.post(_RECOGNITION_URL, params=params, json=payload)
        data = res.json()
    except Exception as e:
        print(f"[Handwriting] Recognition request failed: {e}", flush=True)
        return []

    if not isinstance(data, list) or len(data) < 2 or data[0] != "SUCCESS":
        return []

    try:
        return list(data[1][0][1])
    except (IndexError, KeyError, TypeError):
        return []
