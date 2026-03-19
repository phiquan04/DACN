import unicodedata
import json
import re
import os
import requests as req
from difflib import ndiff

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from model import GEC

load_dotenv()

app = Flask(__name__)
CORS(app)

gec = GEC(pretrained_weights_path='data/model/model_checkpoint')


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


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "Japanese VA Backend"})
 
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
                "model": "openai/gpt-4o-mini",  # 🔥 đổi model
                "messages": messages,
                "temperature": 0.7,
            }
        )

        print("STATUS:", response.status_code)
        print("RESPONSE:", response.text)

        response.raise_for_status()

        data = response.json()
        reply = data["choices"][0]["message"]["content"]

        return jsonify({"reply": reply})

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"error": str(e)}), 500
    
 
@app.route("/api/tts", methods=["POST"])
def text_to_speech():
    """
    Convert Japanese text to speech using Web Speech API (client-side).
    This endpoint returns phoneme timing hints for lip-sync.
    For production, integrate VoiceVox, COEIROINK, or Google Cloud TTS here.
    """
    try:
        data = request.get_json()
        text = data.get("text", "")
        if not text:
            return jsonify({"error": "Missing 'text' field"}), 400
 
        # Estimate speech duration: Japanese ~8 mora/sec, ~2 chars/mora
        char_count = len(text)
        estimated_duration_ms = max(1000, int((char_count / 2) / 8 * 1000))
 
        # Generate simple lip-sync keyframes based on text length
        keyframes = generate_lipsync_keyframes(text, estimated_duration_ms)
 
        return jsonify({
            "text": text,
            "duration_ms": estimated_duration_ms,
            "lipsync_keyframes": keyframes,
            "tts_method": "web_speech_api",  # Client uses browser TTS
        })
 
    except Exception as e:
        logger.error(f"TTS error: {e}")
        return jsonify({"error": str(e)}), 500
 
 
def generate_lipsync_keyframes(text: str, duration_ms: int) -> list:
    """
    Generate simple open/close mouth keyframes.
    For each 'mora' (syllable unit in Japanese), toggle mouth open/close.
    """
    # Rough mora count: each hiragana/katakana = 1 mora, kanji ~2 mora avg
    mora_count = max(4, len(text))
    interval = duration_ms / mora_count
 
    keyframes = []
    for i in range(mora_count):
        t = i * interval
        # Alternate open (0.7) / half-open (0.3) for natural look
        mouth_open = 0.7 if i % 2 == 0 else 0.3
        keyframes.append({"time_ms": int(t), "mouth_open": mouth_open})
 
    # Ensure mouth closes at end
    keyframes.append({"time_ms": duration_ms, "mouth_open": 0.0})
    return keyframes

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, threaded=False, use_reloader=False)