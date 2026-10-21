"""User-facing grammar library: browse published grammar sets and their
points, read-only. No SRS/progress tracking here (see
app/models/grammar_content.py's docstring — this is purely a reference
browser, unlike vocabulary's flashcard-based app/routes/vocabulary/learning.py).
Separate from review.py, which is the admin curation surface and exposes
drafts too.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.dependencies import UserResponse, get_current_user
from app.models.database import get_db
from app.models.grammar_content import GrammarSet
from app.schemas.jlpt import JlptLevel
from app.schemas.grammar_content import GrammarPointOut, GrammarSetDetailOut, GrammarSetSummary

router = APIRouter(prefix="/library", tags=["grammar-library"])


def _published_query(db: Session):
    return db.query(GrammarSet).filter(
        GrammarSet.status == 'published', GrammarSet.is_locked.is_(False),
    )


def _set_summary(grammar_set: GrammarSet) -> GrammarSetSummary:
    return GrammarSetSummary(
        id=grammar_set.id, level=grammar_set.level, set_name=grammar_set.set_name,
        description=grammar_set.description, status=grammar_set.status, is_locked=grammar_set.is_locked,
        curriculum_id=grammar_set.curriculum_id,
        curriculum_name=grammar_set.curriculum.name if grammar_set.curriculum else None,
        category_id=grammar_set.category_id,
        category_name=grammar_set.category.name if grammar_set.category else None,
        source_filename=grammar_set.source_filename, error_message=grammar_set.error_message,
        item_count=grammar_set.item_count,
        reviewed_count=sum(1 for i in grammar_set.points if i.is_reviewed),
        created_at=grammar_set.created_at, updated_at=grammar_set.updated_at,
    )


def _point_out(point) -> GrammarPointOut:
    return GrammarPointOut(
        id=point.id, order_no=point.order_no, pattern=point.pattern,
        meaning_vi=point.meaning_vi, usage_note=point.usage_note,
        examples=point.examples or [],
        admin_notes=point.admin_notes,
        is_meaning_ai_generated=point.is_meaning_ai_generated,
        is_example_ai_generated=point.is_example_ai_generated,
        is_reviewed=point.is_reviewed,
    )


@router.get("/sets", response_model=List[GrammarSetSummary])
def list_published_grammar_sets(
    level: Optional[JlptLevel] = None,
    curriculum_id: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _user: UserResponse = Depends(get_current_user),
):
    query = _published_query(db).options(
        selectinload(GrammarSet.points), selectinload(GrammarSet.curriculum), selectinload(GrammarSet.category),
    )
    if level:
        query = query.filter(GrammarSet.level == level)
    if curriculum_id:
        query = query.filter(GrammarSet.curriculum_id == curriculum_id)
    if category_id:
        query = query.filter(GrammarSet.category_id == category_id)
    sets = query.order_by(GrammarSet.level, GrammarSet.set_name).all()
    return [_set_summary(s) for s in sets]


@router.get("/sets/{set_id}", response_model=GrammarSetDetailOut)
def get_published_grammar_set(
    set_id: int, db: Session = Depends(get_db), _user: UserResponse = Depends(get_current_user),
):
    grammar_set = (
        _published_query(db)
        .options(selectinload(GrammarSet.points), selectinload(GrammarSet.curriculum), selectinload(GrammarSet.category))
        .filter(GrammarSet.id == set_id)
        .first()
    )
    if not grammar_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ ngữ pháp")

    points = sorted(grammar_set.points, key=lambda i: i.order_no)
    return GrammarSetDetailOut(**_set_summary(grammar_set).model_dump(), items=[_point_out(i) for i in points])
