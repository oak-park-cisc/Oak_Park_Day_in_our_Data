"""Village reviewer endpoints, including /ai/explain. Implements docs/api/village.openapi.yaml."""
from __future__ import annotations

import csv
import io
import time
from collections import defaultdict, deque
from datetime import date as _date
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, Header, Query, Response, UploadFile
from sqlalchemy.orm import Session

from .. import ai, rules, services
from ..blocks import get_index
from ..config import load_rules, today
from ..db import (ChangeRequest, Match, Message, Offer, PaperPetition, Request, User, VendorAccount,
                  audit, new_id, notify)
from ..db import get_db
from ..auth import require_role
from ..errors import ApiError
from ..schemas_village import (AiExplainIn, AiExplainOut, ApproveIn, RejectIn, ResolveIn, VendorInviteIn,
                               VendorStatusIn, WhatIfIn)

router = APIRouter()

Reviewer = Depends(require_role("reviewer"))
HIDDEN_STATUSES = {"draft", "collecting"}
NO_LEVEL_STATUSES = {"rejected", "withdrawn", "cancelled"}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# --- helpers -------------------------------------------------------------------------------

def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def _parse_date(value: str, field: str = "date") -> _date:
    try:
        return _date.fromisoformat(value)
    except (ValueError, TypeError):
        raise ApiError(422, "validation_error", "Some fields are invalid.", [f"{field}: use YYYY-MM-DD"])


def _range_label(start: str, end: str) -> str:
    s, e = _date.fromisoformat(start), _date.fromisoformat(end)
    if s == e:
        return f"{MONTHS[s.month - 1]} {s.day}, {s.year}"
    if (s.year, s.month) == (e.year, e.month):
        return f"{MONTHS[s.month - 1]} {s.day} – {e.day}, {s.year}"
    if s.year == e.year:
        return f"{MONTHS[s.month - 1]} {s.day} – {MONTHS[e.month - 1]} {e.day}, {s.year}"
    return f"{MONTHS[s.month - 1]} {s.day}, {s.year} – {MONTHS[e.month - 1]} {e.day}, {e.year}"


def _candidates(req: Request) -> list[str]:
    return rules.candidate_dates(req.date_start, req.date_end, load_rules())


def _barricade(d: str) -> str:
    return (_date.fromisoformat(d) - timedelta(days=1)).isoformat()


def _version_matches(if_match: str | None, req: Request) -> bool:
    if if_match is None:
        return True
    v = if_match.strip()
    if v.startswith("W/"):
        v = v[2:]
    return v.strip('"') == str(req.version)


def _change_out(cr: ChangeRequest) -> dict:
    return {"id": cr.id, "request_id": cr.request_id, "type": cr.type, "proposed_start": cr.proposed_start,
            "proposed_end": cr.proposed_end, "message": cr.message, "status": cr.status,
            "new_date": cr.new_date, "created_at": _iso(cr.created_at), "resolved_at": _iso(cr.resolved_at)}


def _raise_for_reasons(reasons: list[str]) -> None:
    """Map approve-gate failures to 409 (cap, block-year) or 422."""
    if any(r.startswith("Weekend is at ") for r in reasons):
        raise ApiError(409, "cap_reached", "This weekend is full.", reasons)
    if any(r.startswith("This block already has ") for r in reasons):
        raise ApiError(409, "block_year_max", "This block already has the maximum events this year.", reasons)
    raise ApiError(422, "cannot_approve", "Can't approve yet.", reasons)


def _slot_adjust(db: Session, date: str | None, delta: int) -> None:
    key = rules.weekend_key(date) if date else None
    if key:
        slot = services.lock_weekend(db, key)
        slot.approved_count = max(0, slot.approved_count + delta)
        slot.version += 1


def _school_list(block: dict) -> list[dict]:
    s = block.get("school_nearby")
    items = [] if not s else (s if isinstance(s, list) else [s])
    return [{"name": x["name"], "lat": x["lat"], "lon": x["lon"]} for x in items]


def _is_weekday(date: str) -> bool:
    return rules.day_class(date) == "weekday"


# --- queue ---------------------------------------------------------------------------------

@router.get("/village/requests")
def list_requests(status: Literal["draft", "collecting", "submitted", "approved", "rejected", "withdrawn",
                                  "cancelled", "completed"] | None = None,
                  sort: Literal["submitted_at"] = "submitted_at",
                  db: Session = Depends(get_db), user: User = Reviewer):
    rows = [r for r in db.query(Request).all() if r.status not in HIDDEN_STATUSES]
    facets = {"all": len(rows), "needs_review": sum(r.status == "submitted" for r in rows),
              "approved": sum(r.status == "approved" for r in rows),
              "rejected": sum(r.status == "rejected" for r in rows)}
    if status:
        rows = [r for r in rows if r.status == status]
    rows.sort(key=lambda r: (r.submitted_at is None, r.submitted_at.isoformat() if r.submitted_at else "", r.id))
    items = []
    approved = services.approved_requests(db)  # loaded once, passed through to every row
    submitted = [r for r in rows if r.status == "submitted"] if status in (None, "submitted") else \
        db.query(Request).filter(Request.status == "submitted").all()
    for r in rows:
        level = None
        if r.status not in NO_LEVEL_STATUSES:
            cands = _candidates(r)
            if cands:
                level = services.score_request_on(db, r, cands[0], approved=approved,
                                                  submitted=submitted)["level"]
        items.append({"id": r.id, "block_id": r.block_id, "block_label": services.block_label(r.block_id),
                      "range_label": _range_label(r.date_start, r.date_end), "date_start": r.date_start,
                      "date_end": r.date_end, "status": r.status,
                      "distinct_count": services.recount_signatures(db, r)["count"],
                      "needed": load_rules()["petition_min_addresses"], "level": level,
                      "submitted_at": _iso(r.submitted_at)})
    return {"items": items, "facets": facets}


# --- detail --------------------------------------------------------------------------------

def _dry_run_vendors(db: Session, req: Request, date: str) -> list[dict]:
    hits = rules.match({"date": date, "guests": req.guests, "zip": services.block_for(req).get("zip")},
                       services._offer_inputs(db, req, date))
    out = []
    for h in hits:
        va = db.get(VendorAccount, h["vendor_account_id"])
        offer = db.get(Offer, h["vendor_account_id"])
        out.append({"name": va.business_name, "service": offer.service, "price_usd": offer.price_usd,
                    "state": "Matches (sees it after approval)"})
    return out


@router.get("/village/requests/{request_id}")
def request_detail(request_id: str, db: Session = Depends(get_db), user: User = Reviewer):
    req = services.get_request_or_404(db, request_id)
    cfg = load_rules()
    block = services.block_for(req)
    cands = _candidates(req)
    pet = services.recount_signatures(db, req)
    focus = req.approved_date or (cands[0] if cands else req.date_start)
    focus_fixed = req.approved_date is not None

    not_submitted = {"ok": False, "reasons": ["Only submitted requests can be approved."]}
    gates = {d: (services.approval_check(db, req, d) if req.status == "submitted" else not_submitted)
             for d in cands}
    can_approve = gates[cands[0]] if cands else not_submitted

    older = []
    if req.submitted_at:
        older = [r for r in db.query(Request).filter(Request.status == "submitted", Request.id != req.id).all()
                 if r.submitted_at and r.submitted_at < req.submitted_at]
    others_pending = [r for r in db.query(Request).filter(Request.status == "submitted", Request.id != req.id).all()]
    other_cands = {r.id: _candidates(r) for r in others_pending}
    cap = cfg["max_events_per_weekend"]

    cand_out, scores = [], {}
    approved_all = services.approved_requests(db)
    for d in cands:
        key = rules.weekend_key(d)
        approved = services.weekend_approved_count(db, key, approved_all) or 0
        pending = sum(1 for r in others_pending if d in other_cands[r.id])
        score = services.score_request_on(db, req, d, approved=approved_all, submitted=others_pending)
        scores[d] = score
        competing = 0
        for r in older:
            keys = {rules.weekend_key(x) or x for x in other_cands[r.id]}
            if keys == {key or d}:
                competing += 1
        cand_out.append({"date": d, "weekend_approved": approved, "weekend_pending": pending, "cap": cap,
                         "score": score, "older_pending_competing": (cap - approved) < competing,
                         "can_approve": gates[d]})

    if not focus_fixed and scores:  # impact map follows the candidate with the highest score
        focus = max(cands, key=lambda c: (scores[c]["score"], -cands.index(c)))
    if focus not in scores:
        scores[focus] = services.score_request_on(db, req, focus)
    others, seen = [], set()
    for r in services.closures_on_weekend(db, focus, exclude_id=req.id):
        seen.add(r.id)
        others.append({"block_id": r.block_id, "block_label": services.block_label(r.block_id), "status": r.status})
    for r in others_pending:
        if r.id not in seen and focus in other_cands[r.id]:
            others.append({"block_id": r.block_id, "block_label": services.block_label(r.block_id),
                           "status": "submitted"})
    impact = {"this": {"block_id": req.block_id, "level": scores[focus]["level"]},
              "others_same_weekend": others,
              "bus_stops": [{"stop_id": s["stop_id"], "lat": s["lat"], "lon": s["lon"],
                             "weekday_trips": s["weekday_trips"]} for s in block.get("bus_stop_list", [])],
              "schools": _school_list(block)}

    if req.status == "approved":
        vendors = [{"name": v["name"], "service": v["service"], "price_usd": v["price_usd"], "state": v["state"]}
                   for v in services.vendors_for_request(db, req)]
    elif req.status == "submitted" and cands:
        vendors = _dry_run_vendors(db, req, cands[0])
    else:
        vendors = []

    thread = services.request_thread(db, req)
    changes = (db.query(ChangeRequest).filter(ChangeRequest.request_id == req.id)
               .order_by(ChangeRequest.created_at, ChangeRequest.id).all())
    organizer = db.get(User, req.organizer_id)
    out = {"id": req.id, "block_id": req.block_id, "block_label": services.block_label(req.block_id),
           "date_start": req.date_start, "date_end": req.date_end, "guests": req.guests,
           "services": req.services, "status": req.status, "approved_date": req.approved_date,
           "submitted_at": _iso(req.submitted_at), "version": str(req.version),
           "organizer_display_name": organizer.display_name if organizer else "",
           "distinct_count": pet["count"], "can_approve": can_approve, "candidates": cand_out,
           "impact_map": impact, "vendors": vendors, "thread_id": thread.id,
           "change_requests": [_change_out(c) for c in changes]}
    db.commit()  # persists recomputed signature states and a lazily created thread
    return out


# --- approve / reject ----------------------------------------------------------------------

@router.post("/village/requests/{request_id}/approve")
def approve(request_id: str, body: ApproveIn, if_match: str | None = Header(default=None),
            db: Session = Depends(get_db), user: User = Reviewer):
    req = services.get_request_or_404(db, request_id)
    _parse_date(body.date)
    key = rules.weekend_key(body.date)
    slot = services.lock_weekend(db, key) if key else None
    services.lock_block_requests(db, req.block_id)
    db.refresh(req)
    if not _version_matches(if_match, req):
        db.rollback()
        raise ApiError(409, "stale_version", "This request changed. Reload and try again.")
    if body.date not in _candidates(req):
        db.rollback()
        raise ApiError(422, "not_a_candidate", "That date isn't one of the request's candidate dates.",
                       [f"{body.date} is not a candidate date"])
    check = services.approval_check(db, req, body.date)
    if not check["ok"]:
        db.rollback()
        _raise_for_reasons(check["reasons"])
    score = services.score_request_on(db, req, body.date)
    before = {"status": req.status, "version": req.version}
    req.status, req.approved_date = "approved", body.date
    req.decided_at, req.decided_by = services.now(), user.id
    req.decision_snapshot = {"can_approve": check, "score": score, "rules_year": req.rules_year,
                             "data_version": load_rules().get("data_version") or f"blocks-{len(get_index())}"}
    req.version += 1
    if slot is not None:
        slot.approved_count += 1
        slot.version += 1
    db.flush()
    services.rematch_request(db, req)
    notify(db, req.organizer_id, "request_approved",
           {"request_id": req.id, "date": body.date, "barricade_date": _barricade(body.date)})
    audit(db, user.id, "approve", "request", req.id, before=before,
          after={"status": "approved", "approved_date": body.date, "version": req.version})
    db.commit()
    return services.request_out(req)


@router.post("/village/requests/{request_id}/reject")
def reject(request_id: str, body: RejectIn, if_match: str | None = Header(default=None),
           db: Session = Depends(get_db), user: User = Reviewer):
    req = services.get_request_or_404(db, request_id)
    if not _version_matches(if_match, req):
        raise ApiError(409, "stale_version", "This request changed. Reload and try again.")
    if req.status != "submitted":
        raise ApiError(409, "invalid_state", "Only submitted requests can be rejected.")
    before = {"status": req.status, "version": req.version}
    req.status, req.reject_reason = "rejected", body.reason
    req.decided_at, req.decided_by = services.now(), user.id
    req.version += 1
    notify(db, req.organizer_id, "request_rejected", {"request_id": req.id, "reason": body.reason})
    audit(db, user.id, "reject", "request", req.id, before=before,
          after={"status": "rejected", "reject_reason": body.reason, "version": req.version})
    db.commit()
    return services.request_out(req)


# --- change requests -----------------------------------------------------------------------

@router.post("/village/change-requests/{change_id}/resolve")
def resolve_change(change_id: str, body: ResolveIn, if_match: str | None = Header(default=None),
                   db: Session = Depends(get_db), user: User = Reviewer):
    cr = db.get(ChangeRequest, change_id)
    if cr is None:
        raise ApiError(404, "not_found", "Change request not found.")
    if cr.status != "open":
        raise ApiError(409, "already_resolved", "This change request is already resolved.")
    req = services.get_request_or_404(db, cr.request_id)
    if not _version_matches(if_match, req):
        raise ApiError(409, "stale_version", "This request changed. Reload and try again.")
    before = {"status": req.status, "approved_date": req.approved_date, "version": req.version}

    if body.decision == "decline":
        cr.status = "declined"
        req.version += 1
    elif cr.type == "cancel":
        if req.status == "approved":
            _slot_adjust(db, req.approved_date, -1)
        req.status = "cancelled"
        req.version += 1
        services.void_matches(db, req, "cancelled")
        cr.status = "accepted"
    else:
        if req.status != "approved":
            raise ApiError(409, "invalid_state", "Only approved requests can be rescheduled.")
        if not body.new_date:
            raise ApiError(422, "validation_error", "Some fields are invalid.", ["new_date: required to accept a reschedule"])
        _parse_date(body.new_date, "new_date")
        lo, hi = cr.proposed_start, cr.proposed_end or cr.proposed_start
        if not lo <= body.new_date <= hi:
            raise ApiError(422, "outside_proposed_range", "That date is outside the proposed range.",
                           [f"new_date must be between {lo} and {hi}"])
        old_date = req.approved_date
        new_key, old_key = rules.weekend_key(body.new_date), rules.weekend_key(old_date)
        for k in sorted({k for k in (new_key, old_key) if k}):
            services.lock_weekend(db, k)
        services.lock_block_requests(db, req.block_id)
        db.refresh(req)
        req.status = "submitted"  # approval_check treats this as a fresh request; restored below
        try:  # the request already holds a slot, so it must not count against its own weekend
            check = services.approval_check(db, req, body.new_date, exclude_self_from_weekend=True)
        finally:
            req.status = "approved"
        reasons = [r for r in check["reasons"] if r != "That date is outside the requested range."]
        if reasons:
            db.rollback()
            _raise_for_reasons(reasons)
        if new_key != old_key:
            _slot_adjust(db, old_date, -1)
            _slot_adjust(db, body.new_date, +1)
        req.approved_date = body.new_date
        req.version += 1
        db.flush()
        services.reconfirm_matches(db, req)
        cr.status, cr.new_date = "accepted", body.new_date

    cr.resolved_by, cr.resolved_at = user.id, services.now()
    if body.message:
        thread = services.request_thread(db, req)
        db.add(Message(id=new_id("msg"), thread_id=thread.id, author_id=user.id, author_role="village",
                       body=body.message))
    notify(db, req.organizer_id, "change_request_resolved",
           {"request_id": req.id, "change_request_id": cr.id, "decision": cr.status, "new_date": cr.new_date})
    audit(db, user.id, "resolve_change_request", "change_request", cr.id, before=before,
          after={"status": cr.status, "request_status": req.status, "approved_date": req.approved_date})
    db.commit()
    return _change_out(cr)


# --- paper petition ------------------------------------------------------------------------

@router.post("/village/requests/{request_id}/paper-petition")
def paper_petition(request_id: str, address_count: int = Form(ge=1, le=500),
                   file: UploadFile | None = File(default=None),
                   db: Session = Depends(get_db), user: User = Reviewer):
    req = services.get_request_or_404(db, request_id)
    if req.status not in ("collecting", "submitted"):
        raise ApiError(409, "invalid_state", "Paper petitions can only be attested while the request is open.")
    filename = file.filename if file is not None and file.filename else None
    pp = db.query(PaperPetition).filter(PaperPetition.request_id == req.id).first()
    before = {"address_count": pp.address_count} if pp else None
    if pp is None:
        pp = PaperPetition(id=new_id("pp"), request_id=req.id)
        db.add(pp)
    pp.address_count, pp.attested_by, pp.attested_at = address_count, user.id, services.now()
    if filename:
        pp.file_ref = filename
    db.flush()
    count = services.recount_signatures(db, req)["count"]
    audit(db, user.id, "attest_paper_petition", "request", req.id, before=before,
          after={"address_count": address_count, "file_ref": pp.file_ref})
    db.commit()
    return {"distinct_count": count, "attested_by": user.display_name, "attested_at": _iso(pp.attested_at)}


# --- day view ------------------------------------------------------------------------------

@router.get("/village/day")
def village_day(date: str | None = None, db: Session = Depends(get_db), user: User = Reviewer):
    d = date or today()
    _parse_date(d)
    reqs = (db.query(Request).filter(Request.status.in_(["approved", "completed"]),
                                     Request.approved_date == d).order_by(Request.id).all())
    parties, by_level, stops, vendor_names = [], {"low": 0, "medium": 0, "high": 0}, 0, set()
    for r in reqs:
        score = services.score_request_on(db, r, d)
        names = []
        for m in db.query(Match).filter(Match.request_id == r.id, Match.state == "accepted").order_by(Match.id).all():
            va = db.get(VendorAccount, m.vendor_account_id)
            names.append(va.business_name)
            vendor_names.add(va.id)
        by_level[score["level"]] += 1
        stops += len(services.block_for(r).get("bus_stop_list", []))
        blk = services.block_for(r)
        parties.append({"request_id": r.id, "block_id": r.block_id, "centroid": blk["centroid"],
                        "lines": blk["lines"], "block_label": services.block_label(r.block_id), "guests": r.guests,
                        "level": score["level"], "why": " · ".join(x["text"] for x in score["reasons"]),
                        "barricade_date": _barricade(d), "vendors": names})
    return {"date": d, "parties": parties,
            "totals": {"count": len(parties), "by_level": by_level, "bus_stops_closed": stops,
                       "vendors": len(vendor_names)}}


# --- what-if -------------------------------------------------------------------------------

@router.post("/village/whatif")
def whatif(body: WhatIfIn, db: Session = Depends(get_db), user: User = Reviewer):
    """Read-only: never writes."""
    d = _parse_date(body.date)
    idx, cfg = get_index(), load_rules()
    ids = list(dict.fromkeys(body.closures))
    blocks = []
    for bid in ids:
        b = idx.by_id.get(bid)
        if b is None:
            raise ApiError(422, "unknown_block", "That block isn't in the street data.", [bid])
        if not b["eligible"]:
            raise ApiError(422, "block_not_eligible", "That block can't be closed.",
                           [f"{idx.label(b)}: {b['reason']}"])
        blocks.append(b)
    is_weekday = _is_weekday(body.date) or body.treat_as_weekday
    score_date = body.date
    if body.treat_as_weekday and not _is_weekday(body.date):
        score_date = (d - timedelta(days=d.weekday()) + timedelta(days=2)).isoformat()  # Wednesday, same week
    approved = services.closures_on_weekend(db, body.date)
    approved_n = len(approved)
    wc = None if is_weekday else approved_n + len(blocks)
    approved_ids = {r.block_id for r in approved}
    per_block, items = [], []
    for b in blocks:
        near = {n["id"]: n for n in idx.neighbors(b["id"])}
        others = [near[i] for i in ids if i != b["id"] and i in near]
        others += [near[i] for i in approved_ids if i in near and i not in {o["id"] for o in others}]
        score = rules.traffic_score(b, score_date, {
            "other_closures": [{"label": o["label"], "distance_m": o["distance_m"],
                                "same_street": o["same_street"]} for o in others],
            "pending_nearby": [], "weekend_approved_count": wc, "rules": cfg})
        per_block.append({"block_id": b["id"], "block_label": idx.label(b), "centroid": b["centroid"],
                          "lines": b["lines"], "score": score})
        key = rules.weekend_key(body.date) or body.date
        alts = []
        for off in range(-14, 15):
            c = d + timedelta(days=off)
            if c.weekday() == 5 and c.isoformat() != key and not rules.season_problems(c.isoformat(), c.isoformat(), cfg):
                # Skip Saturdays that already have an approved closure next to this block.
                if any(r.block_id in near for r in services.closures_on_weekend(db, c.isoformat())):
                    continue
                alts.append((abs(off), c.isoformat()))
        items.append({"block_id": b["id"], "label": idx.label(b), "near_labels": [o["label"] for o in others],
                      "has_school": bool(b.get("school_nearby")),
                      "busy_trips": [s["weekday_trips"] for s in b.get("bus_stop_list", [])],
                      "alt_saturdays": [x[1] for x in sorted(alts)]})
    sug = rules.suggest(items, is_weekday)
    worst = max((p["score"] for p in per_block), key=lambda s: s["score"], default=None)
    return {"per_block": per_block, "worst": worst,
            "weekend_count": None if wc is None else {"count": wc, "cap": cfg["max_events_per_weekend"]},
            "suggestions": sug["suggestions"], "tips": sug["tips"]}


# --- AI explain ----------------------------------------------------------------------------

_ai_hits: dict[str, deque] = defaultdict(deque)
AI_LIMIT, AI_WINDOW_S = 20, 60.0


def _rate_limit(user_id: str) -> None:
    now_s = time.monotonic()
    q = _ai_hits[user_id]
    while q and now_s - q[0] > AI_WINDOW_S:
        q.popleft()
    if len(q) >= AI_LIMIT:
        raise ApiError(429, "rate_limited", "Too many requests. Try again in a minute.")
    q.append(now_s)


@router.post("/ai/explain", response_model=AiExplainOut)
def ai_explain(body: AiExplainIn, user: User = Reviewer):
    _rate_limit(user.id)
    return ai.explain(body.model_dump())


# --- vendors -------------------------------------------------------------------------------

def _vendor_out(db: Session, va: VendorAccount) -> dict:
    out = {"id": va.id, "business_name": va.business_name, "contact_email": va.contact_email,
           "status": va.status, "approved_at": _iso(va.approved_at)}
    offer = db.get(Offer, va.id)
    if offer:
        out["offer_summary"] = f"{offer.service} · ${offer.price_usd} · up to {offer.max_guests}"
    return out


@router.get("/village/vendors")
def list_vendors(db: Session = Depends(get_db), user: User = Reviewer):
    vs = db.query(VendorAccount).order_by(VendorAccount.created_at, VendorAccount.id).all()
    return {"vendors": [_vendor_out(db, v) for v in vs]}


@router.post("/village/vendors", status_code=201)
def invite_vendor(body: VendorInviteIn, db: Session = Depends(get_db), user: User = Reviewer):
    email = body.contact_email.strip()
    if any(v.contact_email.lower() == email.lower() for v in db.query(VendorAccount).all()):
        raise ApiError(409, "vendor_exists", "A vendor with that email already exists.")
    va = VendorAccount(id=new_id("va"), business_name=body.business_name.strip(), contact_email=email,
                       status="invited", created_by=user.id)
    db.add(va)
    db.flush()
    vu = User(id=new_id("u"), role="vendor", email=email, display_name=va.business_name,
              vendor_account_id=va.id, dev_token=f"dev-vendor-{va.id}")  # dev auth only
    db.add(vu)
    db.flush()
    notify(db, vu.id, "vendor_invited", {"vendor_account_id": va.id})
    audit(db, user.id, "invite_vendor", "vendor_account", va.id, after={"status": "invited"})
    db.commit()
    return _vendor_out(db, va)


@router.patch("/village/vendors/{vendor_id}")
def update_vendor(vendor_id: str, body: VendorStatusIn, db: Session = Depends(get_db), user: User = Reviewer):
    va = db.get(VendorAccount, vendor_id)
    if va is None:
        raise ApiError(404, "not_found", "Vendor not found.")
    before = {"status": va.status}
    vendor_users = db.query(User).filter(User.vendor_account_id == va.id).all()
    if body.status == "approved":
        va.status, va.approved_at = "approved", services.now()
        db.flush()
        services.rematch_vendor(db, va.id)
        for u in vendor_users:
            notify(db, u.id, "vendor_approved", {"vendor_account_id": va.id})
    else:
        va.status = "suspended"
        reviewers = db.query(User).filter(User.role.in_(["reviewer", "admin"])).all()
        for m in db.query(Match).filter(Match.vendor_account_id == va.id,
                                        Match.state.in_(["proposed", "accepted"])).all():
            if m.state == "proposed":
                m.state = "void"
                continue
            req = db.get(Request, m.request_id)
            payload = {"request_id": m.request_id, "vendor": va.business_name, "date": m.event_date}
            notify(db, req.organizer_id, "vendor_suspended", payload)
            for rv in reviewers:
                notify(db, rv.id, "vendor_suspended", payload)
        for u in vendor_users:
            notify(db, u.id, "vendor_suspended", {"vendor_account_id": va.id})
    audit(db, user.id, "vendor_status", "vendor_account", va.id, before=before, after={"status": va.status})
    db.commit()
    return _vendor_out(db, va)


# --- weekends ------------------------------------------------------------------------------

@router.get("/village/weekends")
def list_weekends(from_: str = Query(alias="from"), to: str = Query(),
                  db: Session = Depends(get_db), user: User = Reviewer):
    lo, hi = _parse_date(from_, "from"), _parse_date(to, "to")
    if hi < lo or (hi - lo).days > 800:
        raise ApiError(422, "validation_error", "Some fields are invalid.", ["to: must be on or after from, within 800 days"])
    cap = load_rules()["max_events_per_weekend"]
    approved: dict[str, int] = defaultdict(int)
    for r in db.query(Request).filter(Request.status.in_(services.CLOSURE_STATUSES)).all():
        k = rules.weekend_key(r.approved_date) if r.approved_date else None
        if k:
            approved[k] += 1
    pending: dict[str, int] = defaultdict(int)
    for r in db.query(Request).filter(Request.status == "submitted").all():
        for k in {rules.weekend_key(x) for x in _candidates(r)} - {None}:
            pending[k] += 1
    out, cur = [], lo + timedelta(days=(5 - lo.weekday()) % 7)
    while cur <= hi:
        k = cur.isoformat()
        out.append({"weekend_key": k, "approved": approved.get(k, 0), "pending": pending.get(k, 0), "cap": cap})
        cur += timedelta(days=7)
    return out


# --- CSV export ----------------------------------------------------------------------------

@router.get("/village/export/requests.csv")
def export_csv(db: Session = Depends(get_db), user: User = Reviewer):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["id", "block", "date_start", "date_end", "status", "approved_date", "guests",
                "distinct_addresses", "submitted_at"])
    rows = [r for r in db.query(Request).all() if r.status not in HIDDEN_STATUSES]
    rows.sort(key=lambda r: (r.submitted_at is None, r.submitted_at.isoformat() if r.submitted_at else "", r.id))
    for r in rows:
        w.writerow([r.id, services.block_label(r.block_id), r.date_start, r.date_end, r.status,
                    r.approved_date or "", r.guests, services.recount_signatures(db, r)["count"],
                    _iso(r.submitted_at) or ""])
    return Response(content=buf.getvalue(), media_type="text/csv")
