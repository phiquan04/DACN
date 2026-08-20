from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models import ChatScenario
from app.models.database import get_db

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("")
def list_scenarios(db: Session = Depends(get_db)):
    scenarios = (
        db.query(ChatScenario)
        .filter(ChatScenario.is_active.is_(True))
        .order_by(ChatScenario.id)
        .all()
    )
    return [
        {
            "id": s.id,
            "title": s.title,
            "description": s.description,
            "level": s.level,
            "icon": s.icon,
        }
        for s in scenarios
    ]
