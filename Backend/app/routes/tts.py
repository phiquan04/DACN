from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class TTSRequest(BaseModel):
    text: str

def generate_lipsync_keyframes(text: str, duration_ms: int) -> list:
    """Generate lipsync keyframes for avatar animation"""
    mora_count = max(4, len(text))
    interval = duration_ms / mora_count
    keyframes = []
    for i in range(mora_count):
        t = i * interval
        mouth_open = 0.7 if i % 2 == 0 else 0.3
        keyframes.append({"time_ms": int(t), "mouth_open": mouth_open})
    keyframes.append({"time_ms": duration_ms, "mouth_open": 0.0})
    return keyframes


@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    """Generate TTS audio and lipsync keyframes"""
    try:
        text = request.text
        if not text:
            raise HTTPException(status_code=400, detail="Missing 'text' field")

        # Estimate duration based on text length
        char_count = len(text)
        estimated_duration_ms = max(1000, int((char_count / 2) / 8 * 1000))
        
        # Generate lipsync keyframes
        keyframes = generate_lipsync_keyframes(text, estimated_duration_ms)

        return {
            "text": text,
            "duration_ms": estimated_duration_ms,
            "lipsync_keyframes": keyframes,
            "tts_method": "web_speech_api",
        }

    except Exception as e:
        print(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
