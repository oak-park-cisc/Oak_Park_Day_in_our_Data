"""Seed FICTIONAL sample data: `python -m app.seed`."""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from . import rules as R
from .blocks import get_index
from .config import load_rules
from .db import (Base, ChangeRequest, Match, Message, Notification, Offer, PaperPetition, SessionLocal,
                 Signature, Thread, User, VendorAccount, WeekendSlot, engine, new_id, Request, audit)


def _ts(day: str, hour: int = 12) -> datetime:
    return datetime.fromisoformat(f"{day}T{hour:02d}:00:00+00:00")


def _token(request_id: str) -> str:
    return hashlib.md5(request_id.encode()).hexdigest()


def run(rich: bool = False) -> dict:
    """Seed the database. `rich=True` (used by `python -m app.seed`) layers extra sample data on top of the
    small base set that the test-suite asserts against."""
    rules = load_rules()
    index = get_index()
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)  # tests: no Alembic on SQLite
    db = SessionLocal()
    try:
        for t in reversed(Base.metadata.sorted_tables):
            db.execute(t.delete())
        db.flush()
        db.add_all([
            VendorAccount(id="va_icecream", business_name="Sample Ice Cream Co.", status="approved",
                          contact_email="icecream@example.org", approved_at=_ts("2026-09-01")),
            VendorAccount(id="va_taco", business_name="Sample Taco Cart", status="approved",
                          contact_email="taco@example.org", approved_at=_ts("2026-09-01")),
            VendorAccount(id="va_bounce", business_name="Sample Bounce House Rentals", status="invited",
                          contact_email="bounce@example.org"),
        ])
        db.flush()
        users = [
            User(id="u_a", role="resident", email="organizer-a@example.org",
                 display_name="Sample Organizer A", dev_token="dev-resident-a"),
            User(id="u_b", role="resident", email="organizer-b@example.org",
                 display_name="Sample Organizer B", dev_token="dev-resident-b"),
            User(id="u_ice", role="vendor", email="icecream@example.org", display_name="Sample Ice Cream Co.",
                 vendor_account_id="va_icecream", dev_token="dev-vendor-icecream"),
            User(id="u_taco", role="vendor", email="taco@example.org", display_name="Sample Taco Cart",
                 vendor_account_id="va_taco", dev_token="dev-vendor-taco"),
            User(id="u_bounce", role="vendor", email="bounce@example.org",
                 display_name="Sample Bounce House Rentals",
                 vendor_account_id="va_bounce", dev_token="dev-vendor-bounce"),
            User(id="u_rev", role="reviewer", email="reviewer@example.org",
                 display_name="Sample Reviewer", dev_token="dev-reviewer"),
        ]
        db.add_all(users)
        db.add_all([
            Offer(vendor_account_id="va_icecream", service="ice_cream", price_usd=300, max_guests=150,
                  jobs_per_day=2, includes="Soft serve and popsicles, up to 3 hours",
                  days=["saturday", "sunday"], zips=["60302", "60304"], active=True),
            Offer(vendor_account_id="va_taco", service="food_truck", price_usd=250, max_guests=120,
                  jobs_per_day=1, includes="Taco cart with two proteins, up to 2 hours",
                  days=["saturday"], zips=["60302", "60304"], active=True),
        ])
        db.flush()

        # (id, organizer, block, start, end, guests, status, nsigs, submitted_at, extras)
        specs = [
            ("r1", "u_a", "S CUYLER AVE|1100", "2027-06-12", "2027-06-26", 120, "approved", 10,
             _ts("2026-10-01", 9), {"approved_date": "2027-06-19"}),
            ("r2", "u_b", "HIGHLAND AVE|1100", "2027-06-12", "2027-06-26", 80, "submitted", 10,
             _ts("2026-10-01", 15), {}),
            ("r3", "u_a", "S HARVEY AVE|1100", "2027-07-10", "2027-07-24", 60, "collecting", 4, None, {}),
            ("r5", "u_b", "S EAST AVE|600", "2027-07-10", "2027-07-17", 140, "submitted", 10,
             _ts("2026-10-02", 9), {}),
            ("r7", "u_b", "S TAYLOR AVE|1100", "2027-08-07", "2027-08-07", 50, "rejected", 10,
             _ts("2026-10-02", 15), {"reject_reason": "Weekend is at 30 of 30."}),
            ("r9", "u_a", "S SCOVILLE AVE|1100", "2027-08-14", "2027-08-28", 0, "draft", 0, None, {}),
        ]
        nsig = 0
        for k, (rid, org, bid, ds, de, guests, status, n, sub, extra) in enumerate(specs):
            block = index.by_id.get(bid)
            if block is None:
                print(f"WARNING: block {bid} not in index; inserting request {rid} anyway")
            req = Request(
                id=rid, organizer_id=org, block_id=bid, kind="party", date_start=ds, date_end=de,
                guests=guests or 60, services={"barricades": True, "green_kit": True}, status=status,
                petition_token=None if status == "draft" else _token(rid),
                created_at=_ts("2026-09-10", 8 + k),
                petition_due=R.petition_due(ds, rules["petition_lead_days"]),
                submitted_at=sub, rules_year=rules["rules_year"], version=1, **extra)
            if status in ("approved", "rejected"):
                req.decided_at = _ts("2026-10-03", 9)
                req.decided_by = "u_rev"
            db.add(req)
            lo = block["addr_lo"] if block else int(bid.split("|")[1])
            for i in range(n):
                db.add(Signature(id=f"sig_{rid}_{i + 1}", request_id=rid, name=f"Sample Neighbor {i + 1}",
                                 house_number=str(lo + i), street=block["name"] if block else bid.split("|")[0],
                                 state="counted", created_at=_ts("2026-09-20") + timedelta(minutes=i),
                                 consent_at=_ts("2026-09-20") + timedelta(minutes=i)))
                nsig += 1
        db.flush()

        db.add(WeekendSlot(weekend_key="2027-06-19", approved_count=1, version=1))

        offers = [
            {"vendor_account_id": "va_icecream", "status": "approved", "active": True, "service": "ice_cream",
             "max_guests": 150, "jobs_per_day": 2, "days": ["saturday", "sunday"], "zips": ["60302", "60304"],
             "accepted_on_date": 0, "already_matched": False, "service_filled": False},
            {"vendor_account_id": "va_taco", "status": "approved", "active": True, "service": "food_truck",
             "max_guests": 120, "jobs_per_day": 1, "days": ["saturday"], "zips": ["60302", "60304"],
             "accepted_on_date": 0, "already_matched": False, "service_filled": False},
        ]
        whys = {m["vendor_account_id"]: m["why"]
                for m in R.match({"date": "2027-06-19", "guests": 120,
                                  "zip": (index.by_id.get("S CUYLER AVE|1100") or {}).get("zip")}, offers)}
        db.add(Match(id="m_r1_ice", request_id="r1", vendor_account_id="va_icecream", event_date="2027-06-19",
                     state="accepted", why=whys["va_icecream"], price_snapshot=300,
                     includes_snapshot="Soft serve and popsicles, up to 3 hours", service_snapshot="ice_cream",
                     decided_at=_ts("2026-10-03", 10)))
        db.add(Match(id="m_r1_taco", request_id="r1", vendor_account_id="va_taco", event_date="2027-06-19",
                     state="proposed", why=whys["va_taco"], price_snapshot=250,
                     includes_snapshot="Taco cart with two proteins, up to 2 hours",
                     service_snapshot="food_truck"))
        db.flush()

        db.add_all([Thread(id="t_r1", kind="request", request_id="r1"),
                    Thread(id="t_r2", kind="request", request_id="r2"),
                    Thread(id="t_r1_job", kind="job", request_id="r1", match_id="m_r1_ice")])
        db.flush()
        db.add(Message(id="msg_1", thread_id="t_r1", author_id="u_rev", author_role="village",
                       body="Please confirm where barricades should be dropped off.", created_at=_ts("2026-10-02", 10)))
        db.add(Message(id="msg_2", thread_id="t_r1", author_id="u_a", author_role="resident",
                       body="In front of 1105.", created_at=_ts("2026-10-02", 11)))
        audit(db, "u_rev", "approve", "request", "r1", after={"approved_date": "2027-06-19"})
        if rich:
            _rich(db, rules, index)
        db.commit()
        counts = _counts(db)
    finally:
        db.close()
    return counts


def _counts(db) -> dict:
    return {t.name: db.query(t).count() for t in Base.metadata.sorted_tables
            if t.name in ("users", "vendor_accounts", "offers", "requests", "signatures", "paper_petitions",
                          "change_requests", "matches", "threads", "messages", "weekend_slots")}


# ---- rich sample data ---------------------------------------------------------------------------

JUN19 = "2027-06-19"

# (id, organizer, block, start, end, guests, status, n_sigs, submitted_at, extras)
RICH_REQUESTS = [
    # approved, June 19 cluster (mixed impact levels: N CUYLER / N LOMBARD blocks have bus stops)
    ("r10", "u_c", "S ELMWOOD AVE|1100", "2027-06-12", "2027-06-26", 90, "approved", 10, _ts("2026-09-21", 9),
     {"approved_date": JUN19}),
    ("r12", "u_a", "S CUYLER AVE|1000", "2027-06-12", "2027-06-26", 70, "approved", 11, _ts("2026-09-22", 9),
     {"approved_date": JUN19}),
    ("r15", "u_d", "N CUYLER AVE|100", "2027-06-12", "2027-06-26", 100, "approved", 10, _ts("2026-09-22", 11),
     {"approved_date": JUN19}),
    ("r17", "u_c", "N LOMBARD AVE|100", "2027-06-12", "2027-06-26", 110, "approved", 12, _ts("2026-09-23", 9),
     {"approved_date": JUN19}),
    ("r18", "u_d", "N LOMBARD AVE|0", "2027-06-12", "2027-06-26", 60, "approved", 10, _ts("2026-09-23", 11),
     {"approved_date": JUN19}),
    # approved, other weekends
    ("r19", "u_b", "S LOMBARD AVE|1100", "2027-06-26", "2027-07-03", 80, "approved", 10, _ts("2026-09-24", 9),
     {"approved_date": "2027-06-26"}),
    ("r20", "u_c", "S HARVEY AVE|1000", "2027-07-10", "2027-07-24", 100, "approved", 10, _ts("2026-09-24", 11),
     {"approved_date": "2027-07-10"}),
    ("r21", "u_d", "GUNDERSON AVE|1100", "2027-07-10", "2027-07-24", 90, "approved", 10, _ts("2026-09-25", 9),
     {"approved_date": "2027-07-17"}),
    ("r22", "u_b", "S ELMWOOD AVE|1000", "2027-08-07", "2027-08-21", 75, "approved", 10, _ts("2026-09-25", 11),
     {"approved_date": "2027-08-07"}),
    ("r23", "u_d", "S SCOVILLE AVE|1000", "2027-08-21", "2027-08-28", 65, "approved", 10, _ts("2026-09-26", 9),
     {"approved_date": "2027-08-21"}),
    # submitted
    ("r11", "u_a", "S TAYLOR AVE|1000", "2027-07-24", "2027-07-31", 85, "submitted", 10, _ts("2026-10-02", 10), {}),
    ("r13", "u_b", "S EAST AVE|700", "2027-08-14", "2027-08-28", 70, "submitted", 6, _ts("2026-10-02", 11), {}),
    ("r14", "u_c", "HIGHLAND AVE|1000", "2027-06-12", "2027-06-26", 95, "submitted", 7, _ts("2026-10-02", 12), {}),
    # rejected
    ("r16", "u_d", "S LOMBARD AVE|1000", "2027-09-11", "2027-09-25", 60, "rejected", 7, _ts("2026-09-28", 9),
     {"reject_reason": "Petition had 7 of 10 addresses."}),
]

# who is "Coming" (accepted); everyone else matched stays "proposed"
ACCEPT = [("r10", "va_icecream"), ("r20", "va_icecream"), ("r12", "va_face"), ("r15", "va_face"),
          ("r18", "va_face"), ("r17", "va_dj"), ("r21", "va_dj"), ("r19", "va_taco"), ("r20", "va_taco")]


def _rich(db, rules, index) -> None:
    for _, _, bid, *_rest in RICH_REQUESTS:
        b = index.by_id[bid]
        assert b["eligible"], bid

    # vendors, users, offers
    db.add_all([
        VendorAccount(id="va_face", business_name="Sample Face Painting", status="approved",
                      contact_email="facepainting@example.org", approved_at=_ts("2026-09-02"),
                      created_at=_ts("2026-09-02")),
        VendorAccount(id="va_dj", business_name="Sample DJ Booth", status="approved",
                      contact_email="dj@example.org", approved_at=_ts("2026-09-03"), created_at=_ts("2026-09-03")),
        VendorAccount(id="va_snow", business_name="Sample Snow Cone Stand", status="suspended",
                      contact_email="snowcone@example.org", approved_at=_ts("2026-09-04"),
                      created_at=_ts("2026-09-04")),
    ])
    db.flush()
    db.add_all([
        User(id="u_c", role="resident", email="organizer-c@example.org", display_name="Sample Organizer C",
             dev_token="dev-resident-c"),
        User(id="u_d", role="resident", email="organizer-d@example.org", display_name="Sample Organizer D",
             dev_token="dev-resident-d"),
        User(id="u_face", role="vendor", email="facepainting@example.org", display_name="Sample Face Painting",
             vendor_account_id="va_face", dev_token="dev-vendor-face"),
        User(id="u_dj", role="vendor", email="dj@example.org", display_name="Sample DJ Booth",
             vendor_account_id="va_dj", dev_token="dev-vendor-dj"),
        User(id="u_snow", role="vendor", email="snowcone@example.org", display_name="Sample Snow Cone Stand",
             vendor_account_id="va_snow", dev_token="dev-vendor-snow"),
    ])
    db.add_all([
        Offer(vendor_account_id="va_face", service="face_painting", price_usd=150, max_guests=200, jobs_per_day=3,
              includes="Face painting for kids, up to 2 hours", days=["saturday", "sunday"],
              zips=["60302", "60304"], active=True),
        Offer(vendor_account_id="va_dj", service="music_dj", price_usd=450, max_guests=250, jobs_per_day=1,
              includes="DJ, speakers and playlist, up to 3 hours", days=["saturday", "sunday"],
              zips=["60302", "60304"], active=True),
    ])
    db.flush()

    # requests + signatures
    for k, (rid, org, bid, ds, de, guests, status, n, sub, extra) in enumerate(RICH_REQUESTS):
        block = index.by_id[bid]
        lo = max(block["addr_lo"], 1)
        assert lo + n - 1 <= block["addr_hi"], bid
        req = Request(id=rid, organizer_id=org, block_id=bid, kind="party", date_start=ds, date_end=de,
                      guests=guests, services={"barricades": True, "green_kit": k % 2 == 0}, status=status,
                      petition_token=_token(rid), petition_due=R.petition_due(ds, rules["petition_lead_days"]),
                      submitted_at=sub, rules_year=rules["rules_year"], version=1,
                      created_at=_ts("2026-09-12", 8 + k), **extra)
        if status in ("approved", "rejected"):
            req.decided_at, req.decided_by = sub + timedelta(days=2), "u_rev"
        db.add(req)
        for i in range(n):
            at = _ts("2026-09-18") + timedelta(hours=k, minutes=i)
            db.add(Signature(id=f"sig_{rid}_{i + 1}", request_id=rid, name=f"Sample Neighbor {i + 1}",
                             house_number=str(lo + i), street=block["name"], state="counted",
                             created_at=at, consent_at=at))
    db.flush()

    # one paper petition on a submitted request (7 typed + paper count of 12)
    db.add(PaperPetition(id="pp_r14", request_id="r14", address_count=12, file_ref="sample-paper-petition.pdf",
                         attested_by="u_rev", attested_at=_ts("2026-10-02", 14)))
    # one open reschedule request from resident A on an approved request
    db.add(ChangeRequest(id="cr_r12", request_id="r12", type="reschedule", proposed_start="2027-06-26",
                         proposed_end="2027-06-26", status="open", created_at=_ts("2026-10-02", 16),
                         message="Could we move to the following Saturday? Two neighbors are away on the 19th."))
    db.flush()

    # matches come from the real matching code; then mark some accepted (never past jobs_per_day)
    from . import services
    for req in db.query(Request).filter(Request.status == "approved").order_by(Request.id).all():
        for m in services.rematch_request(db, req):
            m.id = f"m_{req.id}_{m.vendor_account_id[3:]}"
    db.flush()
    for rid, vid in ACCEPT:
        m = db.query(Match).filter(Match.request_id == rid, Match.vendor_account_id == vid).one()
        m.state, m.decided_at = "accepted", _ts("2026-10-02", 17)
        db.flush()
    db.query(Notification).delete()  # rematch queues emails; none belong with sample data

    # threads and messages
    texts = {
        ("r10", "va_icecream"): [("resident", "u_c", "Hi! The barricades go up Friday, so you can park at the curb by 1 pm on the 19th."),
                                 ("vendor", "u_ice", "Great, we will arrive at 1 pm and set up in the curb lane.")],
        ("r20", "va_icecream"): [("vendor", "u_ice", "We plan to arrive about 12:30. Where should we park relative to the barricade?"),
                                 ("resident", "u_c", "Just inside the barricade near the middle of the block, please.")],
        ("r12", "va_face"): [("resident", "u_a", "Kids start arriving around 2 pm, so any time before then works.")],
        ("r17", "va_dj"): [("vendor", "u_dj", "We need one outlet near the curb. Is that OK?")],
    }
    for m in db.query(Match).filter(Match.state == "accepted").order_by(Match.id).all():
        t = services.job_thread(db, m)  # every accepted job gets a thread
        if t.id not in ("t_r1_job",):
            t.id = f"t_job_{m.request_id}_{m.vendor_account_id[3:]}"
    db.flush()
    n_msg = 0
    for (rid, vid), msgs in texts.items():
        m = db.query(Match).filter(Match.request_id == rid, Match.vendor_account_id == vid).one()
        t = services.job_thread(db, m)
        for j, (role, uid, body) in enumerate(msgs):
            db.add(Message(id=f"msg_{rid}_{vid[3:]}_{j + 1}", thread_id=t.id, author_id=uid, author_role=role,
                           body=body, created_at=_ts("2026-10-02", 18) + timedelta(minutes=j * 7)))
            n_msg += 1
    t = services.request_thread(db, db.get(Request, "r12"))
    t.id = "t_r12"
    db.flush()
    db.add(Message(id="msg_r12_v1", thread_id=t.id, author_id="u_rev", author_role="village",
                   body="We saw your reschedule request and will answer this week.",
                   created_at=_ts("2026-10-03", 8)))
    db.flush()

    # weekend lock rows match the live approved counts
    per: dict[str, int] = {}
    for r in db.query(Request).filter(Request.status == "approved").all():
        k = R.weekend_key(r.approved_date)
        per[k] = per.get(k, 0) + 1
    for k, c in per.items():
        slot = db.get(WeekendSlot, k)
        if slot is None:
            db.add(WeekendSlot(weekend_key=k, approved_count=c, version=1))
        else:
            slot.approved_count = c


def _summary() -> None:
    db = SessionLocal()
    try:
        print("\nRecords per table")
        for k, v in _counts(db).items():
            print(f"  {k:<18}{v}")
        print("Requests per status")
        for st in ("draft", "collecting", "submitted", "approved", "rejected"):
            print(f"  {st:<18}{db.query(Request).filter(Request.status == st).count()}")
        print("Matches per state")
        for st in ("proposed", "accepted"):
            print(f"  {st:<18}{db.query(Match).filter(Match.state == st).count()}")
        print("Endpoint expectations (minimums)")
        for line in ("dev-resident-a /v1/me/requests >= 4 cards",
                     "dev-vendor-icecream /v1/vendor/summary matched_open > 0, accepted > 0",
                     "dev-vendor-icecream /v1/vendor/matches?state=proposed >= 3",
                     "dev-vendor-icecream /v1/vendor/jobs >= 2",
                     "dev-reviewer /v1/village/requests >= 10 items",
                     "dev-reviewer /v1/village/day?date=2027-06-19 >= 4 parties, low+medium+high",
                     "dev-reviewer /v1/village/weekends 2027-06-01..2027-08-31 non-zero approved",
                     "dev-reviewer /v1/village/vendors >= 5 (1 invited, 1 suspended)"):
            print("  " + line)
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeded:", run(rich=True))
    _summary()
