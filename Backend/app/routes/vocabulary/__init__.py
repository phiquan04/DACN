"""Vocabulary Content Bank: admin curriculum/category lookup CRUD, vocabulary
set import/review, split into one module per concern the same way
app/routes/jlpt/ is split.
"""
from fastapi import APIRouter

from .lookups import router as lookups_router
from .imports import router as imports_router
from .review import router as review_router
from .learning import router as learning_router

router = APIRouter(prefix="/vocabulary", tags=["vocabulary"])
router.include_router(lookups_router)
router.include_router(imports_router)
router.include_router(review_router)
router.include_router(learning_router)
