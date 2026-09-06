"""Dictionary feature: word lookup, search history, community images and
comments. Split into one module per concern — see lookup.py/history.py/
images.py/comments.py — with the AI and JMdict business logic living in
app.services.dictionary_ai / dictionary_jmdict instead of here.
"""
from fastapi import APIRouter

from .comments import router as comments_router
from .handwriting import router as handwriting_router
from .history import router as history_router
from .images import router as images_router
from .lookup import router as lookup_router

# admin_moderation.py's router is registered separately in
# app/routes/__init__.py, since it lives at /admin/dictionary rather than
# nested under this module's /dictionary prefix.

router = APIRouter(prefix="/dictionary", tags=["dictionary"])
router.include_router(lookup_router)
router.include_router(handwriting_router)
router.include_router(history_router)
router.include_router(images_router)
router.include_router(comments_router)
