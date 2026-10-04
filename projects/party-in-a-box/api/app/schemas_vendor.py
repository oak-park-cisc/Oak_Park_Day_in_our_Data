"""Pydantic models for the vendor endpoints (docs/api/vendor.openapi.yaml)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Service = Literal["ice_cream", "food_truck", "bounce_house", "face_painting", "music_dj", "other"]
DayClass = Literal["weekday", "saturday", "sunday"]
Zip = Literal["60301", "60302", "60304"]
MatchState = Literal["proposed", "accepted", "declined", "withdrawn", "void"]


class VendorMe(BaseModel):
    business_name: str
    status: str
    approved_at: str | None


class OfferInput(BaseModel):
    service: Service
    price_usd: int = Field(ge=0)
    max_guests: int = Field(ge=1)
    jobs_per_day: int = Field(ge=1)
    includes: str = Field(max_length=300)
    days: list[DayClass]
    zips: list[Zip]
    active: bool

    @field_validator("days", "zips")
    @classmethod
    def _unique(cls, v: list) -> list:
        if len(set(v)) != len(v):
            raise ValueError("items must be unique")
        return v


class OfferOut(OfferInput):
    updated_at: str


class Summary(BaseModel):
    matched_open: int
    accepted: int


class MatchForVendor(BaseModel):
    match_id: str
    block_label: str
    zip: str | None
    date: str
    hours: str
    guests: int
    price_usd: int
    why: list[str]
    needs_reconfirm: bool
    state: MatchState


class MatchList(BaseModel):
    matches: list[MatchForVendor]


class Job(MatchForVendor):
    thread_id: str | None
    organizer_display_name: str
    reminder: str


class JobList(BaseModel):
    jobs: list[Job]


class WithdrawInput(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
