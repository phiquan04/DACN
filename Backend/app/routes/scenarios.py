from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models import ChatScenario
from app.models.database import get_db
from app.schemas.scenario import ScenarioSummary

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("", response_model=list[ScenarioSummary])
def list_scenarios(db: Session = Depends(get_db)):
    scenarios = (
        db.query(ChatScenario)
        .filter(ChatScenario.is_active.is_(True))
        .order_by(ChatScenario.id)
        .all()
    )
    return [
        ScenarioSummary(
            id=s.id,
            title=s.title,
            description=s.description,
            level=s.level,
            icon=s.icon,
            context_fields=s.context_fields or [],
        )
        for s in scenarios
    ]
