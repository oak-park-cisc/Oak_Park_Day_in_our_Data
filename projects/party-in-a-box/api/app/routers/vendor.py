"""Vendor endpoints. Implements docs/api/vendor.openapi.yaml (thread routes live in threads.py)."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

from .. import rules, services
from ..config import today
from ..db import (Match, Message, Offer, Request, User, VendorAccount, audit, get_db, new_id,
                  notify)
from ..errors import ApiError
from ..auth import require_role
from ..schemas_vendor import (Job, JobList, MatchForVendor, MatchList, OfferInput, OfferOut, Summary,
                              VendorMe, WithdrawInput)

router = APIRouter()

HOURS = "9 a.m. – 11 p.m."
REMINDER = "Keep your setup in the curb parking lane; nothing strung across the street."


# --- helpers -------------------------------------------------------------------------------

def _account(db: Session, user: User) -> VendorAccount:
    va = db.get(VendorAccount, user.vendor_account_id) if user.vendor_account_id else None
    if va is None:
        raise ApiError(403, "forbidden", "This user has no vendor account.")
    return va


def _need_approved(va: VendorAccount) -> None:
    if va.status != "approved":
        raise ApiError(403, "account_not_approved", "Your account hasn't been approved by the city yet.")


def _own_match(db: Session, va: VendorAccount, match_id: str) -> Match:
    m = db.get(Match, match_id)
    if m is None or m.vendor_account_id != va.id:
        raise ApiError(404, "not_found", "Match not found.")
    return m


def _accepted_on(db: Session, va_id: str, date: str, exclude_id: str | None = None) -> int:
    q = db.query(Match).filter(Match.vendor_account_id == va_id, Match.event_date == date,
                               Match.state == "accepted")
    if exclude_id:
        q = q.filter(Match.id != exclude_id)
    return q.count()


def _offer_out(o: Offer) -> OfferOut:
    return OfferOut(service=o.service, price_usd=o.price_usd, max_guests=o.max_guests,
                    jobs_per_day=o.jobs_per_day, includes=o.includes, days=list(o.days),
                    zips=list(o.zips), active=o.active,
                    updated_at=o.updated_at.isoformat() if o.updated_at else services.now().isoformat())


def _match_dict(db: Session, m: Match) -> dict:
    req = db.get(Request, m.request_id)
    block = services.block_for(req)
    return {"match_id": m.id, "block_label": services.block_label(req.block_id),
            "zip": block.get("zip"), "date": m.event_date, "hours": HOURS, "guests": req.guests,
            "price_usd": m.price_snapshot, "why": list(m.why or []),
            "needs_reconfirm": bool(m.needs_reconfirm), "state": m.state}


def _match_out(db: Session, m: Match) -> MatchForVendor:
    return MatchForVendor(**_match_dict(db, m))


def _still_fits(db: Session, m: Match, va: VendorAccount, req: Request) -> bool:
    """Re-check a match against the vendor's current offer using rules.match."""
    offer = db.get(Offer, va.id)
    if offer is None or req.status != "approved" or req.approved_date != m.event_date:
        return False
    other_filled = db.query(Match).filter(
        Match.request_id == req.id, Match.id != m.id, Match.state == "accepted",
        Match.service_snapshot == offer.service).count() > 0
    inp = {"vendor_account_id": va.id, "status": va.status, "active": offer.active,
           "service": offer.service, "max_guests": offer.max_guests, "jobs_per_day": offer.jobs_per_day,
           "days": offer.days, "zips": offer.zips,
           "accepted_on_date": _accepted_on(db, va.id, m.event_date, exclude_id=m.id),
           "already_matched": False, "service_filled": other_filled}
    hits = rules.match({"date": m.event_date, "guests": req.guests,
                        "zip": services.block_for(req).get("zip")}, [inp])
    return bool(hits)


def _lock_for_decision(db: Session, va: VendorAccount, m: Match) -> Request | None:
    """Row-lock the request and this vendor's matches for the date so concurrent accepts serialize."""
    req = db.query(Request).filter(Request.id == m.request_id).with_for_update().one_or_none()
    db.query(Match).filter(Match.vendor_account_id == va.id,
                           Match.event_date == m.event_date).with_for_update().all()
    return req


def _decide(m: Match, state: str) -> None:
    m.state = state
    m.decided_at = services.now()


# --- account -------------------------------------------------------------------------------

@router.get("/vendor/me", response_model=VendorMe)
def get_me(user: User = Depends(require_role("vendor")), db: Session = Depends(get_db)):
    va = _account(db, user)
    return VendorMe(business_name=va.business_name, status=va.status,
                    approved_at=va.approved_at.isoformat() if va.approved_at else None)


@router.get("/vendor/offer", response_model=OfferOut)
def get_offer(user: User = Depends(require_role("vendor")), db: Session = Depends(get_db)):
    va = _account(db, user)
    offer = db.get(Offer, va.id)
    if offer is None:
        raise ApiError(404, "no_offer", "You haven't set up an offer yet.")
    return _offer_out(offer)


@router.put("/vendor/offer", response_model=OfferOut)
def put_offer(body: OfferInput, user: User = Depends(require_role("vendor")),
              db: Session = Depends(get_db), idempotency_key: str | None = Header(default=None)):
    va = _account(db, user)
    _need_approved(va)
    offer = db.get(Offer, va.id)
    before = None
    if offer is None:
        offer = Offer(vendor_account_id=va.id)
        db.add(offer)
    else:
        before = {"service": offer.service, "price_usd": offer.price_usd, "max_guests": offer.max_guests,
                  "jobs_per_day": offer.jobs_per_day, "active": offer.active}
    offer.service, offer.price_usd, offer.max_guests = body.service, body.price_usd, body.max_guests
    offer.jobs_per_day, offer.includes = body.jobs_per_day, body.includes
    offer.days, offer.zips, offer.active = list(body.days), list(body.zips), body.active
    offer.updated_at = services.now()
    db.flush()
    services.rematch_vendor(db, va.id)
    audit(db, user.id, "offer_saved", "offer", va.id, before=before, after=body.model_dump())
    db.commit()
    return _offer_out(offer)


@router.get("/vendor/summary", response_model=Summary)
def get_summary(user: User = Depends(require_role("vendor")), db: Session = Depends(get_db)):
    va = _account(db, user)
    t = today()

    def n(state: str) -> int:
        return db.query(Match).filter(Match.vendor_account_id == va.id, Match.state == state,
                                      Match.event_date >= t).count()
    return Summary(matched_open=n("proposed"), accepted=n("accepted"))


# --- matches -------------------------------------------------------------------------------

def _sorted_matches(db: Session, matches: list[Match]) -> list[Match]:
    def key(m: Match):
        req = db.get(Request, m.request_id)
        sub = req.submitted_at.isoformat() if req and req.submitted_at else ""
        return (m.event_date, sub)
    return sorted(matches, key=key)


@router.get("/vendor/matches", response_model=MatchList)
def list_matches(state: Literal["proposed", "accepted", "declined"] = Query("proposed"),
                 user: User = Depends(require_role("vendor")), db: Session = Depends(get_db)):
    va = _account(db, user)
    matches = db.query(Match).filter(Match.vendor_account_id == va.id, Match.state == state).all()
    if state == "proposed":
        offer = db.get(Offer, va.id)
        cap = offer.jobs_per_day if offer else 1
        matches = [m for m in matches if _accepted_on(db, va.id, m.event_date) < cap]
    return MatchList(matches=[_match_out(db, m) for m in _sorted_matches(db, matches)])


@router.post("/vendor/matches/{match_id}/accept", response_model=MatchForVendor)
def accept_match(match_id: str, user: User = Depends(require_role("vendor")),
                 db: Session = Depends(get_db), idempotency_key: str | None = Header(default=None)):
    va = _account(db, user)
    _need_approved(va)
    m = _own_match(db, va, match_id)
    if m.state != "proposed":
        raise ApiError(409, "wrong_state", "This match can't be accepted right now.",
                       [f"Match is {m.state}."])
    req = _lock_for_decision(db, va, m)
    db.refresh(m)
    if m.state != "proposed":
        raise ApiError(409, "wrong_state", "This match can't be accepted right now.",
                       [f"Match is {m.state}."])
    if req is None or req.status != "approved" or req.approved_date != m.event_date:
        raise ApiError(409, "no_longer_fits", "This event has changed and no longer fits.")
    offer = db.get(Offer, va.id)
    cap = offer.jobs_per_day if offer else 1
    taken = _accepted_on(db, va.id, m.event_date)
    if taken >= cap:
        raise ApiError(409, "jobs_per_day_full", "You're already at your limit for that day.",
                       [f"{taken} of {cap} jobs accepted on {m.event_date}."])
    if db.query(Match).filter(Match.request_id == req.id, Match.id != m.id, Match.state == "accepted",
                              Match.service_snapshot == m.service_snapshot).first():
        raise ApiError(409, "service_filled", "Another vendor has already taken this service.")
    _decide(m, "accepted")
    m.needs_reconfirm = False
    services.job_thread(db, m)
    for other in db.query(Match).filter(Match.request_id == req.id, Match.id != m.id,
                                        Match.state == "proposed",
                                        Match.service_snapshot == m.service_snapshot).all():
        other.state = "void"
    notify(db, req.organizer_id, "vendor_accepted",
           {"request_id": req.id, "match_id": m.id, "vendor": va.business_name})
    audit(db, user.id, "match_accepted", "match", m.id, after={"state": "accepted"})
    db.commit()
    return _match_out(db, m)


@router.post("/vendor/matches/{match_id}/decline", response_model=MatchForVendor)
def decline_match(match_id: str, user: User = Depends(require_role("vendor")),
                  db: Session = Depends(get_db), idempotency_key: str | None = Header(default=None)):
    va = _account(db, user)
    _need_approved(va)
    m = _own_match(db, va, match_id)
    if m.state != "proposed":
        raise ApiError(409, "wrong_state", "This match can't be declined right now.",
                       [f"Match is {m.state}."])
    _decide(m, "declined")
    audit(db, user.id, "match_declined", "match", m.id, after={"state": "declined"})
    db.commit()
    return _match_out(db, m)


@router.post("/vendor/matches/{match_id}/undo", response_model=MatchForVendor)
def undo_match(match_id: str, user: User = Depends(require_role("vendor")),
               db: Session = Depends(get_db), idempotency_key: str | None = Header(default=None)):
    va = _account(db, user)
    _need_approved(va)
    m = _own_match(db, va, match_id)
    if m.state not in ("declined", "accepted"):
        raise ApiError(409, "wrong_state", "There's nothing to undo on this match.",
                       [f"Match is {m.state}."])
    req = _lock_for_decision(db, va, m)
    db.refresh(m)
    if m.state not in ("declined", "accepted"):
        raise ApiError(409, "wrong_state", "There's nothing to undo on this match.",
                       [f"Match is {m.state}."])
    if m.event_date <= today() or req is None or not _still_fits(db, m, va, req):
        raise ApiError(409, "no_longer_fits", "This match no longer fits, so it can't be reopened.")
    before = m.state
    m.state = "proposed"
    m.decided_at = None
    audit(db, user.id, "match_undo", "match", m.id, before={"state": before}, after={"state": "proposed"})
    db.commit()
    return _match_out(db, m)


# --- jobs ----------------------------------------------------------------------------------

@router.get("/vendor/jobs", response_model=JobList)
def list_jobs(user: User = Depends(require_role("vendor")), db: Session = Depends(get_db)):
    va = _account(db, user)
    matches = db.query(Match).filter(Match.vendor_account_id == va.id, Match.state == "accepted").all()
    jobs = []
    for m in _sorted_matches(db, matches):
        req = db.get(Request, m.request_id)
        org = db.get(User, req.organizer_id)
        thread = services.job_thread(db, m)
        jobs.append(Job(**_match_dict(db, m), thread_id=thread.id,
                        organizer_display_name=org.display_name if org else "Organizer",
                        reminder=REMINDER))
    db.commit()  # job_thread may create a missing thread
    return JobList(jobs=jobs)


@router.post("/vendor/jobs/{match_id}/withdraw", response_model=MatchForVendor)
def withdraw_job(match_id: str, body: WithdrawInput, user: User = Depends(require_role("vendor")),
                 db: Session = Depends(get_db), idempotency_key: str | None = Header(default=None)):
    va = _account(db, user)
    m = _own_match(db, va, match_id)
    if m.state != "accepted":
        raise ApiError(409, "wrong_state", "Only an accepted job can be withdrawn.",
                       [f"Match is {m.state}."])
    req = db.get(Request, m.request_id)
    _decide(m, "withdrawn")
    thread = services.job_thread(db, m)
    db.add(Message(id=new_id("msg"), thread_id=thread.id, author_id=user.id, author_role="vendor",
                   body=body.reason))
    notify(db, req.organizer_id, "vendor_withdrew",
           {"request_id": req.id, "match_id": m.id, "vendor": va.business_name, "reason": body.reason})
    db.flush()
    services.rematch_request(db, req)
    audit(db, user.id, "job_withdrawn", "match", m.id, before={"state": "accepted"},
          after={"state": "withdrawn"})
    db.commit()
    return _match_out(db, m)
