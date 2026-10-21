"""Admin review of an imported (draft) grammar set: inspect/edit grammar
points, fill in AI-generated fields the admin wants to correct, then publish
so the set becomes visible to users (see imports.py for how a draft gets
created). Mirrors app/routes/vocabulary/review.py exactly.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.dependencies import require_admin, UserResponse
from app.models.database import get_db
from app.models.grammar_content import GrammarCategory, GrammarCurriculum, GrammarPoint, GrammarSet
from app.models.grammar_exercise import GrammarExercise
from app.schemas.jlpt import JlptLevel
from app.schemas.grammar_content import (
    GrammarPointCreate, GrammarPointOut, GrammarPointPatch,
    GrammarSetPatch, GrammarSetReviewOut, GrammarSetSummary,
)
from app.services.grammar_exercise_ai import generate_exercises_for_points

router = APIRouter(prefix="/sets", tags=["grammar-sets"])


def _point_out(point: GrammarPoint) -> GrammarPointOut:
    return GrammarPointOut(
        id=point.id, order_no=point.order_no, pattern=point.pattern,
        meaning_vi=point.meaning_vi, usage_note=point.usage_note,
        examples=point.examples or [],
        admin_notes=point.admin_notes,
        is_meaning_ai_generated=point.is_meaning_ai_generated,
        is_example_ai_generated=point.is_example_ai_generated,
        is_reviewed=point.is_reviewed,
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


@router.get("", response_model=List[GrammarSetSummary])
def list_grammar_sets(
    level: Optional[JlptLevel] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    curriculum_id: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    query = db.query(GrammarSet).options(
        selectinload(GrammarSet.points), selectinload(GrammarSet.curriculum), selectinload(GrammarSet.category),
    )
    if level:
        query = query.filter(GrammarSet.level == level)
    if status_filter:
        query = query.filter(GrammarSet.status == status_filter)
    if curriculum_id:
        query = query.filter(GrammarSet.curriculum_id == curriculum_id)
    if category_id:
        query = query.filter(GrammarSet.category_id == category_id)
    sets = query.order_by(GrammarSet.created_at.desc()).all()
    return [_set_summary(s) for s in sets]


@router.get("/{set_id}", response_model=GrammarSetReviewOut)
def get_set_for_review(
    set_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    grammar_set = (
        db.query(GrammarSet)
        .options(selectinload(GrammarSet.points), selectinload(GrammarSet.curriculum), selectinload(GrammarSet.category))
        .filter(GrammarSet.id == set_id)
        .first()
    )
    if not grammar_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ ngữ pháp")

    points = sorted(grammar_set.points, key=lambda i: i.order_no)
    ready = len(points) > 0 and all(i.is_reviewed for i in points)

    return GrammarSetReviewOut(
        **_set_summary(grammar_set).model_dump(),
        items=[_point_out(i) for i in points],
        ready_to_publish=ready,
    )


@router.patch("/{set_id}", response_model=GrammarSetSummary)
def update_set_metadata(
    set_id: int, payload: GrammarSetPatch,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    grammar_set = db.query(GrammarSet).filter(GrammarSet.id == set_id).first()
    if not grammar_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ ngữ pháp")

    fields = payload.model_dump(exclude_unset=True)
    if 'curriculum_id' in fields and fields['curriculum_id'] is not None:
        if not db.query(GrammarCurriculum).filter(GrammarCurriculum.id == fields['curriculum_id']).first():
            raise HTTPException(status_code=400, detail="Bộ giáo trình không tồn tại")
    if 'category_id' in fields and fields['category_id'] is not None:
        if not db.query(GrammarCategory).filter(GrammarCategory.id == fields['category_id']).first():
            raise HTTPException(status_code=400, detail="Danh mục không tồn tại")

    for key in ('set_name', 'description', 'curriculum_id', 'category_id', 'is_locked'):
        if key in fields:
            setattr(grammar_set, key, fields[key])

    db.commit()
    db.refresh(grammar_set)
    return _set_summary(grammar_set)


@router.patch("/{set_id}/items/{item_id}", response_model=GrammarPointOut)
def update_item(
    set_id: int, item_id: int, payload: GrammarPointPatch,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    point = db.query(GrammarPoint).filter(GrammarPoint.id == item_id, GrammarPoint.set_id == set_id).first()
    if not point:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu ngữ pháp")

    fields = payload.model_dump(exclude_unset=True)
    for key in ('pattern', 'meaning_vi', 'usage_note', 'examples', 'admin_notes'):
        if key in fields:
            setattr(point, key, fields[key])

    if 'is_reviewed' in fields:
        point.is_reviewed = fields['is_reviewed']
    elif fields:
        point.is_reviewed = True  # any other edit implies the admin looked at this grammar point

    db.commit()
    db.refresh(point)
    return _point_out(point)


@router.post("/{set_id}/items", response_model=GrammarPointOut)
def create_item(
    set_id: int, payload: GrammarPointCreate,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    grammar_set = db.query(GrammarSet).filter(GrammarSet.id == set_id).first()
    if not grammar_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ ngữ pháp")

    # max(order_no)+1 rather than count() — count() collides with an existing
    # order_no once a prior delete has left a gap in the sequence.
    max_order = db.query(func.max(GrammarPoint.order_no)).filter(GrammarPoint.set_id == set_id).scalar()
    next_order = 0 if max_order is None else max_order + 1
    point = GrammarPoint(
        set_id=set_id, order_no=next_order,
        pattern=payload.pattern, meaning_vi=payload.meaning_vi, usage_note=payload.usage_note,
        examples=[e.model_dump() for e in payload.examples],
        admin_notes=payload.admin_notes,
        is_meaning_ai_generated=False, is_example_ai_generated=False, is_reviewed=True,
    )
    db.add(point)
    grammar_set.item_count += 1
    db.commit()
    db.refresh(point)
    return _point_out(point)


@router.delete("/{set_id}/items/{item_id}")
def delete_item(
    set_id: int, item_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    point = db.query(GrammarPoint).filter(GrammarPoint.id == item_id, GrammarPoint.set_id == set_id).first()
    if not point:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu ngữ pháp")

    grammar_set = db.query(GrammarSet).filter(GrammarSet.id == set_id).first()
    db.delete(point)
    if grammar_set:
        grammar_set.item_count = max(0, grammar_set.item_count - 1)
    db.commit()
    return {"success": True}


@router.post("/{set_id}/items/mark-all-reviewed", response_model=GrammarSetSummary)
def mark_all_items_reviewed(
    set_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    """Bulk-approve every not-yet-reviewed grammar point in one request — a
    set can have dozens of points, and clicking 'Lưu mẫu này' on each one
    individually before publish is impractical. A point the admin still
    wants to fix can be edited normally afterwards (editing re-saves it,
    which is a no-op on the is_reviewed flag since it's already true)."""
    grammar_set = db.query(GrammarSet).filter(GrammarSet.id == set_id).first()
    if not grammar_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ ngữ pháp")

    db.query(GrammarPoint).filter(
        GrammarPoint.set_id == set_id, GrammarPoint.is_reviewed.is_(False),
    ).update({GrammarPoint.is_reviewed: True}, synchronize_session=False)
    db.commit()
    db.refresh(grammar_set)
    return _set_summary(grammar_set)


@router.post("/{set_id}/publish", response_model=GrammarSetSummary)
def publish_set(
    set_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    grammar_set = (
        db.query(GrammarSet)
        .options(selectinload(GrammarSet.points))
        .filter(GrammarSet.id == set_id)
        .first()
    )
    if not grammar_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ ngữ pháp")
    if grammar_set.status == 'published':
        raise HTTPException(status_code=400, detail="Bộ ngữ pháp đã được publish rồi")
    if not grammar_set.points:
        raise HTTPException(status_code=409, detail="Bộ ngữ pháp chưa có mẫu câu nào")

    not_reviewed = [i.pattern for i in grammar_set.points if not i.is_reviewed]
    if not_reviewed:
        raise HTTPException(
            status_code=409,
            detail=f"Còn {len(not_reviewed)} mẫu chưa được xác nhận: {', '.join(not_reviewed[:10])}",
        )

    grammar_set.status = 'published'
    grammar_set.published_at = datetime.utcnow()
    db.commit()
    db.refresh(grammar_set)

    # Best-effort: generate practice exercises (cloze + mcq) for every point
    # in this set that doesn't have any yet. Idempotent (only targets points
    # with zero GrammarExercise rows), so calling publish again — or a future
    # re-publish flow — never double-generates. Deliberately never allowed to
    # fail the publish itself: this is a nice-to-have AI enrichment step, not
    # the core action, same philosophy as send_welcome_email at signup and
    # the reminder-email scheduler (both fire-and-tolerate). A point whose
    # generation failed simply has no exercises yet; it can be backfilled by
    # publishing again once that's supported, or by a future admin "generate"
    # action — not built here since it's outside this feature's scope.
    try:
        points_without_exercises = [p for p in grammar_set.points if not _has_exercises(db, p.id)]
        if points_without_exercises:
            exercises_by_point = generate_exercises_for_points(points_without_exercises)
            for point_id, exercise_dicts in exercises_by_point.items():
                for data in exercise_dicts:
                    db.add(GrammarExercise(
                        grammar_point_id=point_id, type=data['type'],
                        prompt=data['prompt'], correct_answer=data['correct_answer'], choices=data['choices'],
                    ))
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"⚠️  Không thể tạo bài tập ngữ pháp tự động cho set {set_id}: {e}", flush=True)

    return _set_summary(grammar_set)


def _has_exercises(db: Session, grammar_point_id: int) -> bool:
    return db.query(GrammarExercise.id).filter(GrammarExercise.grammar_point_id == grammar_point_id).first() is not None


@router.delete("/{set_id}")
def delete_set(
    set_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    grammar_set = db.query(GrammarSet).filter(GrammarSet.id == set_id).first()
    if not grammar_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ ngữ pháp")
    try:
        db.delete(grammar_set)
        db.commit()
    except IntegrityError:
        # Mirrors vocabulary's delete_set: if something else ends up
        # referencing a grammar point (none does today, this is purely a
        # content-management mirror with no learner-progress tables), lock
        # instead of losing the delete attempt.
        db.rollback()
        grammar_set = db.query(GrammarSet).filter(GrammarSet.id == set_id).first()
        grammar_set.is_locked = True
        db.commit()
        raise HTTPException(
            status_code=409,
            detail="Không thể xóa bộ ngữ pháp này. Bộ ngữ pháp đã được tự động khóa và chuyển vào mục \"Đã khóa\".",
        )
    return {"success": True}
