import os
import re
import json
import tempfile
import requests as req
from flask import Blueprint, request, jsonify

transcribe_bp = Blueprint('transcribe', __name__)


def download_youtube_audio(youtube_url: str) -> str:
    """Download audio from YouTube video"""
    import yt_dlp

    tmp_dir = tempfile.mkdtemp()
    output_template = os.path.join(tmp_dir, '%(id)s.%(ext)s')

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_template,
        'quiet': False,
        'no_warnings': False,
        'socket_timeout': 30,
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
        except:
            pass
        print(f"Download error: {e}", flush=True)
        raise ValueError(f"Failed to download YouTube audio: {str(e)}")


def transcribe_with_whisper(audio_path: str) -> list:
    """Transcribe audio using Whisper"""
    try:
        print(f"Transcribing audio: {audio_path}", flush=True)
        
        try:
            from faster_whisper import WhisperModel
            print("Loading faster-whisper model...", flush=True)
            model = WhisperModel("base", device="cpu")

            segs, info = model.transcribe(
                audio_path,
                language="ja",
                word_timestamps=False,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 500},
                beam_size=5,
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


@transcribe_bp.route("/transcribe", methods=["POST"])
def transcribe():
    """Transcribe and translate YouTube videos or audio files"""
    tmp_path = None
    tmp_dir = None
    
    try:
        if request.is_json and request.json.get("youtube_url"):
            youtube_url = request.json["youtube_url"]
            print(f"Transcribing YouTube URL: {youtube_url}", flush=True)
            tmp_path = download_youtube_audio(youtube_url)
            tmp_dir = os.path.dirname(tmp_path)

        elif "file" in request.files:
            file = request.files["file"]
            suffix = os.path.splitext(file.filename)[1] or ".mp4"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            file.save(tmp.name)
            tmp.close()
            tmp_path = tmp.name

        else:
            return jsonify({"error": "Provide 'youtube_url' in JSON body or upload a file"}), 400

        print(f"Audio file: {tmp_path}", flush=True)
        if not tmp_path or not os.path.exists(tmp_path):
            return jsonify({"error": "Không thể tải audio từ YouTube"}), 500

        try:
            print("Starting transcription...", flush=True)
            segments = transcribe_with_whisper(tmp_path)
            print(f"Transcribed {len(segments)} segments", flush=True)
            
            if not segments:
                return jsonify({"error": "Không phát hiện được giọng nói trong video"}), 422

            print("Starting translation...", flush=True)
            translated = translate_segments(segments)
            print(f"Translated {len(translated)} segments", flush=True)
            
            return jsonify({"segments": translated}), 200
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

    except Exception as e:
        print(f"Transcribe error: {e}", flush=True)
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass
        if tmp_dir and os.path.isdir(tmp_dir):
            try:
                os.rmdir(tmp_dir)
            except:
                pass
        return jsonify({"error": str(e)}), 500
