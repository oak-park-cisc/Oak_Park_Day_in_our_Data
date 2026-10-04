"""Public endpoints (no account). Implements docs/api/resident.openapi.yaml (Public tag)."""
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import rules as R
from .. import services as S
from ..blocks import get_index
from ..config import load_rules, today
from ..db import Request, Signature, User, get_db, new_id
from ..errors import ApiError
from ..schemas_resident import DateChecksIn, SignIn

router = APIRouter()

RATE_LIMIT_PER_MIN = 20


def hours_label(rules: dict) -> str:
    def fmt(hhmm: str) -> str:
        h, m = (int(x) for x in hhmm.split(":"))
        suffix = "a.m." if h < 12 else "p.m."
        h12 = h % 12 or 12
        return f"{h12} {suffix}" if m == 0 else f"{h12}:{m:02d} {suffix}"
    return f"{fmt(rules['hours']['start'])} – {fmt(rules['hours']['end'])}"


@router.get("/rules")
def get_rules(year: int | None = None):
    # The next year's rules aren't published yet; always return the current file.
    return load_rules()


@router.get("/blocks/lookup")
def lookup_block(address: str = ""):
    found = get_index().find_block(address[:120])
    if found is None:
        raise ApiError(404, "not_found", "We couldn't find that address in Oak Park.")
    block, number = found
    return {"block": get_index().summary(block), "number": number}


@router.get("/blocks/{block_id}")
def get_block(block_id: str):
    block = get_index().by_id.get(block_id)
    if block is None:
        raise ApiError(404, "not_found", "Block not found.")
    return {**get_index().summary(block), "centroid": block["centroid"], "lines": block["lines"],
            "data_version": block.get("data_version") or "fallback"}


@router.post("/checks/dates")
def check_dates(body: DateChecksIn, db: Session = Depends(get_db)):
    block = get_index().by_id.get(body.block_id)
    if block is None:
        raise ApiError(422, "unknown_block", "That block isn't in the street data.", [body.block_id])
    if body.date_start > body.date_end:
        raise ApiError(422, "invalid_dates", "End date is before start date.",
                       ["End date is before start date"])
    try:
        R._d(body.date_start), R._d(body.date_end)
    except ValueError:
        raise ApiError(422, "invalid_dates", "Those dates aren't valid.", ["Dates must be real calendar dates"])
    rules = load_rules()
    due = R.petition_due(body.date_start, rules["petition_lead_days"])
    problems = R.season_problems(body.date_start, body.date_end, rules)
    return {"petition_due": due, "due_passed": due < today(),
            "season": {"ok": not problems, "problems": problems},
            "block_year_count": S.block_year_count(db, body.block_id, int(body.date_start[:4])),
            "max_per_block_per_year": rules["max_events_per_block_per_year"]}


def _petition_request(db: Session, token: str) -> Request:
    req = db.query(Request).filter(Request.petition_token == token).first()
    if req is None:
        raise ApiError(404, "not_found", "Petition not found.")
    if req.status != "collecting":
        raise ApiError(410, "petition_closed", "This petition is closed.")
    return req


@router.get("/petitions/{token}")
def get_petition(token: str, db: Session = Depends(get_db)):
    req = _petition_request(db, token)
    pet = S.recount_signatures(db, req)
    organizer = db.get(User, req.organizer_id)
    db.commit()
    return {"block_label": S.block_label(req.block_id), "date_start": req.date_start,
            "date_end": req.date_end, "hours": hours_label(load_rules()),
            "barricades": bool((req.services or {}).get("barricades")),
            "organizer_display_name": organizer.display_name if organizer else "",
            "distinct_count": pet["count"], "needed": pet["needed"], "open": req.status == "collecting"}


@router.post("/petitions/{token}/signatures", status_code=201)
def sign_petition(token: str, body: SignIn, db: Session = Depends(get_db)):
    req = _petition_request(db, token)
    if body.consent is not True:
        raise ApiError(422, "consent_required", "Please agree before signing.", ["consent must be true"])
    if not body.captcha.strip():
        raise ApiError(422, "captcha_required", "Please complete the check.", ["captcha is required"])
    recent = db.query(Signature).filter(
        Signature.request_id == req.id, Signature.created_at > S.now() - timedelta(minutes=1)).count()
    if recent >= RATE_LIMIT_PER_MIN:
        raise ApiError(429, "rate_limited", "Too many signatures just now. Try again in a minute.")
    block = S.block_for(req)
    sig = Signature(id=new_id("sig"), request_id=req.id, name=body.name.strip(),
                    house_number=body.house_number.strip(), street=block["name"],
                    email=body.email, state="counted")
    db.add(sig)
    db.flush()
    pet = S.recount_signatures(db, req)
    db.commit()
    return {"state": sig.state, "distinct_count": pet["count"], "needed": pet["needed"]}
