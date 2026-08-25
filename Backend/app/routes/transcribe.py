import os
import tempfile
from typing import Optional

from fastapi import APIRouter, HTTPException, File, UploadFile, Form

from app.services import youtube_transcription as yt

router = APIRouter()


@router.post("/transcribe")
def transcribe(
    youtube_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    tmp_path = None
    tmp_dir = None

    try:
        if youtube_url and youtube_url.strip():
            print(f"Transcribing YouTube URL: {youtube_url}", flush=True)
            tmp_path = yt.download_youtube_audio(youtube_url.strip())
            tmp_dir = os.path.dirname(tmp_path)

        elif file:
            suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            contents = file.file.read()
            tmp.write(contents)
            tmp.close()
            tmp_path = tmp.name

        else:
            raise HTTPException(
                status_code=400,
                detail="Provide 'youtube_url' as form field or upload a file"
            )

        print(f"Audio file: {tmp_path}", flush=True)
        if not tmp_path or not os.path.exists(tmp_path):
            raise HTTPException(status_code=500, detail="Không thể tải audio từ YouTube")

        try:
            print("Starting transcription...", flush=True)
            segments = yt.transcribe_with_whisper(tmp_path)
            print(f"Transcribed {len(segments)} segments", flush=True)

            if not segments:
                raise HTTPException(status_code=422, detail="Không phát hiện được giọng nói trong video")

            print("Starting translation...", flush=True)
            translated = yt.translate_segments(segments)
            print(f"Translated {len(translated)} segments", flush=True)

            return {"segments": translated}
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                    print(f"Deleted temp file: {tmp_path}", flush=True)
                except Exception as e:
                    print(f"Failed to delete {tmp_path}: {e}", flush=True)
            if tmp_dir and os.path.isdir(tmp_dir):
                try:
                    os.rmdir(tmp_dir)
                    print(f"Deleted temp dir: {tmp_dir}", flush=True)
                except OSError as e:
                    print(f"Failed to delete {tmp_dir}: {e}", flush=True)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Transcribe error: {e}", flush=True)
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
        if tmp_dir and os.path.isdir(tmp_dir):
            try:
                os.rmdir(tmp_dir)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcribe/url")
def transcribe_url(youtube_url: str):
    """Transcribe từ YouTube URL - nhận plain string query param"""
    return transcribe(youtube_url=youtube_url, file=None)
