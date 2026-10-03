"""YouTube/uploaded-video transcription: download audio, transcribe it
(faster-whisper, falling back to openai-whisper, falling back to the OpenAI
API — whichever backend is installed/configured), then translate the
Japanese segments to Vietnamese via OpenRouter.
"""
import json
import os
import re
import tempfile

from urllib.parse import urlparse

import requests as req

_YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}

# Whisper runs on CPU inside the request, so a long video ties up a worker
# for many minutes (and the frontend gives up waiting after 3). Overridable
# for deployments with more headroom.
MAX_VIDEO_DURATION_SECONDS = int(os.environ.get("MAX_TRANSCRIBE_DURATION_SECONDS", "1200"))


class TranscriptionRejected(ValueError):
    """The request itself is unacceptable (not a YouTube link, video too
    long, a live stream) — as opposed to a download/transcription failure.
    The message is Vietnamese and safe to show the user."""


def validate_youtube_url(youtube_url: str) -> None:
    """yt-dlp will happily fetch from thousands of sites and arbitrary direct
    URLs; this feature is YouTube-only, so anything else is refused before it
    ever reaches the downloader."""
    parsed = urlparse(youtube_url)
    if parsed.scheme not in ("http", "https") or (parsed.hostname or "").lower() not in _YOUTUBE_HOSTS:
        raise TranscriptionRejected("Chỉ hỗ trợ liên kết video YouTube.")


def download_youtube_audio(youtube_url: str) -> str:
    import yt_dlp

    validate_youtube_url(youtube_url)

    # Check the length before downloading anything.
    try:
        with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True, 'noplaylist': True, 'socket_timeout': 30}) as ydl:
            meta = ydl.extract_info(youtube_url, download=False)
    except Exception as e:
        print(f"Metadata error: {e}", flush=True)
        raise ValueError(f"Failed to read YouTube video info: {str(e)}")
    if meta.get('is_live'):
        raise TranscriptionRejected("Không hỗ trợ video đang phát trực tiếp.")
    duration = meta.get('duration')
    if duration and duration > MAX_VIDEO_DURATION_SECONDS:
        raise TranscriptionRejected(
            f"Video quá dài (tối đa {MAX_VIDEO_DURATION_SECONDS // 60} phút)."
        )

    tmp_dir = tempfile.mkdtemp()
    output_template = os.path.join(tmp_dir, '%(id)s.%(ext)s')

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_template,
        'quiet': False,
        'no_warnings': False,
        'socket_timeout': 30,
        'noplaylist': True,
        'extractor_args': {
            # 'android_vr' (yt-dlp's default pick) has been getting 403s from
            # YouTube; these clients are more reliable for audio-only formats.
            'youtube': {'player_client': ['android', 'web', 'tv']},
        },
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '128',
        }],
    }

    try:
        print(f"Downloading: {youtube_url}", flush=True)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            video_id = info.get('id', 'audio')
            print(f"Downloaded video_id: {video_id}", flush=True)

        files = os.listdir(tmp_dir)
        print(f"Files in temp dir: {files}", flush=True)

        for fname in files:
            if fname.startswith(video_id):
                full_path = os.path.join(tmp_dir, fname)
                print(f"Found audio file: {full_path}", flush=True)
                return full_path

        raise FileNotFoundError(f"Audio file not found in {tmp_dir}")
    except Exception as e:
        try:
            if os.path.isdir(tmp_dir):
                for f in os.listdir(tmp_dir):
                    os.unlink(os.path.join(tmp_dir, f))
                os.rmdir(tmp_dir)
        except Exception:
            pass
        print(f"Download error: {e}", flush=True)
        raise ValueError(f"Failed to download YouTube audio: {str(e)}")


def transcribe_with_whisper(audio_path: str) -> list:
    try:
        print(f"Transcribing audio: {audio_path}", flush=True)

        try:
            # Shared with pronunciation scoring — loaded once per process
            # rather than re-read from disk on every transcription request.
            from app.services.whisper_model import get_whisper_model
            model = get_whisper_model()
            segs, info = model.transcribe(
                audio_path,
                language="ja",
                word_timestamps=False,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 500},
                beam_size=1,
                condition_on_previous_text=True,
            )
            segments = [
                {"start": s.start, "end": s.end, "text": s.text.strip()}
                for s in segs
                if s.text.strip()
            ]
            print(f"faster-whisper transcribed {len(segments)} segments", flush=True)
            return segments
        except ImportError:
            print("faster-whisper not installed, trying openai-whisper...", flush=True)

        try:
            import whisper
            print("Loading local Whisper model...", flush=True)
            model = whisper.load_model("base", device="cpu")
            result = model.transcribe(
                audio_path,
                language="ja",
                word_timestamps=False,
                fp16=False,
                condition_on_previous_text=True,
                verbose=False,
            )
            segments = [
                {"start": s["start"], "end": s["end"], "text": s["text"].strip()}
                for s in result["segments"]
                if s["text"].strip()
            ]
            print(f"Local Whisper transcribed {len(segments)} segments", flush=True)
            return segments
        except ImportError:
            print("openai-whisper not available, trying OpenAI API...", flush=True)

        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            raise ValueError("No transcription backend available")

        with open(audio_path, "rb") as f:
            response = req.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files={"file": f},
                data={"model": "whisper-1", "language": "ja", "response_format": "verbose_json"},
                timeout=300
            )
        response.raise_for_status()
        data = response.json()
        segments = [
            {"start": s["start"], "end": s["end"], "text": s["text"].strip()}
            for s in data.get("segments", [])
        ]
        print(f"OpenAI Whisper API transcribed {len(segments)} segments", flush=True)
        return segments
    except Exception as e:
        print(f"Transcription error: {e}", flush=True)
        raise ValueError(f"Whisper transcription failed: {str(e)}")


def translate_segments(segments: list) -> list:
    """Translate segments from Japanese to Vietnamese"""
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not set")

    if not segments:
        return []

    texts = [s["text"] for s in segments]
    batch = "\n".join([f"{i+1}. {t}" for i, t in enumerate(texts)])

    prompt = f"""Dịch các câu tiếng Nhật sau sang tiếng Việt. Giữ nguyên số thứ tự. Chỉ trả về JSON, không giải thích.

Các câu tiếng Nhật:
{batch}

Trả về đúng định dạng JSON:
{{"translations": ["dịch câu 1", "dịch câu 2", ...]}}"""

    try:
        response = req.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            },
            timeout=120
        )
        response.raise_for_status()

        raw = response.json()["choices"][0]["message"]["content"].strip()
        clean = re.sub(r"```json|```", "", raw).strip()
        data = json.loads(clean)
        translations = data.get("translations", [])

        result = []
        for i, seg in enumerate(segments):
            result.append({
                "start": seg["start"],
                "end": seg["end"],
                "japanese": seg["text"],
                "vietnamese": translations[i] if i < len(translations) else ""
            })
        return result
    except req.exceptions.Timeout:
        raise ValueError("API request timeout - video may be too long")
    except req.exceptions.RequestException as e:
        raise ValueError(f"Translation API error: {str(e)}")
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        raise ValueError(f"Invalid translation response format: {str(e)}")
