"""Admin CRUD for the two lookup tables vocabulary sets are tagged with:
curriculum (bộ giáo trình, e.g. 'Mimikara Oboeru N2') and category (danh mục
nội dung, e.g. 'Đời sống'). Both are reused across many sets, so they're
managed as their own small lists rather than free-typed on every import."""
import re
import unicodedata
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import require_admin, UserResponse
from app.models.database import get_db
from app.models.vocabulary import VocabularyCategory, VocabularyCurriculum, VocabularySet
from app.schemas.vocabulary import (
    CategoryIn, CategoryOut, CategoryPatch, CurriculumIn, CurriculumOut, CurriculumPatch,
)

router = APIRouter(prefix="", tags=["vocabulary-lookups"])


def _slugify(name: str) -> str:
    normalized = unicodedata.normalize('NFKD', name)
    ascii_only = normalized.encode('ascii', 'ignore').decode('ascii')
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', ascii_only).strip('-').lower()
    return slug or 'category'


# --- Curriculums ---

@router.get("/curriculums", response_model=List[CurriculumOut])
def list_curriculums(db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    rows = (
        db.query(VocabularyCurriculum, func.count(VocabularySet.id))
        .outerjoin(VocabularySet, VocabularySet.curriculum_id == VocabularyCurriculum.id)
        .filter(VocabularyCurriculum.is_private.is_(False))
        .group_by(VocabularyCurriculum.id)
        .order_by(VocabularyCurriculum.name)
        .all()
    )
    return [
        CurriculumOut(id=c.id, name=c.name, description=c.description, set_count=count)
        for c, count in rows
    ]


@router.post("/curriculums", response_model=CurriculumOut)
def create_curriculum(
    payload: CurriculumIn, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    if db.query(VocabularyCurriculum).filter(
        VocabularyCurriculum.name == payload.name, VocabularyCurriculum.is_private.is_(False),
    ).first():
        raise HTTPException(status_code=409, detail="Đã tồn tại bộ giáo trình với tên này")
    curriculum = VocabularyCurriculum(name=payload.name, description=payload.description, is_private=False)
    db.add(curriculum)
    db.commit()
    db.refresh(curriculum)
    return CurriculumOut(id=curriculum.id, name=curriculum.name, description=curriculum.description, set_count=0)


@router.patch("/curriculums/{curriculum_id}", response_model=CurriculumOut)
def update_curriculum(
    curriculum_id: int, payload: CurriculumPatch,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    curriculum = db.query(VocabularyCurriculum).filter(
        VocabularyCurriculum.id == curriculum_id, VocabularyCurriculum.is_private.is_(False),
    ).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ giáo trình")
    fields = payload.model_dump(exclude_unset=True)
    if 'name' in fields:
        curriculum.name = fields['name']
    if 'description' in fields:
        curriculum.description = fields['description']
    db.commit()
    db.refresh(curriculum)
    set_count = db.query(VocabularySet).filter(VocabularySet.curriculum_id == curriculum_id).count()
    return CurriculumOut(id=curriculum.id, name=curriculum.name, description=curriculum.description, set_count=set_count)


@router.delete("/curriculums/{curriculum_id}")
def delete_curriculum(
    curriculum_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    curriculum = db.query(VocabularyCurriculum).filter(
        VocabularyCurriculum.id == curriculum_id, VocabularyCurriculum.is_private.is_(False),
    ).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ giáo trình")
    in_use = db.query(VocabularySet).filter(VocabularySet.curriculum_id == curriculum_id).count()
    if in_use:
        raise HTTPException(
            status_code=409, detail=f"Không thể xóa vì đang được {in_use} bộ từ vựng sử dụng",
        )
    db.delete(curriculum)
    db.commit()
    return {"success": True}


# --- Categories ---

@router.get("/categories", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    rows = (
        db.query(VocabularyCategory, func.count(VocabularySet.id))
        .outerjoin(VocabularySet, VocabularySet.category_id == VocabularyCategory.id)
        .group_by(VocabularyCategory.id)
        .order_by(VocabularyCategory.name)
        .all()
    )
    return [
        CategoryOut(id=c.id, name=c.name, slug=c.slug, set_count=count)
        for c, count in rows
    ]


@router.post("/categories", response_model=CategoryOut)
def create_category(
    payload: CategoryIn, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    if db.query(VocabularyCategory).filter(VocabularyCategory.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Đã tồn tại danh mục với tên này")
    slug = _slugify(payload.name)
    base_slug, i = slug, 1
    while db.query(VocabularyCategory).filter(VocabularyCategory.slug == slug).first():
        i += 1
        slug = f"{base_slug}-{i}"
    category = VocabularyCategory(name=payload.name, slug=slug)
    db.add(category)
    db.commit()
    db.refresh(category)
    return CategoryOut(id=category.id, name=category.name, slug=category.slug, set_count=0)


@router.patch("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int, payload: CategoryPatch,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    category = db.query(VocabularyCategory).filter(VocabularyCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    fields = payload.model_dump(exclude_unset=True)
    if 'name' in fields:
        category.name = fields['name']
    db.commit()
    db.refresh(category)
    set_count = db.query(VocabularySet).filter(VocabularySet.category_id == category_id).count()
    return CategoryOut(id=category.id, name=category.name, slug=category.slug, set_count=set_count)


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    category = db.query(VocabularyCategory).filter(VocabularyCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    in_use = db.query(VocabularySet).filter(VocabularySet.category_id == category_id).count()
    if in_use:
        raise HTTPException(
            status_code=409, detail=f"Không thể xóa vì đang được {in_use} bộ từ vựng sử dụng",
        )
    db.delete(category)
    db.commit()
    return {"success": True}
