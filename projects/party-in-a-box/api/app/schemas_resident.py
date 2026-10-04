"""Request-body models for the resident, public and thread endpoints (docs/api/resident.openapi.yaml)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DATE_RE = r"^\d{4}-\d{2}-\d{2}$"


class Services(BaseModel):
    barricades: bool
    green_kit: bool


class DateChecksIn(BaseModel):
    block_id: str
    date_start: str = Field(pattern=DATE_RE)
    date_end: str = Field(pattern=DATE_RE)


class SignIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    house_number: str = Field(pattern=r"^[0-9]{1,5}( ?1/2)?$")
    email: str | None = Field(default=None, max_length=200)
    consent: bool
    captcha: str


class RequestInput(BaseModel):
    block_id: str
    date_start: str = Field(pattern=DATE_RE)
    date_end: str = Field(pattern=DATE_RE)
    guests: int = Field(ge=1, le=2000)
    services: Services


class RequestPatch(BaseModel):
    date_start: str | None = Field(default=None, pattern=DATE_RE)
    date_end: str | None = Field(default=None, pattern=DATE_RE)
    guests: int | None = Field(default=None, ge=1, le=2000)
    services: Services | None = None


class StrikeIn(BaseModel):
    reason: str | None = Field(default=None, max_length=200)


class ChangeRequestInput(BaseModel):
    type: Literal["reschedule", "cancel"]
    proposed_start: str | None = Field(default=None, pattern=DATE_RE)
    proposed_end: str | None = Field(default=None, pattern=DATE_RE)
    message: str = Field(min_length=1, max_length=1000)


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
