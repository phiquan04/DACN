"""Admin management of chatbot scenarios: create/edit the selectable
roleplay situations and the structured '場面' context form shown to the
user for each one. Separate from routes/scenarios.py (the public,
active-only listing used by the chat page)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import UserResponse, require_admin
from app.models import ChatScenario
from app.models.database import get_db
from app.schemas.scenario import ScenarioCreateRequest, ScenarioDetail, ScenarioUpdateRequest

router = APIRouter(prefix="/admin/scenarios", tags=["admin-scenarios"])


def _detail(s: ChatScenario) -> ScenarioDetail:
    return ScenarioDetail(
        id=s.id,
        title=s.title,
        description=s.description,
        level=s.level,
        icon=s.icon,
        is_active=s.is_active,
        opening_line=s.opening_line,
        topic_prompt=s.topic_prompt,
        context_fields=s.context_fields or [],
    )


@router.get("", response_model=list[ScenarioDetail])
def list_scenarios(db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    scenarios = db.query(ChatScenario).order_by(ChatScenario.id).all()
    return [_detail(s) for s in scenarios]


@router.post("", response_model=ScenarioDetail, status_code=201)
def create_scenario(
    payload: ScenarioCreateRequest,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    scenario = ChatScenario(
        title=payload.title.strip(),
        description=payload.description,
        level=payload.level,
        icon=payload.icon,
        opening_line=payload.opening_line,
        topic_prompt=payload.topic_prompt,
        context_fields=[f.model_dump() for f in payload.context_fields] or None,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return _detail(scenario)


@router.patch("/{scenario_id}", response_model=ScenarioDetail)
def update_scenario(
    scenario_id: int,
    payload: ScenarioUpdateRequest,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    scenario = db.query(ChatScenario).filter(ChatScenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    data = payload.model_dump(exclude_unset=True)
    if "context_fields" in data:
        data["context_fields"] = data["context_fields"] or None
    for field, value in data.items():
        setattr(scenario, field, value)

    db.commit()
    db.refresh(scenario)
    return _detail(scenario)
