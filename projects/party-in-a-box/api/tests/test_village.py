import json

import pytest

REV = {"Authorization": "Bearer dev-reviewer"}
RES = {"Authorization": "Bearer dev-resident-a"}


@pytest.fixture(autouse=True, scope="module")
def _reseed():
    from app import seed
    seed.run()


def _counts():
    from app import db as D
    s = D.SessionLocal()
    try:
        return {m.__tablename__: s.query(m).count() for m in (D.Request, D.Match, D.WeekendSlot, D.Notification,
                                                              D.AuditLog, D.Signature, D.PaperPetition)}
    finally:
        s.close()


def test_queue_order_and_facets(client):
    r = client.get("/v1/village/requests", headers=REV)
    assert r.status_code == 200
    body = r.json()
    ids = [i["id"] for i in body["items"]]
    assert ids == ["r1", "r2", "r5", "r7"]
    r1 = body["items"][0]
    assert r1["range_label"] == "Jun 12 – 26, 2027" and r1["needed"] == 10 and r1["distinct_count"] == 10
    assert body["items"][3]["level"] is None
    assert body["facets"] == {"all": 4, "needs_review": 2, "approved": 1, "rejected": 1}
    only = client.get("/v1/village/requests?status=submitted", headers=REV).json()
    assert [i["id"] for i in only["items"]] == ["r2", "r5"]
    assert only["facets"]["all"] == 4


def test_resident_forbidden(client):
    assert client.get("/v1/village/requests", headers=RES).status_code == 403
    assert client.get("/v1/village/requests").status_code == 401


def test_detail_r2(client):
    r = client.get("/v1/village/requests/r2", headers=REV)
    assert r.status_code == 200
    d = r.json()
    assert d["can_approve"]["ok"] is True
    assert d["version"] == "1" and d["thread_id"] and d["organizer_display_name"]
    cand = {c["date"]: c for c in d["candidates"]}
    assert set(cand) == {"2027-06-12", "2027-06-19", "2027-06-26"}
    texts = [x["text"] for x in cand["2027-06-19"]["score"]["reasons"]]
    assert any("1100 S Cuyler Ave" in t for t in texts)
    assert cand["2027-06-19"]["weekend_approved"] == 1 and cand["2027-06-19"]["cap"] == 30
    assert d["impact_map"]["others_same_weekend"][0]["block_id"] == "S CUYLER AVE|1100"
    assert d["vendors"] and d["vendors"][0]["state"] == "Matches (sees it after approval)"
    assert client.get("/v1/village/requests/nope", headers=REV).status_code == 404
    d1 = client.get("/v1/village/requests/r1", headers=REV).json()
    assert d1["can_approve"] == {"ok": False, "reasons": ["Only submitted requests can be approved."]}
    assert {v["state"] for v in d1["vendors"]} == {"Coming", "Waiting for vendor"}


def test_stale_if_match(client):
    r = client.post("/v1/village/requests/r5/approve", json={"date": "2027-07-10"},
                    headers={**REV, "If-Match": "99"})
    assert r.status_code == 409 and r.json()["code"] == "stale_version"


def test_approve_not_candidate_and_wrong_status(client):
    r = client.post("/v1/village/requests/r5/approve", json={"date": "2027-07-11"}, headers=REV)
    assert r.status_code == 422
    r = client.post("/v1/village/requests/r7/approve", json={"date": "2027-08-07"}, headers=REV)
    assert r.status_code == 422 and "Only submitted requests can be approved." in r.json()["reasons"]


def test_whatif_writes_nothing(client):
    before = _counts()
    r = client.post("/v1/village/whatif", headers=REV, json={
        "date": "2027-06-26", "closures": ["S CUYLER AVE|1100", "HIGHLAND AVE|1100"]})
    assert r.status_code == 200
    d = r.json()
    assert len(d["per_block"]) == 2
    for pb in d["per_block"]:
        assert any("closure that weekend" in x["text"] for x in pb["score"]["reasons"])
    assert d["weekend_count"] == {"count": 2, "cap": 30}
    assert d["worst"]["score"] >= 10
    assert d["suggestions"] and d["suggestions"][0]["kind"] == "other_saturday"
    assert _counts() == before
    bad = client.post("/v1/village/whatif", headers=REV, json={"date": "2027-06-26", "closures": ["NORTH AVE|6400"]})
    assert bad.status_code == 422 and "East/west" in bad.json()["reasons"][0]
    wd = client.post("/v1/village/whatif", headers=REV, json={"date": "2027-06-26", "closures": ["S CUYLER AVE|1100"],
                                                              "treat_as_weekday": True}).json()
    assert wd["weekend_count"] is None


def test_ai_explain_template_without_key(client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", None)
    r = client.post("/v1/ai/explain", headers=REV, json=_ai_input())
    assert r.status_code == 200
    d = r.json()
    assert d["source"] == "template" and d["label"] == "Templated summary (AI unavailable)"
    assert "35 of 100" in d["summary"] and "1100 S Cuyler Ave" in d["summary"]


def _ai_input():
    return {"question": "Why is this medium?", "date": "2027-06-26", "is_weekday": False,
            "closures": [{"label": "1100 S Cuyler Ave", "score": 35, "level": "medium",
                          "reasons": [{"pts": 15, "text": "1 bus stop on the block"},
                                      {"pts": 10, "text": "Another closure that weekend within 200 m (1000 Highland Ave)"}]}],
            "weekend": {"count": 2, "cap": 30}, "suggestions": [{"text": "Use 2027-06-19 instead"}], "tips": []}


def test_ai_explain_rejects_delay_text(client, monkeypatch):
    from app import ai
    from app.config import settings
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "test-key-not-real")
    monkeypatch.setattr(ai, "call_model", lambda system, user: json.dumps(
        {"summary": "Expect a 20 minutes delay.", "answer": "x", "referenced_suggestions": []}))
    d = client.post("/v1/ai/explain", headers=REV, json=_ai_input()).json()
    assert d["source"] == "template"


def test_ai_explain_accepts_valid_and_rejects_unknown_numbers(client, monkeypatch):
    from app import ai
    from app.config import settings
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "test-key-not-real")
    good = {"summary": "1100 S Cuyler Ave scores 35 because of 1 bus stop and a nearby closure.",
            "answer": "The weekend has 2 of 30 events.", "referenced_suggestions": [0]}
    monkeypatch.setattr(ai, "call_model", lambda s, u: json.dumps(good))
    d = client.post("/v1/ai/explain", headers=REV, json=_ai_input()).json()
    assert d["source"] == "ai" and d["label"] == "AI-written" and d["referenced_suggestions"] == [0]
    bad = dict(good, answer="The weekend has 7 of 30 events.")
    monkeypatch.setattr(ai, "call_model", lambda s, u: json.dumps(bad))
    assert client.post("/v1/ai/explain", headers=REV, json=_ai_input()).json()["source"] == "template"

    def boom(s, u):
        raise RuntimeError("timeout")
    monkeypatch.setattr(ai, "call_model", boom)
    assert client.post("/v1/ai/explain", headers=REV, json=_ai_input()).json()["source"] == "template"


def test_ai_rate_limit(client):
    from app.routers import village
    village._ai_hits.clear()
    codes = [client.post("/v1/ai/explain", headers=REV, json=_ai_input()).status_code for _ in range(21)]
    assert codes[:20] == [200] * 20 and codes[20] == 429
    village._ai_hits.clear()


def test_csv(client):
    r = client.get("/v1/village/export/requests.csv", headers=REV)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().split("\n")
    assert lines[0] == "id,block,date_start,date_end,status,approved_date,guests,distinct_addresses,submitted_at"
    assert len(lines) == 5 and "@" not in r.text


def test_day_and_weekends(client):
    d = client.get("/v1/village/day?date=2027-06-19", headers=REV).json()
    assert d["totals"]["count"] == 1 and d["parties"][0]["request_id"] == "r1"
    assert d["parties"][0]["vendors"] == ["Sample Ice Cream Co."] and d["parties"][0]["barricade_date"] == "2027-06-18"
    assert d["totals"]["vendors"] == 1
    assert client.get("/v1/village/day?date=2027-06-20", headers=REV).json()["totals"]["count"] == 0
    w = client.get("/v1/village/weekends?from=2027-06-12&to=2027-06-26", headers=REV).json()
    assert [x["weekend_key"] for x in w] == ["2027-06-12", "2027-06-19", "2027-06-26"]
    assert w[1]["approved"] == 1 and w[1]["pending"] == 1 and w[1]["cap"] == 30


def test_vendors(client):
    v = client.get("/v1/village/vendors", headers=REV).json()["vendors"]
    ice = next(x for x in v if x["id"] == "va_icecream")
    assert ice["offer_summary"] == "ice_cream · $300 · up to 150"
    r = client.post("/v1/village/vendors", headers=REV, json={"business_name": "New Co", "contact_email": "new@example.org"})
    assert r.status_code == 201 and r.json()["status"] == "invited"
    vid = r.json()["id"]
    assert client.post("/v1/village/vendors", headers=REV, json={
        "business_name": "Dup", "contact_email": "NEW@example.org"}).status_code == 409
    assert client.patch(f"/v1/village/vendors/{vid}", headers=REV, json={"status": "approved"}).json()["approved_at"]
    s = client.patch("/v1/village/vendors/va_taco", headers=REV, json={"status": "suspended"})
    assert s.status_code == 200 and s.json()["status"] == "suspended"
    d = client.get("/v1/village/requests/r1", headers=REV).json()
    assert [x["name"] for x in d["vendors"]] == ["Sample Ice Cream Co."]
    assert client.patch("/v1/village/vendors/zzz", headers=REV, json={"status": "approved"}).status_code == 404


def _make_request(rid, block_id, status, start, end, approved_date=None, organizer="u_a", nsigs=0):
    from app import db as D
    from app.blocks import get_index
    from datetime import datetime, timezone
    s = D.SessionLocal()
    try:
        b = get_index().by_id[block_id]
        s.add(D.Request(id=rid, organizer_id=organizer, block_id=block_id, kind="party", date_start=start,
                        date_end=end, guests=40, services={"barricades": True, "green_kit": False}, status=status,
                        approved_date=approved_date, submitted_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
                        rules_year=2026, version=1))
        s.flush()
        for i in range(nsigs):
            s.add(D.Signature(id=D.new_id("sig"), request_id=rid, name=f"N {i}", house_number=str(b["addr_lo"] + i),
                              street=b["name"], state="counted"))
        s.commit()
    finally:
        s.close()


def test_approve_blocked_petition_4_of_10(client):
    _make_request("rx4", "S ELMWOOD AVE|1100" if _eligible("S ELMWOOD AVE|1100") else _eligibles()[0],
                  "submitted", "2027-09-04", "2027-09-04", nsigs=4)
    rid = "rx4"
    r = client.post(f"/v1/village/requests/{rid}/approve", json={"date": "2027-09-04"}, headers=REV)
    assert r.status_code == 422 and r.json()["code"] == "cannot_approve"
    assert any("4 of 10" in x for x in r.json()["reasons"])
    # paper petition attestation clears the gate
    p = client.post(f"/v1/village/requests/{rid}/paper-petition", headers=REV, data={"address_count": "12"},
                    files={"file": ("scan.pdf", b"%PDF-fake", "application/pdf")})
    assert p.status_code == 200 and p.json()["distinct_count"] == 12 and p.json()["attested_by"] == "Sample Reviewer"
    from app import db as D
    s = D.SessionLocal()
    try:
        assert s.query(D.PaperPetition).filter_by(request_id=rid).one().file_ref == "scan.pdf"
    finally:
        s.close()
    assert client.post(f"/v1/village/requests/{rid}/paper-petition", headers=REV, data={"address_count": "0"}).status_code == 422


def _eligibles():
    from app.blocks import get_index
    return [b["id"] for b in get_index().all() if b["eligible"]]


def _eligible(bid):
    return bid in _eligibles()


def test_approve_r2_creates_matches(client):
    r = client.post("/v1/village/requests/r2/approve", json={"date": "2027-06-19"}, headers={**REV, "If-Match": "1"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "approved" and body["approved_date"] == "2027-06-19" and body["version"] == "2"
    assert body["barricade_date"] == "2027-06-18"
    from app import db as D
    s = D.SessionLocal()
    try:
        assert s.query(D.Match).filter(D.Match.request_id == "r2").count() >= 1
        assert s.get(D.WeekendSlot, "2027-06-19").approved_count == 2
        assert s.get(D.Request, "r2").decision_snapshot["can_approve"]["ok"] is True
    finally:
        s.close()
    again = client.post("/v1/village/requests/r2/approve", json={"date": "2027-06-19"}, headers=REV)
    assert again.status_code == 422


def test_reject(client):
    assert client.post("/v1/village/requests/r5/reject", json={"reason": ""}, headers=REV).status_code == 422
    r = client.post("/v1/village/requests/r5/reject", json={"reason": "Too close to a school event."}, headers=REV)
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    assert r.json()["reject_reason"] == "Too close to a school event."
    assert client.post("/v1/village/requests/r5/reject", json={"reason": "again"}, headers=REV).status_code == 409


def test_cap_reached(client):
    ids = [b for b in _eligibles() if b != "S ELMWOOD AVE|1100"][:31]
    target, others = ids[0], ids[1:]
    for i, bid in enumerate(others):
        _make_request(f"cap{i}", bid, "approved", "2027-09-11", "2027-09-11", approved_date="2027-09-11")
    _make_request("capx", target, "submitted", "2027-09-11", "2027-09-11", nsigs=10)
    r = client.post("/v1/village/requests/capx/approve", json={"date": "2027-09-11"}, headers=REV)
    assert r.status_code == 409 and r.json()["code"] == "cap_reached"
    assert "Weekend is at 30 of 30." in r.json()["reasons"]


def test_change_request_cancel_and_reschedule(client):
    from app import db as D
    from app import seed
    seed.run()
    s = D.SessionLocal()
    try:
        s.add(D.ChangeRequest(id="cr1", request_id="r1", type="reschedule", proposed_start="2027-06-26",
                              proposed_end="2027-06-26", message="Can we move?", status="open"))
        s.add(D.ChangeRequest(id="cr2", request_id="r1", type="cancel", proposed_start="2027-06-19",
                              message="Never mind", status="open"))
        s.commit()
    finally:
        s.close()
    bad = client.post("/v1/village/change-requests/cr1/resolve", headers=REV, json={"decision": "accept"})
    assert bad.status_code == 422
    out = client.post("/v1/village/change-requests/cr1/resolve", headers=REV,
                      json={"decision": "accept", "new_date": "2027-06-26", "message": "Moved."})
    assert out.status_code == 200 and out.json()["status"] == "accepted"
    s = D.SessionLocal()
    try:
        r1 = s.get(D.Request, "r1")
        assert r1.approved_date == "2027-06-26" and r1.version == 2
        assert s.get(D.WeekendSlot, "2027-06-19").approved_count == 0
        assert s.get(D.WeekendSlot, "2027-06-26").approved_count == 1
        assert s.query(D.Message).filter(D.Message.body == "Moved.").one().author_role == "village"
    finally:
        s.close()
    assert client.post("/v1/village/change-requests/cr1/resolve", headers=REV,
                       json={"decision": "decline"}).status_code == 409
    c = client.post("/v1/village/change-requests/cr2/resolve", headers=REV, json={"decision": "accept"})
    assert c.status_code == 200
    s = D.SessionLocal()
    try:
        assert s.get(D.Request, "r1").status == "cancelled"
        assert s.get(D.WeekendSlot, "2027-06-26").approved_count == 0
        assert s.query(D.Match).filter(D.Match.request_id == "r1", D.Match.state != "void").count() == 0
    finally:
        s.close()
