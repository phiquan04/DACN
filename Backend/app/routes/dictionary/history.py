"""Per-user search history: save/list/delete lookups, and the distinct-words
list used to seed pronunciation practice."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.database import get_db, SearchHistory
from app.schemas.dictionary import SaveHistoryRequest

router = APIRouter()


@router.post("/history/save")
def save_search_history(req: SaveHistoryRequest, db: Session = Depends(get_db)):
    existing = db.query(SearchHistory).filter(
        SearchHistory.user_id == req.user_id,
        SearchHistory.word == req.word
    ).first()
    if existing:
        # Chỉ ghi đè trường nào có dữ liệu mới — tránh 1 lần lưu thiếu
        # (vd chỉ có examples) xoá mất dữ liệu đã lưu trước đó (vd synonyms)
        if req.reading:
            existing.reading = req.reading
        if req.meaning:
            existing.meaning = req.meaning
        if req.definitions:
            existing.definitions = req.definitions
        if req.examples:
            existing.examples = req.examples
        if req.synonyms:
            existing.synonyms = req.synonyms
        if req.jlpt:
            existing.jlpt = req.jlpt
        if req.frequency:
            existing.frequency = req.frequency
        if req.kanji:
            existing.kanji = req.kanji
        existing.created_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        record = existing
    else:
        record = SearchHistory(
            user_id=req.user_id,
            word=req.word,
            reading=req.reading,
            meaning=req.meaning,
            definitions=req.definitions or [],
            examples=req.examples or [],
            synonyms=req.synonyms or [],
            jlpt=req.jlpt,
            frequency=req.frequency,
            kanji=req.kanji or [],
        )
        db.add(record)
        db.commit()
        db.refresh(record)
    return {"success": True, "id": record.id}


@router.get("/history/{user_id}")
def get_search_history(user_id: int, db: Session = Depends(get_db)):
    records = (
        db.query(SearchHistory)
        .filter(SearchHistory.user_id == user_id)
        .order_by(SearchHistory.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": r.id,
            "word": r.word,
            "reading": r.reading or "",
            "meaning": r.meaning or "",
            "definitions": r.definitions or [],
            "examples": r.examples or [],
            "synonyms": r.synonyms or [],
            "jlpt": r.jlpt or "",
            "frequency": r.frequency or "",
            "kanji": r.kanji or [],
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in records
    ]


@router.delete("/history/{user_id}/{history_id}")
def delete_history_item(user_id: int, history_id: int, db: Session = Depends(get_db)):
    record = db.query(SearchHistory).filter(
        SearchHistory.id == history_id,
        SearchHistory.user_id == user_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="History item not found")
    db.delete(record)
    db.commit()
    return {"success": True}


@router.delete("/history/{user_id}")
def clear_history(user_id: int, db: Session = Depends(get_db)):
    db.query(SearchHistory).filter(SearchHistory.user_id == user_id).delete()
    db.commit()
    return {"success": True}


@router.get("/history/words/{user_id}")
def get_history_words(user_id: int, db: Session = Depends(get_db)):
    """Lấy danh sách các từ đã tra cứu (word, reading, meaning) phục vụ luyện phát âm"""
    subq = db.query(
        SearchHistory.word,
        func.max(SearchHistory.created_at).label('latest')
    ).filter(SearchHistory.user_id == user_id).group_by(SearchHistory.word).subquery()

    records = db.query(SearchHistory).join(
        subq,
        (SearchHistory.word == subq.c.word) & (SearchHistory.created_at == subq.c.latest)
    ).order_by(SearchHistory.created_at.desc()).all()

    unique_words = {}
    for r in records:
        if r.word not in unique_words:
            unique_words[r.word] = {
                "word": r.word,
                "reading": r.reading or "",
                "meaning": r.meaning or ""
            }
    return list(unique_words.values())
