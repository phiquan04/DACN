import unicodedata
import json
import re
import os
import tempfile
import requests as req
from jamdict import Jamdict
from difflib import ndiff
from datetime import datetime, timedelta
from googletrans import Translator

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from model import GEC

load_dotenv()
translator = Translator()

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "expose_headers": ["Content-Type"],
    }
})

gec = GEC(pretrained_weights_path='data/model/model_checkpoint')


@app.before_request
def log_request():
    print(f"[{request.method}] {request.path} from {request.remote_addr}", flush=True)


@app.errorhandler(Exception)
def handle_exception(e):
    print(f"Unhandled exception: {e}", flush=True)
    return jsonify({"error": str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "service": "Japanese VA Backend",
        "youtube_api": "configured" if os.environ.get('YOUTUBE_API_KEY') else "NOT CONFIGURED",
        "openai_api": "configured" if os.environ.get('OPENAI_API_KEY') else "NOT CONFIGURED",
        "openrouter_api": "configured" if os.environ.get('OPENROUTER_API_KEY') else "NOT CONFIGURED",
    }), 200


@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')


@app.route('/correct', methods=['POST'])
def correct():
    text = unicodedata.normalize('NFKC', request.json['text']).replace(' ', '')
    correct_text = gec.correct(text)
    diffs = list(ndiff(text, correct_text))
    print(f'Correction: {text} -> {correct_text}')
    return jsonify({
        'correctedText': correct_text,
        'diffs': diffs
    })


@app.route('/alternative', methods=['POST'])
def alternative():
    try:
        api_key = os.environ.get('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({'error': 'OPENROUTER_API_KEY not set'}), 500

        text = request.json.get('text', '')
        if not text:
            return jsonify({'error': 'Missing text'}), 400

        prompt = f"""以下の日本語の文を、意味を変えずに3つの異なる表現で言い換えてください。
            元の文: 「{text}」

            以下のJSON形式のみで返答してください（説明不要、マークダウン不要）:
            {{"alternatives": ["言い換え1", "言い換え2", "言い換え3"]}}"""

        response = req.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'google/gemma-3-4b-it:free',
                'messages': [{'role': 'user', 'content': prompt}],
                'temperature': 0.7,
            },
            timeout=30
        )
        response.raise_for_status()

        raw = response.json()['choices'][0]['message']['content'].strip()
        clean = re.sub(r'```json|```', '', raw).strip()
        data = json.loads(clean)

        return jsonify({'alternatives': data['alternatives']})

    except Exception as e:
        print(f'Alternative error: {e}')
        return jsonify({'error': str(e)}), 500

def translate_to_vietnamese(text: str) -> str:
    """Dịch văn bản tiếng Anh sang tiếng Việt, nếu lỗi thì trả về nguyên bản."""
    if not text or not isinstance(text, str):
        return ""
    try:
        result = translator.translate(text, src='en', dest='vi')
        return result.text
    except Exception as e:
        print(f"Translation error: {e}", flush=True)
        return text
# Khởi tạo Jamdict một lần khi app start (thêm sau dòng: gec = GEC(...))
try:
    jmdict = Jamdict()
    print("JMdict loaded successfully", flush=True)
except Exception as e:
    print(f"Warning: JMdict failed to load: {e}", flush=True)
    jmdict = None


@app.route('/api/dictionary/lookup', methods=['POST'])
def dictionary_lookup():
    """
    Tra từ điển Nhật - Việt (JMdict) qua Jamdict, trả về:
    - word: dạng kanji
    - reading: cách đọc
    - definitions: list {meaning (tiếng Việt), pos (từ loại)}
    - examples: list {japanese (câu Nhật), meaning (bản dịch tiếng Việt)}
    - jlpt, frequency
    """
    try:
        word = request.json.get('word', '').strip()
        if not word:
            return jsonify({'error': 'Missing word parameter'}), 400

        if not jmdict:
            return jsonify({'error': 'Dictionary service not available'}), 503

        print(f"[Jamdict] Lookup: '{word}'", flush=True)
        result = jmdict.lookup(word)

        if not result.entries:
            return jsonify({
                'word': word,
                'reading': '',
                'definitions': [],
                'examples': [],
                'jlpt': 'N/A',
                'frequency': 'N/A'
            }), 200

        entry = result.entries[0]

        # --- 1. Lấy dạng viết (kanji hoặc kana) ---
        kanji = word
        if entry.kanji_forms:
            kanji = entry.kanji_forms[0].text
        elif entry.kana_forms:
            kanji = entry.kana_forms[0].text

        # --- 2. Lấy cách đọc ---
        reading = ''
        if entry.kana_forms:
            reading = entry.kana_forms[0].text

        # --- 3. Lấy definitions (nghĩa) và dịch sang tiếng Việt ---
        definitions = []
        if entry.senses:
            for sense in entry.senses[:5]:  # giới hạn 5 nghĩa
                # Lấy các gloss tiếng Anh
                english_glosses = []
                if hasattr(sense, 'gloss') and sense.gloss:
                    english_glosses = [g.text for g in sense.gloss if g.text]
                if not english_glosses:
                    continue

                english_text = ', '.join(english_glosses)
                vietnamese_text = translate_to_vietnamese(english_text)

                # Lấy từ loại
                pos = ''
                if hasattr(sense, 'pos') and sense.pos:
                    pos = ', '.join(sense.pos)

                definitions.append({
                    'meaning': vietnamese_text,
                    'pos': pos
                })

        # --- 4. Lấy examples (câu ví dụ) từ sense ---
        examples = []
        if entry.senses:
            for sense in entry.senses:
                # Kiểm tra xem sense có examples không
                if hasattr(sense, 'examples') and sense.examples:
                    for ex in sense.examples[:3]:  # giới hạn 3 ví dụ mỗi sense
                        jp_text = ''
                        vi_text = ''
                        # ex thường là object có .japanese và .english
                        if hasattr(ex, 'japanese') and ex.japanese:
                            jp_text = ex.japanese
                        if hasattr(ex, 'english') and ex.english:
                            # Dịch câu tiếng Anh sang tiếng Việt
                            vi_text = translate_to_vietnamese(ex.english)
                        if jp_text:
                            examples.append({
                                'japanese': jp_text,
                                'vietnamese': vi_text
                            })
                # Một số version Jamdict để examples trong `sentence_examples`
                elif hasattr(sense, 'sentence_examples') and sense.sentence_examples:
                    for ex in sense.sentence_examples[:3]:
                        jp_text = ex.japanese if hasattr(ex, 'japanese') else ''
                        en_text = ex.english if hasattr(ex, 'english') else ''
                        vi_text = translate_to_vietnamese(en_text) if en_text else ''
                        if jp_text:
                            examples.append({
                                'japanese': jp_text,
                                'vietnamese': vi_text
                            })

        # Nếu không có examples trong senses, thử lấy từ entry.examples
        if not examples and hasattr(entry, 'examples') and entry.examples:
            for ex in entry.examples[:5]:
                jp_text = ex.japanese if hasattr(ex, 'japanese') else ''
                en_text = ex.english if hasattr(ex, 'english') else ''
                vi_text = translate_to_vietnamese(en_text) if en_text else ''
                if jp_text:
                    examples.append({
                        'japanese': jp_text,
                        'vietnamese': vi_text
                    })

        # --- 5. Lấy JLPT và frequency (nếu có) ---
        jlpt = 'N/A'
        frequency = 'N/A'
        if hasattr(entry, 'jlpt_old') and entry.jlpt_old:
            jlpt = str(entry.jlpt_old)
        elif hasattr(entry, 'jlpt') and entry.jlpt:
            jlpt = str(entry.jlpt)
        if hasattr(entry, 'frequency') and entry.frequency:
            frequency = str(entry.frequency)

        print(f"[Jamdict] Found '{kanji}' ({reading}) - {len(definitions)} definitions, {len(examples)} examples", flush=True)

        return jsonify({
            'word': kanji,
            'reading': reading,
            'definitions': definitions,
            'examples': examples,
            'jlpt': jlpt,
            'frequency': frequency
        }), 200

    except Exception as e:
        print(f'Dictionary lookup error: {e}', flush=True)
        return jsonify({'error': str(e)}), 500

def _parse_iso8601_duration(duration: str) -> str:
    """Convert ISO 8601 duration (PT1H2M3S) to MM:SS or HH:MM:SS."""
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
    if not match:
        return ""
    h = int(match.group(1) or 0)
    m = int(match.group(2) or 0)
    s = int(match.group(3) or 0)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


@app.route('/api/youtube-search', methods=['GET'])
def youtube_search():
    try:
        api_key = os.environ.get('YOUTUBE_API_KEY')
        if not api_key:
            return jsonify({'error': 'YouTube API not configured'}), 500

        q = request.args.get('q', '日本語').strip() or '日本語'
        lang = request.args.get('lang', 'ja')
        max_results = min(int(request.args.get('maxResults', 12)), 50)

        # Step 1: Search videos
        print(f"YouTube search: q={q}, maxResults={max_results}", flush=True)
        search_res = req.get(
            'https://www.googleapis.com/youtube/v3/search',
            params={
                'part': 'snippet',
                'q': q,
                'type': 'video',
                'relevanceLanguage': lang,
                'videoCaption': 'any',
                'maxResults': max_results,
                'key': api_key,
            },
            timeout=15
        )
        search_res.raise_for_status()
        search_data = search_res.json()

        items = search_data.get('items', [])
        if not items:
            print("No items found", flush=True)
            return jsonify({'videos': []})

        video_ids = [item['id']['videoId'] for item in items]
        print(f"Found {len(video_ids)} videos", flush=True)

        # Step 2: Get video details (duration, etc.)
        details_res = req.get(
            'https://www.googleapis.com/youtube/v3/videos',
            params={
                'part': 'contentDetails,snippet',
                'id': ','.join(video_ids),
                'key': api_key,
            },
            timeout=15
        )
        details_res.raise_for_status()
        details_data = details_res.json()

        details_map = {
            v['id']: v for v in details_data.get('items', [])
        }

        videos = []
        for item in items:
            vid_id = item['id']['videoId']
            snippet = item['snippet']
            detail = details_map.get(vid_id, {})
            content_details = detail.get('contentDetails', {})

            duration_raw = content_details.get('duration', '')
            duration_fmt = _parse_iso8601_duration(duration_raw)

            # Use maxresdefault thumbnail, fallback to high
            thumb = (
                snippet.get('thumbnails', {}).get('high', {}).get('url')
                or snippet.get('thumbnails', {}).get('medium', {}).get('url')
                or f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"
            )

            videos.append({
                'id': vid_id,
                'title': snippet.get('title', ''),
                'channelTitle': snippet.get('channelTitle', ''),
                'thumbnail': thumb,
                'duration': duration_fmt,
                'publishedAt': snippet.get('publishedAt', ''),
            })

        print(f"Returning {len(videos)} videos", flush=True)
        return jsonify({'videos': videos})

    except req.exceptions.Timeout:
        return jsonify({'error': 'YouTube API timeout'}), 504
    except req.exceptions.RequestException as e:
        print(f'YouTube API error: {e}', flush=True)
        return jsonify({'error': 'YouTube API error'}), 503
    except Exception as e:
        print(f'YouTube search error: {e}', flush=True)
        return jsonify({'error': str(e)}), 500



def download_youtube_audio(youtube_url: str) -> str:
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

        # Find the downloaded file
        files = os.listdir(tmp_dir)
        print(f"Files in temp dir: {files}", flush=True)
        
        for fname in files:
            if fname.startswith(video_id):
                full_path = os.path.join(tmp_dir, fname)
                print(f"Found audio file: {full_path}", flush=True)
                return full_path

        raise FileNotFoundError(f"Audio file not found in {tmp_dir} (expected prefix: {video_id})")
    except Exception as e:
        # Clean up temp dir on error
        try:
            if os.path.isdir(tmp_dir):
                for f in os.listdir(tmp_dir):
                    os.unlink(os.path.join(tmp_dir, f))
                os.rmdir(tmp_dir)
        except:
            pass
        print(f"Download error: {e}", flush=True)
        raise ValueError(f"Failed to download YouTube audio: {str(e)}")


def transcribe_with_whisper(audio_path: str) -> list[dict]:
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
            # faster-whisper returns a generator — must consume fully
            segments = [
                {"start": s.start, "end": s.end, "text": s.text.strip()}
                for s in segs
                if s.text.strip()
            ]
            print(f"faster-whisper transcribed {len(segments)} segments (duration: {info.duration:.1f}s)", flush=True)
            return segments
        except ImportError:
            print("faster-whisper not installed, trying openai-whisper...", flush=True)

        # --- Option 2: openai-whisper (may break with numpy 2.x) ---
        try:
            import whisper
            print("Loading local Whisper model...", flush=True)
            model = whisper.load_model("base", device="cpu")
            # Pass path directly — whisper handles chunking internally for long audio
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

        # --- Option 3: OpenAI Whisper API ---
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            raise ValueError("No transcription backend available: install faster-whisper, openai-whisper, or set OPENAI_API_KEY")
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


def translate_segments(segments: list[dict]) -> list[dict]:
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


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
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
            # Cleanup
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
        # Ensure cleanup even on error
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




SYSTEM_PROMPT = """あなたは日本語の会話パートナーです。
以下のルールを守ってください：
- 常に日本語（JLPT N3レベル）で返答してください
- 絵文字は使わないでください
- 普通体（だ・である調）か、ややカジュアルな話し言葉で話してください
- 返答は2〜4文程度にしてください
- ユーザーの話題に合わせて自然に会話を続けてください"""


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        api_key = os.environ.get('OPENROUTER_API_KEY')

        user_message = request.json.get("message", "")
        if not user_message:
            return jsonify({"error": "Empty message"}), 400

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ]

        response = req.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-4o-mini",
                "messages": messages,
                "temperature": 0.7,
            }
        )

        print("STATUS:", response.status_code)
        response.raise_for_status()

        data = response.json()
        reply = data["choices"][0]["message"]["content"]

        return jsonify({"reply": reply})

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/tts", methods=["POST"])
def text_to_speech():
    try:
        data = request.get_json()
        text = data.get("text", "")
        if not text:
            return jsonify({"error": "Missing 'text' field"}), 400

        char_count = len(text)
        estimated_duration_ms = max(1000, int((char_count / 2) / 8 * 1000))
        keyframes = generate_lipsync_keyframes(text, estimated_duration_ms)

        return jsonify({
            "text": text,
            "duration_ms": estimated_duration_ms,
            "lipsync_keyframes": keyframes,
            "tts_method": "web_speech_api",
        })

    except Exception as e:
        print(f"TTS error: {e}")
        return jsonify({"error": str(e)}), 500


def generate_lipsync_keyframes(text: str, duration_ms: int) -> list:
    mora_count = max(4, len(text))
    interval = duration_ms / mora_count
    keyframes = []
    for i in range(mora_count):
        t = i * interval
        mouth_open = 0.7 if i % 2 == 0 else 0.3
        keyframes.append({"time_ms": int(t), "mouth_open": mouth_open})
    keyframes.append({"time_ms": duration_ms, "mouth_open": 0.0})
    return keyframes


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, threaded=False, use_reloader=False)