import os
import re
import json
import requests as req
from flask import Blueprint, request, jsonify

alternative_bp = Blueprint('alternative', __name__)

@alternative_bp.route('/alternative', methods=['POST'])
def alternative():
    """Generate alternative expressions for Japanese text using AI"""
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

        return jsonify({'alternatives': data['alternatives']}), 200

    except req.exceptions.Timeout:
        return jsonify({'error': 'Request timeout'}), 504
    except req.exceptions.RequestException as e:
        print(f'Alternative API error: {e}')
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        print(f'Alternative error: {e}')
        return jsonify({'error': str(e)}), 500
