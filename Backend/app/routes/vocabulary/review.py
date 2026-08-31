"""Admin review of an imported (draft) vocabulary set: inspect/edit words,
fill in AI-generated fields the admin wants to correct, then publish so the
set becomes visible to users (see imports.py for how a draft gets created).
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.dependencies import require_admin, UserResponse
from app.models.database import get_db
from app.models.vocabulary import VocabularyCategory, VocabularyCurriculum, VocabularyItem, VocabularySet
from app.schemas.jlpt import JlptLevel
from app.schemas.vocabulary import (
    VocabularyItemCreate, VocabularyItemOut, VocabularyItemPatch,
    VocabularySetPatch, VocabularySetReviewOut, VocabularySetSummary,
)

router = APIRouter(prefix="/sets", tags=["vocabulary-sets"])


def _item_out(item: VocabularyItem) -> VocabularyItemOut:
    return VocabularyItemOut(
        id=item.id, order_no=item.order_no, word=item.word, reading=item.reading, han_viet=item.han_viet,
        meaning_vi=item.meaning_vi, word_type=item.word_type,
        example_sentence_ja=item.example_sentence_ja, example_sentence_vi=item.example_sentence_vi,
        admin_notes=item.admin_notes,
        is_meaning_ai_generated=item.is_meaning_ai_generated,
        is_example_ai_generated=item.is_example_ai_generated,
        is_reviewed=item.is_reviewed,
    )


def _set_summary(vocab_set: VocabularySet) -> VocabularySetSummary:
    return VocabularySetSummary(
        id=vocab_set.id, level=vocab_set.level, set_name=vocab_set.set_name,
        description=vocab_set.description, status=vocab_set.status, is_locked=vocab_set.is_locked,
        curriculum_id=vocab_set.curriculum_id,
        curriculum_name=vocab_set.curriculum.name if vocab_set.curriculum else None,
        category_id=vocab_set.category_id,
        category_name=vocab_set.category.name if vocab_set.category else None,
        source_filename=vocab_set.source_filename, error_message=vocab_set.error_message,
        item_count=vocab_set.item_count,
        reviewed_count=sum(1 for i in vocab_set.items if i.is_reviewed),
        created_at=vocab_set.created_at, updated_at=vocab_set.updated_at,
    )


@router.get("", response_model=List[VocabularySetSummary])
def list_vocabulary_sets(
    level: Optional[JlptLevel] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    curriculum_id: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    query = db.query(VocabularySet).options(
        selectinload(VocabularySet.items), selectinload(VocabularySet.curriculum), selectinload(VocabularySet.category),
    )
    if level:
        query = query.filter(VocabularySet.level == level)
    if status_filter:
        query = query.filter(VocabularySet.status == status_filter)
    if curriculum_id:
        query = query.filter(VocabularySet.curriculum_id == curriculum_id)
    if category_id:
        query = query.filter(VocabularySet.category_id == category_id)
    sets = query.order_by(VocabularySet.created_at.desc()).all()
    return [_set_summary(s) for s in sets]


@router.get("/{set_id}", response_model=VocabularySetReviewOut)
def get_set_for_review(
    set_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    vocab_set = (
        db.query(VocabularySet)
        .options(selectinload(VocabularySet.items), selectinload(VocabularySet.curriculum), selectinload(VocabularySet.category))
        .filter(VocabularySet.id == set_id)
        .first()
    )
    if not vocab_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ từ vựng")

    items = sorted(vocab_set.items, key=lambda i: i.order_no)
    ready = len(items) > 0 and all(i.is_reviewed for i in items)

    return VocabularySetReviewOut(
        **_set_summary(vocab_set).model_dump(),
        items=[_item_out(i) for i in items],
        ready_to_publish=ready,
    )


@router.patch("/{set_id}", response_model=VocabularySetSummary)
def update_set_metadata(
    set_id: int, payload: VocabularySetPatch,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    vocab_set = db.query(VocabularySet).filter(VocabularySet.id == set_id).first()
    if not vocab_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ từ vựng")

    fields = payload.model_dump(exclude_unset=True)
    if 'curriculum_id' in fields and fields['curriculum_id'] is not None:
        if not db.query(VocabularyCurriculum).filter(VocabularyCurriculum.id == fields['curriculum_id']).first():
            raise HTTPException(status_code=400, detail="Bộ giáo trình không tồn tại")
    if 'category_id' in fields and fields['category_id'] is not None:
        if not db.query(VocabularyCategory).filter(VocabularyCategory.id == fields['category_id']).first():
            raise HTTPException(status_code=400, detail="Danh mục không tồn tại")

    for key in ('set_name', 'description', 'curriculum_id', 'category_id', 'is_locked'):
        if key in fields:
            setattr(vocab_set, key, fields[key])

    db.commit()
    db.refresh(vocab_set)
    return _set_summary(vocab_set)


@router.patch("/{set_id}/items/{item_id}", response_model=VocabularyItemOut)
def update_item(
    set_id: int, item_id: int, payload: VocabularyItemPatch,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    item = db.query(VocabularyItem).filter(VocabularyItem.id == item_id, VocabularyItem.set_id == set_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")

    fields = payload.model_dump(exclude_unset=True)
    for key in ('word', 'reading', 'han_viet', 'meaning_vi', 'word_type', 'example_sentence_ja', 'example_sentence_vi', 'admin_notes'):
        if key in fields:
            setattr(item, key, fields[key])

    if 'is_reviewed' in fields:
        item.is_reviewed = fields['is_reviewed']
    elif fields:
        item.is_reviewed = True  # any other edit implies the admin looked at this word

    db.commit()
    db.refresh(item)
    return _item_out(item)


@router.post("/{set_id}/items", response_model=VocabularyItemOut)
def create_item(
    set_id: int, payload: VocabularyItemCreate,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    vocab_set = db.query(VocabularySet).filter(VocabularySet.id == set_id).first()
    if not vocab_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ từ vựng")

    # max(order_no)+1 rather than count() — count() collides with an existing
    # order_no once a prior delete has left a gap in the sequence.
    max_order = db.query(func.max(VocabularyItem.order_no)).filter(VocabularyItem.set_id == set_id).scalar()
    next_order = 0 if max_order is None else max_order + 1
    item = VocabularyItem(
        set_id=set_id, order_no=next_order,
        word=payload.word, reading=payload.reading, han_viet=payload.han_viet, meaning_vi=payload.meaning_vi,
        word_type=payload.word_type,
        example_sentence_ja=payload.example_sentence_ja, example_sentence_vi=payload.example_sentence_vi,
        admin_notes=payload.admin_notes,
        is_meaning_ai_generated=False, is_example_ai_generated=False, is_reviewed=True,
    )
    db.add(item)
    vocab_set.item_count += 1
    db.commit()
    db.refresh(item)
    return _item_out(item)


@router.delete("/{set_id}/items/{item_id}")
def delete_item(
    set_id: int, item_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    item = db.query(VocabularyItem).filter(VocabularyItem.id == item_id, VocabularyItem.set_id == set_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")

    vocab_set = db.query(VocabularySet).filter(VocabularySet.id == set_id).first()
    db.delete(item)
    if vocab_set:
        vocab_set.item_count = max(0, vocab_set.item_count - 1)
    db.commit()
    return {"success": True}


@router.post("/{set_id}/items/mark-all-reviewed", response_model=VocabularySetSummary)
def mark_all_items_reviewed(
    set_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    """Bulk-approve every not-yet-reviewed word in one request — a set can
    have hundreds of words, and clicking 'Lưu từ này' on each one individually
    before publish is impractical. A word the admin still wants to fix can be
    edited normally afterwards (editing re-saves it, which is a no-op on the
    is_reviewed flag since it's already true)."""
    vocab_set = db.query(VocabularySet).filter(VocabularySet.id == set_id).first()
    if not vocab_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ từ vựng")

    db.query(VocabularyItem).filter(
        VocabularyItem.set_id == set_id, VocabularyItem.is_reviewed.is_(False),
    ).update({VocabularyItem.is_reviewed: True}, synchronize_session=False)
    db.commit()
    db.refresh(vocab_set)
    return _set_summary(vocab_set)


@router.post("/{set_id}/publish", response_model=VocabularySetSummary)
def publish_set(
    set_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    vocab_set = (
        db.query(VocabularySet)
        .options(selectinload(VocabularySet.items))
        .filter(VocabularySet.id == set_id)
        .first()
    )
    if not vocab_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ từ vựng")
    if vocab_set.status == 'published':
        raise HTTPException(status_code=400, detail="Bộ từ vựng đã được publish rồi")
    if not vocab_set.items:
        raise HTTPException(status_code=409, detail="Bộ từ vựng chưa có từ nào")

    not_reviewed = [i.word for i in vocab_set.items if not i.is_reviewed]
    if not_reviewed:
        raise HTTPException(
            status_code=409,
            detail=f"Còn {len(not_reviewed)} từ chưa được xác nhận: {', '.join(not_reviewed[:10])}",
        )

    vocab_set.status = 'published'
    vocab_set.published_at = datetime.utcnow()
    db.commit()
    db.refresh(vocab_set)
    return _set_summary(vocab_set)


@router.delete("/{set_id}")
def delete_set(
    set_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    vocab_set = db.query(VocabularySet).filter(VocabularySet.id == set_id).first()
    if not vocab_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ từ vựng")
    try:
        db.delete(vocab_set)
        db.commit()
    except IntegrityError:
        # Học viên đã có tiến trình học (VocabularyItemProgress/VocabularyReviewLog)
        # trỏ tới các từ trong set này, nên xóa cứng sẽ vi phạm khóa ngoại — thay vì
        # chỉ báo lỗi, tự động khóa set lại để admin xử lý tiếp trong mục "Đã khóa"
        # thay vì mất trắng thao tác xóa.
        db.rollback()
        vocab_set = db.query(VocabularySet).filter(VocabularySet.id == set_id).first()
        vocab_set.is_locked = True
        db.commit()
        raise HTTPException(
            status_code=409,
            detail="Đã có học viên học bộ từ vựng này nên không thể xóa. Bộ từ vựng đã được tự động khóa và chuyển vào mục \"Đã khóa\".",
        )
    return {"success": True}
