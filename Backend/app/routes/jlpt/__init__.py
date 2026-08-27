"""JLPT feature: admin exam-structure setup, exam import/review, and
user-facing exam listing/attempts. Split into one module per concern —
see structure.py, imports.py — the same way app/routes/dictionary/ is split.
"""
from fastapi import APIRouter

from .structure import router as structure_router
from .imports import router as imports_router

router = APIRouter(prefix="/jlpt", tags=["jlpt"])
router.include_router(structure_router)
router.include_router(imports_router)
