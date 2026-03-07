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


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, threaded=False, use_reloader=False)