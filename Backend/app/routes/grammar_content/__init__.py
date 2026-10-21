"""Grammar Content Bank: admin curriculum/category lookup CRUD, grammar
set import/review — mirrors app/routes/vocabulary/ one-to-one, split into
one module per concern.
"""
from fastapi import APIRouter

from .lookups import router as lookups_router
from .imports import router as imports_router
from .review import router as review_router
from .library import router as library_router
from .practice import router as practice_router

router = APIRouter(prefix="/grammar-content", tags=["grammar-content"])
router.include_router(lookups_router)
router.include_router(imports_router)
router.include_router(review_router)
router.include_router(library_router)
router.include_router(practice_router)
