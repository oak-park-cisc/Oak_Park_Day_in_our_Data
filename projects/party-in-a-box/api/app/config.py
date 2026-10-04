"""Settings, today(), and the rules file loader."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)


def _env(name: str, default: str | None = None) -> str | None:
    v = os.environ.get(name)
    return v if v else default


@dataclass
class Settings:
    DATABASE_URL: str = field(default_factory=lambda: _env("DATABASE_URL", "postgresql+psycopg://party:party@localhost:5433/partyinabox"))
    CORS_ORIGINS: str = field(default_factory=lambda: _env(
        "CORS_ORIGINS",
        "https://dsvs12.github.io,http://localhost:8000,http://127.0.0.1:8000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"))
    PUBLIC_SITE_URL: str = field(default_factory=lambda: _env(
        "PUBLIC_SITE_URL", "https://dsvs12.github.io/block-party-in-a-box/"))
    AUTH_MODE: str = field(default_factory=lambda: _env("AUTH_MODE", "dev"))
    TODAY_OVERRIDE: str | None = field(default_factory=lambda: _env("TODAY_OVERRIDE"))
    ANTHROPIC_API_KEY: str | None = field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    ANTHROPIC_MODEL: str = field(default_factory=lambda: _env("ANTHROPIC_MODEL", "claude-sonnet-5-5"))
    REPO_ROOT: Path = REPO_ROOT

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()


def today() -> str:
    if settings.TODAY_OVERRIDE:
        return settings.TODAY_OVERRIDE
    return datetime.now(ZoneInfo("America/Chicago")).date().isoformat()


DEFAULT_RULES = {
    "rules_year": 2026, "confirmed_by_village": False,
    "source_url": "https://www.oak-park.us/Community/Events-and-Activities/Block-Parties-and-Sales",
    "season": {"start_mmdd": "04-04", "end_mmdd": "10-31"}, "hours": {"start": "09:00", "end": "23:00"},
    "petition_min_addresses": 10, "petition_lead_days": 14, "max_events_per_block_per_year": 2,
    "max_events_per_weekend": 30, "contact": {"email": "publicworks@oak-park.us", "phone": "708.358.5700"},
    "checklist": [
        "Street runs north/south (east/west streets aren't closed)",
        "Petition signed by at least 10 separate addresses",
        "Petition in at least 2 weeks before the event",
        "Event between 9 a.m. and 11 p.m., April 4 – October 31",
        "No more than 2 events on this block this year",
        "No alcohol sales",
        "Items stay in the curb parking lane; nothing strung across the street",
        "Barricades are delivered the day before (Friday for weekend events)"],
}


def load_rules() -> dict:
    path = REPO_ROOT / "web" / "data" / "block-party-rules.json"
    if not path.exists():
        return json.loads(json.dumps(DEFAULT_RULES))
    with open(path, encoding="utf-8") as f:
        rules = json.load(f)
    rules.pop("flag_words", None)
    rules.pop("block_sale_pct", None)
    rules.setdefault("confirmed_by_village", False)
    return rules
