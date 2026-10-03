"""Kanji handwriting recognition: draw a character you can't type/read, get
back candidate matches to feed into the normal /lookup endpoint."""
from fastapi import APIRouter, Depends

from app.schemas.dictionary import HandwritingRecognitionRequest, HandwritingRecognitionResponse
from app.services import dictionary_handwriting
from app.utils.rate_limit import rate_limit

router = APIRouter()


@router.post(
    "/handwriting/recognize",
    response_model=HandwritingRecognitionResponse,
    dependencies=[Depends(rate_limit("handwriting", limit=120, window_seconds=60))],
)
async def recognize_handwriting(req: HandwritingRecognitionRequest):
    candidates = await dictionary_handwriting.recognize_kanji(req.strokes)
    return {"candidates": candidates}
