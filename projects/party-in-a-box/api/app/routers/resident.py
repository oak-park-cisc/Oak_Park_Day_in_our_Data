"""Resident endpoints. Implements docs/api/resident.openapi.yaml."""
from datetime import date as _date

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from .. import rules as R
from .. import services as S
from ..blocks import get_index
from ..config import load_rules, today
from ..db import ChangeRequest, Message, Request, Signature, User, audit, get_db, new_id, new_token, notify
from ..errors import ApiError
from ..schemas_resident import ChangeRequestInput, RequestInput, RequestPatch, StrikeIn
from ..auth import require_role

router = APIRouter()
resident = Depends(require_role("resident"))


# --- helpers --------------------------------------------------------------------------------

def _valid_date(s: str) -> bool:
    try:
        _date.fromisoformat(s)
        return True
    except ValueError:
        return False


def _validate_event(db: Session, block_id: str, start: str, end: str, exclude_id: str | None = None) -> dict:
    """Shared create/patch checks. Returns the rules dict; raises ApiError(422)."""
    block = get_index().by_id.get(block_id)
    if block is None:
        raise ApiError(422, "unknown_block", "That block isn't in the street data.", [block_id])
    if not block["eligible"]:
        raise ApiError(422, "block_ineligible", "This block can't be closed.", [block["reason"]])
    if not (_valid_date(start) and _valid_date(end)):
        raise ApiError(422, "invalid_dates", "Those dates aren't valid.", ["Dates must be real calendar dates"])
    rules = load_rules()
    problems = R.season_problems(start, end, rules)
    if problems:
        raise ApiError(422, "out_of_season", "Those dates aren't in the block party season.", problems)
    mx = rules["max_events_per_block_per_year"]
    if S.block_year_count(db, block_id, int(start[:4]), exclude_id=exclude_id) >= mx:
        raise ApiError(422, "block_year_max", f"This block already has {mx} events in {start[:4]}.",
                       [f"This block already has {mx} events in {start[:4]}."])
    return rules


def _owned(db: Session, request_id: str, user: User) -> Request:
    req = S.get_request_or_404(db, request_id)
    S.ensure_owner(req, user)
    return req


def _cr_out(cr: ChangeRequest) -> dict:
    return {"id": cr.id, "request_id": cr.request_id, "type": cr.type, "proposed_start": cr.proposed_start,
            "proposed_end": cr.proposed_end, "message": cr.message, "status": cr.status,
            "new_date": cr.new_date,
            "created_at": cr.created_at.isoformat() if cr.created_at else None,
            "resolved_at": cr.resolved_at.isoformat() if cr.resolved_at else None}


def _open_cr(db: Session, req: Request) -> ChangeRequest | None:
    return (db.query(ChangeRequest).filter(ChangeRequest.request_id == req.id, ChangeRequest.status == "open")
            .order_by(ChangeRequest.created_at.desc()).first())


def _card(db: Session, req: Request) -> dict:
    pet = S.recount_signatures(db, req)
    year = int((req.approved_date or req.date_start)[:4])
    from ..db import Thread
    vthread = db.query(Thread).filter(Thread.kind == "request", Thread.request_id == req.id).first()
    cr = _open_cr(db, req)
    return {**S.request_out(req), "stepper": S.stepper(db, req, pet["count"]), "distinct_count": pet["count"],
            "block_year_used": S.block_year_count(db, req.block_id, year, exclude_id=req.id) + 1,
            "village_thread_id": vthread.id if vthread else None,
            "open_change_request": _cr_out(cr) if cr else None,
            "vendors": S.vendors_for_request(db, req) if req.status == "approved" else []}


def _notify_reviewers(db: Session, template: str, payload: dict) -> None:
    for u in db.query(User).filter(User.role.in_(["reviewer", "admin"])).all():
        notify(db, u.id, template, payload)


def _address(sig: Signature) -> str:
    return f"{sig.house_number} {sig.street.title()}"


def _sig_row(sig: Signature) -> dict:
    return {"id": sig.id, "name": sig.name, "address": _address(sig),
            "signed_at": sig.created_at.isoformat() if sig.created_at else None,
            "counts": sig.state == "counted", "state": sig.state}


# --- requests -------------------------------------------------------------------------------

@router.post("/requests", status_code=201)
def create_request(body: RequestInput, user: User = resident, db: Session = Depends(get_db)):
    rules = _validate_event(db, body.block_id, body.date_start, body.date_end)
    req = Request(id=new_id("r"), organizer_id=user.id, block_id=body.block_id, kind="party",
                  date_start=body.date_start, date_end=body.date_end, guests=body.guests,
                  services=body.services.model_dump(), status="draft",
                  petition_due=R.petition_due(body.date_start, rules["petition_lead_days"]),
                  rules_year=rules["rules_year"], version=1)
    db.add(req)
    db.flush()
    audit(db, user.id, "create", "request", req.id, after={"status": "draft"})
    db.commit()
    return S.request_out(req)


@router.get("/me/requests")
def my_requests(user: User = resident, db: Session = Depends(get_db)):
    rows = (db.query(Request).filter(Request.organizer_id == user.id)
            .order_by(Request.created_at.desc(), Request.id.desc()).all())
    cards = [_card(db, r) for r in rows]
    db.commit()
    return {"requests": cards}


@router.get("/requests/{request_id}")
def get_request(request_id: str, user: User = resident, db: Session = Depends(get_db)):
    req = _owned(db, request_id, user)
    card = _card(db, req)
    db.commit()
    return card


@router.patch("/requests/{request_id}")
def update_request(request_id: str, body: RequestPatch, user: User = resident,
                   if_match: str | None = Header(default=None), db: Session = Depends(get_db)):
    req = _owned(db, request_id, user)
    if req.status not in ("draft", "collecting"):
        raise ApiError(409, "wrong_status", "Only draft or collecting requests can be edited.")
    if if_match is not None and if_match.strip().strip('"') != str(req.version):
        raise ApiError(409, "stale_version", "This request changed. Reload and try again.")
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise ApiError(422, "validation_error", "Nothing to change.", ["at least one field is required"])
    start = changes.get("date_start", req.date_start)
    end = changes.get("date_end", req.date_end)
    rules = _validate_event(db, req.block_id, start, end, exclude_id=req.id)
    req.date_start, req.date_end = start, end
    if "guests" in changes:
        req.guests = changes["guests"]
    if "services" in changes:
        req.services = changes["services"]
    req.petition_due = R.petition_due(start, rules["petition_lead_days"])
    req.version += 1
    audit(db, user.id, "update", "request", req.id, after=changes)
    db.commit()
    return S.request_out(req)


@router.post("/requests/{request_id}/petition")
def start_petition(request_id: str, user: User = resident, db: Session = Depends(get_db)):
    req = _owned(db, request_id, user)
    if req.status == "draft":
        req.status = "collecting"
        if not req.petition_token:
            req.petition_token = new_token()
        req.version += 1
        audit(db, user.id, "start_petition", "request", req.id, before={"status": "draft"},
              after={"status": "collecting"})
        db.commit()
    elif req.status != "collecting":
        raise ApiError(409, "wrong_status", "The petition can't be started from this status.")
    return {"petition_url": S.petition_url(req), "petition_due": req.petition_due, "status": req.status}


@router.get("/requests/{request_id}/signatures")
def list_signatures(request_id: str, user: User = resident, db: Session = Depends(get_db)):
    req = _owned(db, request_id, user)
    pet = S.recount_signatures(db, req)
    sigs = (db.query(Signature).filter(Signature.request_id == req.id)
            .order_by(Signature.created_at, Signature.id).all())
    db.commit()
    return {"distinct_count": pet["count"], "needed": pet["needed"], "petition_due": req.petition_due,
            "signatures": [_sig_row(s) for s in sigs]}


@router.post("/requests/{request_id}/signatures/{signature_id}/strike")
def strike_signature(request_id: str, signature_id: str, body: StrikeIn | None = None,
                     user: User = resident, db: Session = Depends(get_db)):
    req = _owned(db, request_id, user)
    sig = db.get(Signature, signature_id)
    if sig is None or sig.request_id != req.id:
        raise ApiError(404, "not_found", "Signature not found.")
    before = sig.state
    sig.state = "struck"
    db.flush()
    S.recount_signatures(db, req)
    audit(db, user.id, "strike_signature", "signature", sig.id, before={"state": before},
          after={"state": "struck", "reason": body.reason if body else None})
    db.commit()
    return _sig_row(sig)


@router.post("/requests/{request_id}/submit")
def submit_request(request_id: str, user: User = resident, db: Session = Depends(get_db)):
    req = _owned(db, request_id, user)
    if req.status != "collecting":
        raise ApiError(409, "wrong_status", "Only a request that is collecting signatures can be submitted.")
    pet = S.recount_signatures(db, req)
    reasons = []
    if pet["count"] < pet["needed"]:
        n = pet["needed"] - pet["count"]
        reasons.append(f"Needs {n} more address{'' if n == 1 else 'es'} ({pet['count']} of {pet['needed']}).")
    if req.petition_due and today() > req.petition_due:
        reasons.append(f"The petition was due {req.petition_due}.")
    if reasons:
        db.commit()  # keep refreshed signature states
        raise ApiError(422, "submit_blocked", "Can't submit yet.", reasons)
    req.status = "submitted"
    req.submitted_at = S.now()
    req.version += 1
    S.request_thread(db, req)
    _notify_reviewers(db, "request_submitted", {"request_id": req.id})
    audit(db, user.id, "submit", "request", req.id, before={"status": "collecting"},
          after={"status": "submitted"})
    db.commit()
    return S.request_out(req)


@router.post("/requests/{request_id}/withdraw")
def withdraw_request(request_id: str, user: User = resident, db: Session = Depends(get_db)):
    req = _owned(db, request_id, user)
    if req.status not in ("draft", "collecting", "submitted"):
        raise ApiError(409, "already_decided",
                       "This request was already decided. Ask Public Works for a change instead.")
    before = req.status
    req.status = "withdrawn"
    req.version += 1
    audit(db, user.id, "withdraw", "request", req.id, before={"status": before}, after={"status": "withdrawn"})
    db.commit()
    return S.request_out(req)


@router.post("/requests/{request_id}/change-requests", status_code=201)
def create_change_request(request_id: str, body: ChangeRequestInput, user: User = resident,
                          db: Session = Depends(get_db)):
    req = _owned(db, request_id, user)
    if req.status != "approved":
        raise ApiError(409, "wrong_status", "Only an approved event can have a change request.")
    if _open_cr(db, req) is not None:
        raise ApiError(409, "open_change_request", "You already have an open change request.")
    if body.type == "reschedule":
        if not body.proposed_start or not body.proposed_end:
            raise ApiError(422, "validation_error", "Pick the new dates.",
                           ["proposed_start and proposed_end are required to reschedule"])
        if not (_valid_date(body.proposed_start) and _valid_date(body.proposed_end)):
            raise ApiError(422, "invalid_dates", "Those dates aren't valid.", ["Dates must be real calendar dates"])
        if body.proposed_start > body.proposed_end:
            raise ApiError(422, "invalid_dates", "End date is before start date.",
                           ["End date is before start date"])
        start, end = body.proposed_start, body.proposed_end
    else:
        start, end = req.approved_date, None
    cr = ChangeRequest(id=new_id("cr"), request_id=req.id, type=body.type, proposed_start=start,
                       proposed_end=end, message=body.message, status="open")
    db.add(cr)
    thread = S.request_thread(db, req)
    db.add(Message(id=new_id("msg"), thread_id=thread.id, author_id=user.id, author_role="resident",
                   body=body.message))
    _notify_reviewers(db, "change_request_filed", {"request_id": req.id, "type": body.type})
    audit(db, user.id, "change_request", "request", req.id, after={"type": body.type})
    db.commit()
    db.refresh(cr)
    return _cr_out(cr)
