from typing import List, Optional

from pydantic import BaseModel


class ScenarioContextField(BaseModel):
    """One admin-defined input the user fills in when picking a scenario,
    e.g. {"key": "field_1", "label": "Tên công ty", "placeholder": "..."}."""
    key: str
    label: str
    placeholder: Optional[str] = None


class ScenarioSummary(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    level: Optional[str] = None
    icon: Optional[str] = None
    context_fields: List[ScenarioContextField] = []


class ScenarioDetail(ScenarioSummary):
    is_active: bool
    opening_line: Optional[str] = None
    topic_prompt: Optional[str] = None


class ScenarioCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    level: Optional[str] = None
    icon: Optional[str] = None
    opening_line: Optional[str] = None
    topic_prompt: Optional[str] = None
    context_fields: List[ScenarioContextField] = []


class ScenarioUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    level: Optional[str] = None
    icon: Optional[str] = None
    opening_line: Optional[str] = None
    topic_prompt: Optional[str] = None
    context_fields: Optional[List[ScenarioContextField]] = None
    is_active: Optional[bool] = None
