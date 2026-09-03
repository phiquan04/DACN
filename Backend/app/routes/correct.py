from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import UserResponse, get_current_user, get_optional_user_id
from app.models import GrammarCorrection
from app.models.database import get_db
from app.schemas.grammar import (
    CorrectRequest,
    CorrectResponse,
    ErrorTypeStat,
    GrammarErrorStats,
    GrammarHistoryDetail,
    GrammarHistoryItem,
    GrammarHistoryPage,
)
from app.services.grammar_service import grade_text

router = APIRouter()

HISTORY_PAGE_SIZE = 10


@router.post('/correct', response_model=CorrectResponse)
def correct(
    request: CorrectRequest,
    user_id: Optional[int] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    try:
        text = request.text
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail='Missing text parameter')

        graded = grade_text(text)
        text = graded["original_text"]
        correct_text = graded["corrected_text"]
        diffs = graded["diffs"]
        error_count = graded["error_count"]
        explanation = graded["explanation"]

        print(f'Correction: {text} -> {correct_text}')

        # Save to history — only when a signed-in user made the request.
        history_id = None
        if user_id is not None:
            try:
                record = GrammarCorrection(
                    user_id=user_id,
                    original_text=text,
                    corrected_text=correct_text,
                    errors=diffs,
                    explanation=explanation,
                    confidence=None,
                    error_count=error_count,
                )
                db.add(record)
                db.commit()
                db.refresh(record)
                history_id = record.id
            except Exception as e:
                # Log but don't fail the whole request for DB save issues
                print(f'Failed to save GrammarCorrection: {e}')
                db.rollback()

        return CorrectResponse(
            correctedText=correct_text,
            diffs=diffs,
            original=text,
            explanation=explanation,
            history_id=history_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f'Correction error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/correct/history', response_model=GrammarHistoryPage)
def get_history(
    page: int = 1,
    status: str = 'all',
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    page = max(1, page)
    # Exclude corrections generated from chatbot messages (message_id set) —
    # those belong to the chatbot's own conversation history, not this page.
    base_query = db.query(GrammarCorrection).filter(
        GrammarCorrection.user_id == current_user.id,
        GrammarCorrection.message_id.is_(None),
    )

    total_all = base_query.count()
    total_changed = base_query.filter(GrammarCorrection.original_text != GrammarCorrection.corrected_text).count()

    if status == 'changed':
        query = base_query.filter(GrammarCorrection.original_text != GrammarCorrection.corrected_text)
        total = total_changed
    elif status == 'unchanged':
        query = base_query.filter(GrammarCorrection.original_text == GrammarCorrection.corrected_text)
        total = total_all - total_changed
    else:
        query = base_query
        total = total_all

    records = (
        query.order_by(GrammarCorrection.created_at.desc())
        .offset((page - 1) * HISTORY_PAGE_SIZE)
        .limit(HISTORY_PAGE_SIZE)
        .all()
    )
    return GrammarHistoryPage(
        items=[
            GrammarHistoryItem(
                id=r.id,
                original_text=r.original_text,
                corrected_text=r.corrected_text,
                first_error=(r.explanation or [None])[0],
                created_at=r.created_at.isoformat() + 'Z' if r.created_at else '',
            )
            for r in records
        ],
        total=total,
        page=page,
        page_size=HISTORY_PAGE_SIZE,
        total_all=total_all,
        total_changed=total_changed,
    )


@router.get('/correct/stats', response_model=GrammarErrorStats)
def get_error_stats(
    limit: int = 3,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Most frequent grammar error types across the user's checked sentences,
    computed from the per-error `explanation` saved with each correction."""
    records = db.query(GrammarCorrection.explanation).filter(
        GrammarCorrection.user_id == current_user.id,
        GrammarCorrection.message_id.is_(None),
        GrammarCorrection.explanation.isnot(None),
    ).all()

    counts: dict[str, int] = {}
    for (explanation,) in records:
        for err in explanation or []:
            error_type = err.get('error_type') if isinstance(err, dict) else None
            if error_type:
                counts[error_type] = counts.get(error_type, 0) + 1

    total = sum(counts.values())
    top = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return GrammarErrorStats(
        stats=[
            ErrorTypeStat(
                error_type=error_type,
                count=count,
                percentage=round(count / total * 100, 1) if total else 0.0,
            )
            for error_type, count in top
        ]
    )


@router.get('/correct/history/{history_id}', response_model=GrammarHistoryDetail)
def get_history_detail(
    history_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(GrammarCorrection).filter(
        GrammarCorrection.id == history_id,
        GrammarCorrection.user_id == current_user.id,
        GrammarCorrection.message_id.is_(None),
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail='History item not found')
    return GrammarHistoryDetail(
        id=record.id,
        original_text=record.original_text,
        corrected_text=record.corrected_text,
        diffs=record.errors or [],
        explanation=record.explanation or [],
        alternatives=record.alternatives,
        created_at=record.created_at.isoformat() + 'Z' if record.created_at else '',
    )


@router.delete('/correct/history/{history_id}')
def delete_history_item(
    history_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(GrammarCorrection).filter(
        GrammarCorrection.id == history_id,
        GrammarCorrection.user_id == current_user.id,
        GrammarCorrection.message_id.is_(None),
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail='History item not found')
    db.delete(record)
    db.commit()
    return {"success": True}
