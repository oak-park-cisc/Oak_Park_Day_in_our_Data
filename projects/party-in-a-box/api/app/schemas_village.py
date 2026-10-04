"""Pydantic models for the Village reviewer endpoints (docs/api/village.openapi.yaml)."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class ApproveIn(BaseModel):
    date: str


class RejectIn(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


class ResolveIn(BaseModel):
    decision: Literal["accept", "decline"]
    new_date: str | None = None
    message: str | None = Field(default=None, max_length=1000)


class WhatIfIn(BaseModel):
    date: str
    closures: list[str]
    treat_as_weekday: bool = False


Str200 = Annotated[str, Field(max_length=200)]


class ReasonIn(BaseModel):
    pts: int
    text: Str200


class AiClosureIn(BaseModel):
    label: Str200
    score: int = Field(ge=0, le=100)
    level: Literal["low", "medium", "high"]
    reasons: Annotated[list[ReasonIn], Field(max_length=20)]


class AiWeekendIn(BaseModel):
    count: int = Field(ge=0, le=1000)
    cap: int = Field(ge=0, le=1000)


class AiSuggestionIn(BaseModel):
    text: Str200


class AiExplainIn(BaseModel):
    question: str = Field(max_length=300)
    date: Str200
    is_weekday: bool
    closures: Annotated[list[AiClosureIn], Field(max_length=50)]
    weekend: AiWeekendIn | None = None
    suggestions: Annotated[list[AiSuggestionIn], Field(max_length=20)]
    tips: Annotated[list[Str200], Field(max_length=20)]


class AiExplainOut(BaseModel):
    summary: str
    answer: str
    referenced_suggestions: list[int]
    source: Literal["ai", "template"]
    label: Literal["AI-written", "Templated summary (AI unavailable)"]


class VendorInviteIn(BaseModel):
    business_name: str = Field(min_length=1, max_length=120)
    contact_email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=200)


class VendorStatusIn(BaseModel):
    status: Literal["approved", "suspended"]
