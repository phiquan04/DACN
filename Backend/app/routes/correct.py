import unicodedata
from difflib import ndiff
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from model import GEC

router = APIRouter()

class CorrectRequest(BaseModel):
    text: str

gec_model = GEC(pretrained_weights_path='data/model/model_checkpoint')

@router.post('/correct')
async def correct(request: CorrectRequest):
    try:
        text = request.text
        if not text:
            raise HTTPException(status_code=400, detail='Missing text parameter')
        
        # Normalize and clean text
        text = unicodedata.normalize('NFKC', text).replace(' ', '')
        
        # Correct text
        correct_text = gec_model.correct(text)
        
        # Get diff
        diffs = list(ndiff(text, correct_text))
        
        print(f'Correction: {text} -> {correct_text}')
        
        return {
            'correctedText': correct_text,
            'diffs': diffs,
            'original': text
        }
        
    except Exception as e:
        print(f'Correction error: {e}')
        raise HTTPException(status_code=500, detail=str(e))
