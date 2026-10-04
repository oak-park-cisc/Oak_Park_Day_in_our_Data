"""SQLAlchemy models, session handling, and small helpers."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from sqlalchemy import (JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer,
                        MetaData, String, Text, UniqueConstraint, create_engine, text)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from .config import settings


def _now() -> datetime:
    return datetime.now(timezone.utc)


NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


_IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")
if _IS_SQLITE:
    engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """SQLite (tests) gets create_all; Postgres schema is owned by Alembic."""
    if _IS_SQLITE:
        Base.metadata.create_all(engine)
        return
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "Database not reachable — run `docker compose up -d` and `uv run alembic upgrade head`"
        ) from exc


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(5)}"


def new_token() -> str:
    return secrets.token_hex(16)


def _ts():
    return mapped_column(DateTime(timezone=True), default=_now)


class VendorAccount(Base):
    __tablename__ = "vendor_accounts"
    __table_args__ = (
        CheckConstraint("status IN ('invited', 'approved', 'suspended')", name="status"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    business_name: Mapped[str] = mapped_column(String)
    contact_email: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)  # invited|approved|suspended
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = _ts()


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('resident', 'vendor', 'reviewer', 'admin')", name="role"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    role: Mapped[str] = mapped_column(String)  # resident|vendor|reviewer|admin
    email: Mapped[str] = mapped_column(String)
    display_name: Mapped[str] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    vendor_account_id: Mapped[str | None] = mapped_column(ForeignKey("vendor_accounts.id"), nullable=True)
    dev_token: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    created_at: Mapped[datetime] = _ts()


class Request(Base):
    __tablename__ = "requests"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'collecting', 'submitted', 'approved', 'rejected', 'withdrawn', 'cancelled', 'completed')", name="status"),
        CheckConstraint("kind IN ('party')", name="kind"),
        CheckConstraint("guests > 0", name="guests_positive"),
        CheckConstraint("date_start <= date_end", name="date_order"),
        Index("ix_requests_status", "status"),
        Index("ix_requests_block_id", "block_id"),
        Index("ix_requests_approved_date", "approved_date"),
        Index("ix_requests_organizer_id", "organizer_id"),
        Index("ix_requests_submitted_at", "submitted_at"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    organizer_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    block_id: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String, default="party")
    date_start: Mapped[str] = mapped_column(String(10))
    date_end: Mapped[str] = mapped_column(String(10))
    guests: Mapped[int] = mapped_column(Integer)
    services: Mapped[dict] = mapped_column(JSON)  # {barricades, green_kit}
    status: Mapped[str] = mapped_column(String, default="draft")
    approved_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    petition_token: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    petition_due: Mapped[str | None] = mapped_column(String(10), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by: Mapped[str | None] = mapped_column(String, nullable=True)
    reject_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    decision_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    rules_year: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = _ts()


class Signature(Base):
    __tablename__ = "signatures"
    __table_args__ = (
        CheckConstraint("state IN ('counted', 'duplicate_address', 'off_block', 'struck')", name="state"),
        Index("ix_signatures_request_id", "request_id"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("requests.id"))
    name: Mapped[str] = mapped_column(String)
    house_number: Mapped[str] = mapped_column(String)
    street: Mapped[str] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    state: Mapped[str] = mapped_column(String)  # counted|duplicate_address|off_block|struck
    ip_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = _ts()


class PaperPetition(Base):
    __tablename__ = "paper_petitions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("requests.id"), unique=True)
    address_count: Mapped[int] = mapped_column(Integer)
    file_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    attested_by: Mapped[str] = mapped_column(String)
    attested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ChangeRequest(Base):
    __tablename__ = "change_requests"
    __table_args__ = (
        CheckConstraint("type IN ('reschedule', 'cancel')", name="type"),
        CheckConstraint("status IN ('open', 'accepted', 'declined')", name="status"),
        Index("ix_change_requests_request_id", "request_id"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("requests.id"))
    type: Mapped[str] = mapped_column(String)  # reschedule|cancel
    proposed_start: Mapped[str] = mapped_column(String(10))
    proposed_end: Mapped[str | None] = mapped_column(String(10), nullable=True)
    message: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="open")  # open|accepted|declined
    new_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(String, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = _ts()


class Offer(Base):
    __tablename__ = "offers"
    __table_args__ = (
        CheckConstraint("service IN ('ice_cream', 'food_truck', 'bounce_house', 'face_painting', 'music_dj', 'other')", name="service"),
        CheckConstraint("price_usd >= 0", name="price_nonneg"),
        CheckConstraint("max_guests > 0", name="max_guests_positive"),
        CheckConstraint("jobs_per_day > 0", name="jobs_per_day_positive"),
    )
    vendor_account_id: Mapped[str] = mapped_column(ForeignKey("vendor_accounts.id"), primary_key=True)
    service: Mapped[str] = mapped_column(String)
    price_usd: Mapped[int] = mapped_column(Integer)
    max_guests: Mapped[int] = mapped_column(Integer)
    jobs_per_day: Mapped[int] = mapped_column(Integer)
    includes: Mapped[str] = mapped_column(String(300))
    days: Mapped[list] = mapped_column(JSON)
    zips: Mapped[list] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (
        UniqueConstraint("request_id", "vendor_account_id"),
        CheckConstraint("state IN ('proposed', 'accepted', 'declined', 'withdrawn', 'void')", name="state"),
        Index("ix_matches_vendor_account_id_event_date", "vendor_account_id", "event_date"),
        Index("ix_matches_request_id", "request_id"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("requests.id"))
    vendor_account_id: Mapped[str] = mapped_column(ForeignKey("vendor_accounts.id"))
    event_date: Mapped[str] = mapped_column(String(10))
    state: Mapped[str] = mapped_column(String)  # proposed|accepted|declined|withdrawn|void
    why: Mapped[list] = mapped_column(JSON)
    price_snapshot: Mapped[int] = mapped_column(Integer)
    includes_snapshot: Mapped[str] = mapped_column(String)
    service_snapshot: Mapped[str] = mapped_column(String)
    needs_reconfirm: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _ts()
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Thread(Base):
    __tablename__ = "threads"
    __table_args__ = (
        CheckConstraint("kind IN ('request', 'job')", name="kind"),
        Index("ix_threads_request_id", "request_id"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    kind: Mapped[str] = mapped_column(String)  # request|job
    request_id: Mapped[str] = mapped_column(ForeignKey("requests.id"))
    match_id: Mapped[str | None] = mapped_column(ForeignKey("matches.id"), nullable=True)


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("author_role IN ('resident', 'vendor', 'village')", name="author_role"),
        Index("ix_messages_thread_id_created_at", "thread_id", "created_at"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    thread_id: Mapped[str] = mapped_column(ForeignKey("threads.id"))
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    author_role: Mapped[str] = mapped_column(String)  # resident|vendor|village
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = _ts()


class WeekendSlot(Base):
    __tablename__ = "weekend_slots"
    __table_args__ = (
        CheckConstraint("approved_count >= 0", name="approved_count_nonneg"),
    )
    weekend_key: Mapped[str] = mapped_column(String, primary_key=True)
    approved_count: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint("channel IN ('email', 'sms')", name="channel"),
        CheckConstraint("status IN ('queued', 'sent', 'failed')", name="status"),
        Index("ix_notifications_status", "status"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String)
    channel: Mapped[str] = mapped_column(String)  # email|sms
    template: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String, default="queued")  # queued|sent|failed
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = _ts()
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_entity_entity_id", "entity", "entity_id"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    actor_id: Mapped[str] = mapped_column(String)
    action: Mapped[str] = mapped_column(String)
    entity: Mapped[str] = mapped_column(String)
    entity_id: Mapped[str] = mapped_column(String)
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


def audit(db, actor_id, action, entity, entity_id, before=None, after=None) -> AuditLog:
    row = AuditLog(id=new_id("aud"), actor_id=actor_id, action=action, entity=entity,
                   entity_id=entity_id, before=before, after=after)
    db.add(row)
    return row


def notify(db, user_id, template, payload, channel="email") -> Notification:
    row = Notification(id=new_id("ntf"), user_id=user_id, channel=channel, template=template,
                       payload=payload, status="queued", attempts=0)
    db.add(row)
    return row
