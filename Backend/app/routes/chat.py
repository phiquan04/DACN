import os
import requests as req
from flask import Blueprint, request, jsonify

chat_bp = Blueprint('chat', __name__)

SYSTEM_PROMPT = """あなたは日本語の会話パートナーです。
以下のルールを守ってください：
- 常に日本語（JLPT N3レベル）で返答してください
- 絵文字は使わないでください
- 普通体（だ・である調）か、ややカジュアルな話し言葉で話してください
- 返答は2〜4文程度にしてください
- ユーザーの話題に合わせて自然に会話を続けてください"""

@chat_bp.route('/chat', methods=['POST'])
def chat():
    """Chat endpoint using OpenRouter AI"""
    try:
        api_key = os.environ.get('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({'error': 'OPENROUTER_API_KEY not configured'}), 500

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
            },
            timeout=30
        )

        response.raise_for_status()
        data = response.json()
        reply = data["choices"][0]["message"]["content"]

        return jsonify({"reply": reply}), 200

    except req.exceptions.Timeout:
        return jsonify({"error": "Request timeout"}), 504
    except req.exceptions.RequestException as e:
        print(f"Chat API error: {e}")
        return jsonify({"error": "API error"}), 503
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({"error": str(e)}), 500
