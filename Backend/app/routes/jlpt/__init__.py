"""JLPT feature: admin exam-structure setup, exam import/review, and
user-facing exam listing/attempts. Split into one module per concern —
see structure.py, imports.py, review.py, attempts.py — the same way
app/routes/dictionary/ is split.
"""
from fastapi import APIRouter

from .structure import router as structure_router
from .imports import router as imports_router
from .review import router as review_router
from .attempts import router as attempts_router
from .dashboard import router as dashboard_router

router = APIRouter(prefix="/jlpt", tags=["jlpt"])
router.include_router(structure_router)
router.include_router(imports_router)
router.include_router(review_router)
router.include_router(attempts_router)
router.include_router(dashboard_router)
