import re

import pytest


@pytest.fixture(autouse=True, scope="module")
def _reseed():
    from app import seed
    seed.run()


def H(name):
    return {"Authorization": f"Bearer dev-{name}"}


ICE, TACO, BOUNCE = H("vendor-icecream"), H("vendor-taco"), H("vendor-bounce")
NEW_REQ = "r_vx"


def _offer(**kw):
    base = {"service": "ice_cream", "price_usd": 300, "max_guests": 150, "jobs_per_day": 2,
            "includes": "Soft serve", "days": ["saturday", "sunday"], "zips": ["60302", "60304"],
            "active": True}
    base.update(kw)
    return base


def test_role_and_me(client):
    assert client.get("/v1/vendor/me", headers=H("resident-a")).status_code == 403
    assert client.get("/v1/vendor/me").status_code == 401
    r = client.get("/v1/vendor/me", headers=TACO)
    assert r.status_code == 200
    assert r.json()["business_name"] == "Sample Taco Cart" and r.json()["status"] == "approved"
    assert r.json()["approved_at"]


def test_ice_cream_job_and_taco_match_privacy(client):
    jobs = client.get("/v1/vendor/jobs", headers=ICE)
    assert jobs.status_code == 200
    j = jobs.json()["jobs"]
    assert len(j) == 1 and j[0]["state"] == "accepted" and j[0]["thread_id"] == "t_r1_job"
    assert j[0]["organizer_display_name"] == "Sample Organizer A"
    assert j[0]["reminder"].startswith("Keep your setup")
    ms = client.get("/v1/vendor/matches", headers=TACO)
    assert [m["match_id"] for m in ms.json()["matches"]] == ["m_r1_taco"]
    for text in (jobs.text, ms.text):
        assert "@" not in text
        assert not re.search(r"\b11(0[1-9])\b", text)  # seeded house numbers
    assert ms.json()["matches"][0]["block_label"] == "1100 S Cuyler Ave"
    assert ms.json()["matches"][0]["zip"] in (None, "60302", "60304")
    summ = client.get("/v1/vendor/summary", headers=TACO).json()
    assert summ == {"matched_open": 1, "accepted": 0}


def test_offer_not_approved(client):
    assert client.get("/v1/vendor/offer", headers=BOUNCE).json()["code"] == "no_offer"
    assert client.get("/v1/vendor/offer", headers=BOUNCE).status_code == 404
    r = client.put("/v1/vendor/offer", headers=BOUNCE, json=_offer())
    assert r.status_code == 403 and r.json()["code"] == "account_not_approved"


def test_offer_validation(client):
    for bad in (_offer(days=["saturday", "saturday"]), _offer(zips=["60999"]), _offer(price_usd=-1),
                _offer(max_guests=0), _offer(jobs_per_day=0), _offer(includes="x" * 301)):
        assert client.put("/v1/vendor/offer", headers=ICE, json=bad).status_code == 422


def _make_request(guests=100):
    from app.db import Request, SessionLocal
    from app.services import now, rematch_request
    db = SessionLocal()
    try:
        req = Request(id=NEW_REQ, organizer_id="u_b", block_id="S HARVEY AVE|1100", kind="party",
                      date_start="2027-06-12", date_end="2027-06-26", guests=guests,
                      services={"barricades": True, "green_kit": True}, status="approved",
                      approved_date="2027-06-19", submitted_at=now(), rules_year=2026, version=1)
        db.add(req)
        db.flush()
        rematch_request(db, req)
        db.commit()
    finally:
        db.close()


def test_day_full_accept_and_organizer_view(client):
    _make_request()
    ids = {m["match_id"] for m in client.get("/v1/vendor/matches", headers=TACO).json()["matches"]}
    assert len(ids) == 2
    r = client.post("/v1/vendor/matches/m_r1_taco/accept", headers=TACO)
    assert r.status_code == 200 and r.json()["state"] == "accepted"
    mine = client.get("/v1/me/requests", headers=H("resident-a"))
    if mine.status_code == 200:
        body = mine.json()
        items = body.get("requests", body) if isinstance(body, dict) else body
        r1 = next(x for x in items if x["id"] == "r1")
        vendors = r1.get("vendors") or []
        assert any(v["name"] == "Sample Taco Cart" and v["state"] == "Coming" for v in vendors)
    # day is now full: the other proposed match is hidden and cannot be accepted
    assert client.get("/v1/vendor/matches", headers=TACO).json()["matches"] == []
    other = next(i for i in ids if i != "m_r1_taco")
    r = client.post(f"/v1/vendor/matches/{other}/accept", headers=TACO)
    assert r.status_code == 409 and r.json()["code"] == "jobs_per_day_full"
    # wrong state / not mine
    assert client.post("/v1/vendor/matches/m_r1_taco/accept", headers=TACO).json()["code"] == "wrong_state"
    assert client.post("/v1/vendor/matches/m_r1_taco/accept", headers=ICE).status_code == 404
    assert client.get("/v1/vendor/summary", headers=TACO).json()["accepted"] == 1


def test_decline_and_undo(client):
    ms = client.get("/v1/vendor/matches", headers=ICE).json()["matches"]
    mid = next(m["match_id"] for m in ms if m["match_id"] != "m_r1_ice")
    assert client.post(f"/v1/vendor/matches/{mid}/decline", headers=ICE).json()["state"] == "declined"
    assert client.post(f"/v1/vendor/matches/{mid}/decline", headers=ICE).status_code == 409
    assert len(client.get("/v1/vendor/matches?state=declined", headers=ICE).json()["matches"]) == 1
    assert client.post(f"/v1/vendor/matches/{mid}/undo", headers=ICE).json()["state"] == "proposed"
    assert client.post(f"/v1/vendor/matches/{mid}/undo", headers=ICE).status_code == 409


def test_offer_change_voids_proposed(client):
    before = client.get("/v1/vendor/matches", headers=ICE).json()["matches"]
    assert any(m["match_id"] != "m_r1_ice" for m in before)  # proposed on the new request
    r = client.put("/v1/vendor/offer", headers=ICE, json=_offer(max_guests=50))
    assert r.status_code == 200 and r.json()["max_guests"] == 50
    assert client.get("/v1/vendor/offer", headers=ICE).json()["max_guests"] == 50
    assert client.get("/v1/vendor/matches", headers=ICE).json()["matches"] == []
    # accepted job is kept
    assert len(client.get("/v1/vendor/jobs", headers=ICE).json()["jobs"]) == 1


def test_withdraw(client):
    assert client.post("/v1/vendor/jobs/m_r1_ice/withdraw", headers=ICE, json={}).status_code == 422
    r = client.post("/v1/vendor/jobs/m_r1_ice/withdraw", headers=ICE, json={"reason": "Truck is in the shop."})
    assert r.status_code == 200 and r.json()["state"] == "withdrawn"
    assert client.post("/v1/vendor/jobs/m_r1_ice/withdraw", headers=ICE,
                       json={"reason": "again"}).status_code == 409
    from app.db import Message, Notification, SessionLocal
    db = SessionLocal()
    try:
        assert db.query(Notification).filter(Notification.user_id == "u_a",
                                             Notification.template == "vendor_withdrew").count() == 1
        assert db.query(Message).filter(Message.thread_id == "t_r1_job", Message.author_role == "vendor",
                                        Message.body == "Truck is in the shop.").count() == 1
    finally:
        db.close()
    assert client.get("/v1/vendor/jobs", headers=ICE).json()["jobs"] == []


def test_accept_twice_and_service_filled(client):
    from app.db import Match, Offer, Request, SessionLocal, User, VendorAccount
    from app.services import now
    db = SessionLocal()
    try:
        db.add(Request(id="r_dup", organizer_id="u_b", block_id="S HARVEY AVE|1100", kind="party",
                       date_start="2027-06-12", date_end="2027-06-26", guests=40,
                       services={"barricades": True, "green_kit": True}, status="approved",
                       approved_date="2027-06-19", submitted_at=now(), rules_year=2026, version=1))
        db.add(VendorAccount(id="va_ice2", business_name="Second Ice Cream", status="approved",
                             contact_email="ice2@example.org", approved_at=now()))
        db.flush()
        db.add(User(id="u_ice2", role="vendor", email="ice2@example.org", display_name="Second Ice Cream",
                    vendor_account_id="va_ice2", dev_token="dev-vendor-ice2"))
        db.add(Offer(vendor_account_id="va_ice2", service="ice_cream", price_usd=200, max_guests=100,
                     jobs_per_day=2, includes="Cones", days=["saturday"], zips=["60302", "60304"],
                     active=True))
        for mid, vid in (("m_dup_a", "va_icecream"), ("m_dup_b", "va_ice2")):
            db.add(Match(id=mid, request_id="r_dup", vendor_account_id=vid, event_date="2027-06-19",
                         state="proposed", why=[], price_snapshot=200, includes_snapshot="x",
                         service_snapshot="ice_cream", created_at=now()))
        db.commit()
    finally:
        db.close()
    ICE2 = H("vendor-ice2")
    first = client.post("/v1/vendor/matches/m_dup_a/accept", headers=ICE)
    assert first.status_code == 200 and first.json()["state"] == "accepted"
    again = client.post("/v1/vendor/matches/m_dup_a/accept", headers=ICE)
    assert again.status_code == 409
    # accepting voids the sibling; the normal answer for the other vendor is wrong_state
    assert client.post("/v1/vendor/matches/m_dup_b/accept", headers=ICE2).json()["code"] == "wrong_state"
    # a stale sibling that is still proposed (the race case) must hit the service_filled guard
    db = SessionLocal()
    try:
        db.get(Match, "m_dup_b").state = "proposed"
        db.commit()
    finally:
        db.close()
    second = client.post("/v1/vendor/matches/m_dup_b/accept", headers=ICE2)
    assert second.status_code == 409 and second.json()["code"] == "service_filled"
