import unicodedata
from difflib import ndiff
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.models import GrammarCorrection
from app.models.database import get_db
from model import GEC

router = APIRouter()

class CorrectRequest(BaseModel):
    text: str
    message_id: Optional[int] = None

gec_model = GEC(pretrained_weights_path='data/model/model_checkpoint')

@router.post('/correct')
async def correct(request: CorrectRequest, db: Session = Depends(get_db)):
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

        # Prepare error info and count
        errors = diffs
        error_count = sum(1 for d in diffs if d.startswith('- ') or d.startswith('+ '))

        # Save grammar correction to database
        try:
            correction = GrammarCorrection(
                message_id=request.message_id,
                original_text=text,
                corrected_text=correct_text,
                errors=errors,
                confidence=None,
                error_count=error_count
            )
            db.add(correction)
            db.commit()
            db.refresh(correction)
        except Exception as e:
            # Log but don't fail the whole request for DB save issues
            print(f'Failed to save GrammarCorrection: {e}')

        return {
            'correctedText': correct_text,
            'diffs': diffs,
            'original': text,
            'saved_correction_id': getattr(correction, 'id', None)
        }
        
    except Exception as e:
        print(f'Correction error: {e}')
        raise HTTPException(status_code=500, detail=str(e))