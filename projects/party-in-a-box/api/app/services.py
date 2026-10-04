"""Shared DB-backed helpers used by the resident, vendor and village routers.

Rules stay pure in `rules.py`; this module gathers their inputs from the database and
applies the side effects (matching, voiding, notifications) in one place.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import rules
from .blocks import get_index
from .config import load_rules
from .db import (Match, Offer, PaperPetition, Request, Signature, Thread, User, VendorAccount,
                 WeekendSlot, new_id, notify)
from .errors import ApiError

COUNTED_STATUSES = {"submitted", "approved", "completed"}
CLOSURE_STATUSES = {"approved", "completed"}


def now() -> datetime:
    return datetime.now(timezone.utc)


def block_for(req: Request) -> dict:
    block = get_index().by_id.get(req.block_id)
    if block is None:
        raise ApiError(422, "unknown_block", "That block isn't in the street data.", [req.block_id])
    return block


def block_label(block_id: str) -> str:
    block = get_index().by_id.get(block_id)
    return get_index().label(block) if block else block_id


def event_date(req: Request) -> str:
    return req.approved_date or req.date_start


def get_request_or_404(db: Session, request_id: str) -> Request:
    req = db.get(Request, request_id)
    if req is None:
        raise ApiError(404, "not_found", "Request not found.")
    return req


def ensure_owner(req: Request, user: User) -> None:
    if req.organizer_id != user.id:
        raise ApiError(403, "forbidden", "You can't do that.")


# --- petition -------------------------------------------------------------------------------

def recount_signatures(db: Session, req: Request) -> dict:
    """Recompute every signature's state for a request, save them, and return the count.

    Returns {"count": int, "paper_attested": bool, "needed": int}.
    """
    sigs = (db.query(Signature).filter(Signature.request_id == req.id)
            .order_by(Signature.created_at, Signature.id).all())
    result = rules.distinct_addresses(
        [{"house_number": s.house_number, "state": s.state if s.state == "struck" else None} for s in sigs],
        block_for(req))
    for s, state in zip(sigs, result["states"]):
        s.state = state
    paper = db.query(PaperPetition).filter(PaperPetition.request_id == req.id).first()
    needed = load_rules()["petition_min_addresses"]
    count = max(result["count"], paper.address_count if paper else 0)
    return {"count": count, "paper_attested": paper is not None, "needed": needed}


# --- caps ----------------------------------------------------------------------------------

def approved_requests(db: Session) -> list[Request]:
    """All approved/completed requests, loaded once so callers can pass them through."""
    return db.query(Request).filter(Request.status.in_(CLOSURE_STATUSES)).all()


def weekend_approved_count(db: Session, weekend_key: str | None, approved: list[Request] | None = None,
                           exclude_id: str | None = None) -> int | None:
    """Approved events on that weekend (live count from requests; WeekendSlot is the lock row).

    `approved` is an optional preloaded list of closure requests; `exclude_id` skips one request
    (a request being rescheduled already holds a slot)."""
    if weekend_key is None:
        return None
    n = 0
    for r in (approved if approved is not None else approved_requests(db)):
        if r.id != exclude_id and r.approved_date and rules.weekend_key(r.approved_date) == weekend_key:
            n += 1
    return n


def lock_weekend(db: Session, weekend_key: str) -> WeekendSlot:
    """Fetch-or-create the weekend lock row. On Postgres: INSERT ... ON CONFLICT DO NOTHING, then
    SELECT ... FOR UPDATE, so two first approvals on a fresh weekend can't race to a 500."""
    dialect = db.get_bind().dialect.name
    if dialect in ("postgresql", "sqlite"):
        if dialect == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
        else:
            from sqlalchemy.dialects.sqlite import insert
        db.execute(insert(WeekendSlot).values(weekend_key=weekend_key, approved_count=0, version=1)
                   .on_conflict_do_nothing(index_elements=["weekend_key"]))
    slot = db.get(WeekendSlot, weekend_key, with_for_update=True, populate_existing=True)
    if slot is None:  # other dialects
        slot = WeekendSlot(weekend_key=weekend_key, approved_count=0)
        db.add(slot)
        db.flush()
    return slot


def lock_block_requests(db: Session, block_id: str) -> None:
    """Row-lock every request on a block (spec §4.3 block-year lock). No-op on SQLite."""
    db.query(Request).filter(Request.block_id == block_id).with_for_update().all()


def block_year_count(db: Session, block_id: str, year: int, exclude_id: str | None = None) -> int:
    rows = db.query(Request).filter(Request.block_id == block_id).all()
    return rules.block_year_count(block_id, year, [
        {"id": r.id, "block_id": r.block_id, "status": r.status, "date_start": r.date_start,
         "approved_date": r.approved_date} for r in rows], exclude_id)


def same_day_block_approved(db: Session, req: Request, date: str) -> bool:
    return db.query(Request).filter(Request.block_id == req.block_id, Request.id != req.id,
                                    Request.status.in_(CLOSURE_STATUSES),
                                    Request.approved_date == date).first() is not None


def approval_check(db: Session, req: Request, date: str, exclude_self_from_weekend: bool = False) -> dict:
    """rules.can_approve with all inputs gathered from the DB.

    `exclude_self_from_weekend`: don't count this request in the weekend total (reschedules)."""
    pet = recount_signatures(db, req)
    return rules.can_approve(
        {"status": req.status, "date_start": req.date_start, "date_end": req.date_end,
         "submitted_at": req.submitted_at.isoformat() if req.submitted_at else None},
        date,
        {"block": block_for(req), "rules": load_rules(), "distinct_count": pet["count"],
         "paper_attested": pet["paper_attested"],
         "weekend_approved_count": weekend_approved_count(
             db, rules.weekend_key(date), exclude_id=req.id if exclude_self_from_weekend else None),
         "block_year_count_excl": block_year_count(db, req.block_id, int(date[:4]), exclude_id=req.id),
         "same_day_block_approved": same_day_block_approved(db, req, date)})


# --- traffic -------------------------------------------------------------------------------

def closures_on_weekend(db: Session, date: str, exclude_id: str | None = None,
                        approved: list[Request] | None = None) -> list[Request]:
    """Approved requests on the same weekend as `date` (or the same day, for weekdays).
    `approved` is an optional preloaded list of closure requests."""
    key = rules.weekend_key(date)
    out = []
    for r in (approved if approved is not None else approved_requests(db)):
        if r.id == exclude_id or not r.approved_date:
            continue
        if (key and rules.weekend_key(r.approved_date) == key) or (not key and r.approved_date == date):
            out.append(r)
    return out


def score_request_on(db: Session, req: Request, date: str, approved: list[Request] | None = None,
                     submitted: list[Request] | None = None) -> dict:
    """Traffic score for a request on a candidate date, against approved closures that weekend.
    `approved` / `submitted` are optional preloaded request lists (default: query)."""
    idx = get_index()
    near = {n["id"]: n for n in idx.neighbors(req.block_id)}
    if approved is None:
        approved = approved_requests(db)
    if submitted is None:
        submitted = db.query(Request).filter(Request.status == "submitted").all()
    others = [near[r.block_id] for r in closures_on_weekend(db, date, exclude_id=req.id, approved=approved)
              if r.block_id in near]
    pending = [{"label": block_label(r.block_id)} for r in submitted
               if r.id != req.id and r.block_id in near
               and date in rules.candidate_dates(r.date_start, r.date_end, load_rules())]
    return rules.traffic_score(block_for(req), date, {
        "other_closures": [{"label": o["label"], "distance_m": o["distance_m"], "same_street": o["same_street"]}
                           for o in others],
        "pending_nearby": pending,
        "weekend_approved_count": weekend_approved_count(db, rules.weekend_key(date), approved),
        "rules": load_rules()})


# --- vendors -------------------------------------------------------------------------------

def _offer_inputs(db: Session, req: Request, date: str) -> list[dict]:
    out = []
    accepted_services = {m.service_snapshot for m in db.query(Match).filter(
        Match.request_id == req.id, Match.state == "accepted").all()}
    offers = db.query(Offer).all()
    accounts = {va.id: va for va in db.query(VendorAccount).filter(
        VendorAccount.id.in_([o.vendor_account_id for o in offers])).all()} if offers else {}
    on_date = dict(db.query(Match.vendor_account_id, func.count(Match.id)).filter(
        Match.event_date == date, Match.state == "accepted").group_by(Match.vendor_account_id).all())
    existing_by_vendor: dict[str, Match] = {}
    for m in db.query(Match).filter(Match.request_id == req.id).all():
        existing_by_vendor.setdefault(m.vendor_account_id, m)
    for offer in offers:
        va = accounts[offer.vendor_account_id]
        accepted_on_date = on_date.get(va.id, 0)
        existing = existing_by_vendor.get(va.id)
        out.append({"vendor_account_id": va.id, "status": va.status, "active": offer.active,
                    "service": offer.service, "max_guests": offer.max_guests,
                    "jobs_per_day": offer.jobs_per_day, "days": offer.days, "zips": offer.zips,
                    "accepted_on_date": accepted_on_date,
                    "already_matched": existing is not None and existing.state != "void",
                    "service_filled": offer.service in accepted_services})
    return out


def rematch_request(db: Session, req: Request) -> list[Match]:
    """Create `proposed` matches for an approved request. Returns the new matches."""
    if req.status != "approved" or not req.approved_date:
        return []
    block = block_for(req)
    hits = rules.match({"date": req.approved_date, "guests": req.guests, "zip": block.get("zip")},
                       _offer_inputs(db, req, req.approved_date))
    created = []
    for h in hits:
        offer = db.get(Offer, h["vendor_account_id"])
        m = db.query(Match).filter(Match.request_id == req.id,
                                   Match.vendor_account_id == h["vendor_account_id"]).first()
        if m is None:
            m = Match(id=new_id("m"), request_id=req.id, vendor_account_id=offer.vendor_account_id)
            db.add(m)
        m.event_date, m.state, m.why = req.approved_date, "proposed", h["why"]
        m.price_snapshot, m.includes_snapshot, m.service_snapshot = offer.price_usd, offer.includes, offer.service
        created.append(m)
        for u in db.query(User).filter(User.vendor_account_id == offer.vendor_account_id).all():
            notify(db, u.id, "match_proposed", {"request_id": req.id, "date": req.approved_date})
    db.flush()
    return created


def rematch_vendor(db: Session, vendor_account_id: str) -> int:
    """After an offer change: void this vendor's proposed matches and re-run matching on
    every future approved request. Accepted matches are kept. Returns proposed count."""
    for m in db.query(Match).filter(Match.vendor_account_id == vendor_account_id,
                                    Match.state == "proposed").all():
        m.state = "void"
    db.flush()
    from .config import today
    n = 0
    for req in db.query(Request).filter(Request.status == "approved").all():
        if req.approved_date and req.approved_date >= today():
            n += sum(1 for m in rematch_request(db, req) if m.vendor_account_id == vendor_account_id)
    return n


def void_matches(db: Session, req: Request, reason: str) -> None:
    """Request cancelled: void every match and tell accepted vendors."""
    for m in db.query(Match).filter(Match.request_id == req.id).all():
        if m.state == "accepted":
            for u in db.query(User).filter(User.vendor_account_id == m.vendor_account_id).all():
                notify(db, u.id, "job_cancelled", {"request_id": req.id, "reason": reason})
        m.state = "void"


def reconfirm_matches(db: Session, req: Request) -> None:
    """Request rescheduled: accepted matches that still fit go back to proposed with
    needs_reconfirm; everything else is voided; then re-run matching for new vendors."""
    still_fit = {h["vendor_account_id"] for h in rules.match(
        {"date": req.approved_date, "guests": req.guests, "zip": block_for(req).get("zip")},
        [dict(o, already_matched=False, service_filled=False) for o in _offer_inputs(db, req, req.approved_date)])}
    for m in db.query(Match).filter(Match.request_id == req.id).all():
        if m.state == "accepted" and m.vendor_account_id in still_fit:
            m.state, m.needs_reconfirm, m.event_date = "proposed", True, req.approved_date
        elif m.state != "void":
            m.state = "void"
    db.flush()
    rematch_request(db, req)


def vendors_for_request(db: Session, req: Request) -> list[dict]:
    """Organizer view: accepted = Coming, proposed = Waiting for vendor; others hidden."""
    out = []
    for m in db.query(Match).filter(Match.request_id == req.id,
                                    Match.state.in_(["accepted", "proposed"])).all():
        va = db.get(VendorAccount, m.vendor_account_id)
        offer = db.get(Offer, m.vendor_account_id)
        thread = db.query(Thread).filter(Thread.kind == "job", Thread.match_id == m.id).first()
        out.append({"name": va.business_name, "service": m.service_snapshot, "includes": m.includes_snapshot,
                    "max_guests": offer.max_guests if offer else None, "price_usd": m.price_snapshot,
                    "state": "Coming" if m.state == "accepted" else "Waiting for vendor",
                    "thread_id": thread.id if thread else None})
    return out


# --- threads -------------------------------------------------------------------------------

def request_thread(db: Session, req: Request) -> Thread:
    t = db.query(Thread).filter(Thread.kind == "request", Thread.request_id == req.id).first()
    if t is None:
        t = Thread(id=new_id("t"), kind="request", request_id=req.id)
        db.add(t)
        db.flush()
    return t


def job_thread(db: Session, match: Match) -> Thread:
    t = db.query(Thread).filter(Thread.kind == "job", Thread.match_id == match.id).first()
    if t is None:
        t = Thread(id=new_id("t"), kind="job", request_id=match.request_id, match_id=match.id)
        db.add(t)
        db.flush()
    return t


# --- request views -------------------------------------------------------------------------

def stepper(db: Session, req: Request, petition_count: int) -> dict:
    needed = load_rules()["petition_min_addresses"]
    return {
        "permit_filled": req.status != "draft",
        "petition": petition_count >= needed,
        "submitted": req.submitted_at is not None,
        "reviewed": req.decided_at is not None,
        "approved": req.status in ("approved", "completed"),
        "vendor_matches": db.query(Match).filter(Match.request_id == req.id,
                                                 Match.state == "accepted").count() > 0,
    }


def petition_url(req: Request) -> str | None:
    from .config import settings
    if not req.petition_token:
        return None
    return settings.PUBLIC_SITE_URL.rstrip("/") + "/#/petition/" + req.petition_token


def request_out(req: Request) -> dict:
    """OpenAPI `Request` shape (resident.openapi.yaml)."""
    from datetime import date, timedelta
    barricade = None
    if req.approved_date:
        barricade = (date.fromisoformat(req.approved_date) - timedelta(days=1)).isoformat()
    return {
        "id": req.id, "block_id": req.block_id, "block_label": block_label(req.block_id), "kind": req.kind,
        "date_start": req.date_start, "date_end": req.date_end, "guests": req.guests,
        "services": req.services, "status": req.status, "petition_due": req.petition_due,
        "petition_url": petition_url(req), "approved_date": req.approved_date, "barricade_date": barricade,
        "reject_reason": req.reject_reason,
        "submitted_at": req.submitted_at.isoformat() if req.submitted_at else None,
        "decided_at": req.decided_at.isoformat() if req.decided_at else None,
        "rules_year": req.rules_year, "version": str(req.version),
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }
