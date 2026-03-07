
import unicodedata
from difflib import ndiff

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

from model import GEC

app = Flask(__name__)
CORS(app)

gec = GEC(pretrained_weights_path='data/model/model_checkpoint')


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


if __name__ == '__main__':
    # This is used when running locally only. When deploying to Google App
    # Engine, a webserver process such as Gunicorn will serve the app. This
    # can be configured by adding an `entrypoint` to app.yaml.
    app.run(host='127.0.0.1', port=8080, threaded=False, use_reloader=False)
# [END gae_python3_app]
# [END gae_python38_app]
