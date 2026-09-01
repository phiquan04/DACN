"""Kanji handwriting recognition: draw a character you can't type/read, get
back candidate matches to feed into the normal /lookup endpoint."""
from fastapi import APIRouter

from app.schemas.dictionary import HandwritingRecognitionRequest, HandwritingRecognitionResponse
from app.services import dictionary_handwriting

router = APIRouter()


@router.post("/handwriting/recognize", response_model=HandwritingRecognitionResponse)
async def recognize_handwriting(req: HandwritingRecognitionRequest):
    candidates = await dictionary_handwriting.recognize_kanji(req.strokes)
    return {"candidates": candidates}
