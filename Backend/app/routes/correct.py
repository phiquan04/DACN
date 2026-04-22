import unicodedata
from difflib import ndiff
from flask import Blueprint, request, jsonify
from model import GEC

correct_bp = Blueprint('correct', __name__)

# Initialize GEC model
gec_model = GEC(pretrained_weights_path='data/model/model_checkpoint')

@correct_bp.route('/correct', methods=['POST'])
def correct():
    """Correct Japanese grammar errors using BERT-based GEC"""
    try:
        text = request.json.get('text', '')
        if not text:
            return jsonify({'error': 'Missing text parameter'}), 400
        
        # Normalize and clean text
        text = unicodedata.normalize('NFKC', text).replace(' ', '')
        
        # Correct text
        correct_text = gec_model.correct(text)
        
        # Get diff
        diffs = list(ndiff(text, correct_text))
        
        print(f'Correction: {text} -> {correct_text}')
        
        return jsonify({
            'correctedText': correct_text,
            'diffs': diffs,
            'original': text
        }), 200
        
    except Exception as e:
        print(f'Correction error: {e}')
        return jsonify({'error': str(e)}), 500
