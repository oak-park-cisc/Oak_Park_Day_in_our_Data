"""Batch fixes: per-candidate approve gate, queue block_id/perf refactor, map geometry, If-Match, same-weekend reschedule."""
import json

import pytest

REV = {"Authorization": "Bearer dev-reviewer"}

# Queue JSON for the seed, captured BEFORE the perf refactor (block_id was added afterwards).
QUEUE_SNAPSHOT = json.loads(
    '{"facets": {"all": 4, "approved": 1, "needs_review": 2, "rejected": 1}, "items": ['
    '{"block_label": "1100 S Cuyler Ave", "date_end": "2027-06-26", "date_start": "2027-06-12", "distinct_count": 10,'
    ' "id": "r1", "level": "low", "needed": 10, "range_label": "Jun 12 \\u2013 26, 2027", "status": "approved",'
    ' "submitted_at": "2026-10-01T09:00:00"},'
    '{"block_label": "1100 Highland Ave", "date_end": "2027-06-26", "date_start": "2027-06-12", "distinct_count": 10,'
    ' "id": "r2", "level": "low", "needed": 10, "range_label": "Jun 12 \\u2013 26, 2027", "status": "submitted",'
    ' "submitted_at": "2026-10-01T15:00:00"},'
    '{"block_label": "600 S East Ave", "date_end": "2027-07-17", "date_start": "2027-07-10", "distinct_count": 10,'
    ' "id": "r5", "level": "low", "needed": 10, "range_label": "Jul 10 \\u2013 17, 2027", "status": "submitted",'
    ' "submitted_at": "2026-10-02T09:00:00"},'
    '{"block_label": "1100 S Taylor Ave", "date_end": "2027-08-07", "date_start": "2027-08-07", "distinct_count": 10,'
    ' "id": "r7", "level": null, "needed": 10, "range_label": "Aug 7, 2027", "status": "rejected",'
    ' "submitted_at": "2026-10-02T15:00:00"}]}')


@pytest.fixture(autouse=True, scope="module")
def _reseed():
    from app import seed
    seed.run()


def _fill_weekend(date, n, prefix):
    """Add n approved dummy requests on `date` (distinct eligible blocks)."""
    from datetime import datetime, timezone

    from app import db as D
    from app.blocks import get_index
    blocks = [b["id"] for b in get_index().all() if b["eligible"] and b["id"] != "S CUYLER AVE|1100"
              and b["id"] != "HIGHLAND AVE|1100"][:n]
    s = D.SessionLocal()
    try:
        for i, bid in enumerate(blocks):
            s.add(D.Request(id=f"{prefix}{i}", organizer_id="u_a", block_id=bid, kind="party", date_start=date,
                            date_end=date, guests=40, services={"barricades": True, "green_kit": False},
                            status="approved", approved_date=date,
                            submitted_at=datetime(2026, 10, 1, tzinfo=timezone.utc), rules_year=2026, version=1))
        s.commit()
        assert len(blocks) == n
    finally:
        s.close()


def test_queue_unchanged_by_perf_refactor_plus_block_id(client):
    body = client.get("/v1/village/requests", headers=REV).json()
    for it in body["items"]:
        assert it.pop("block_id")
    assert body == QUEUE_SNAPSHOT


def test_geometry_in_whatif_and_day(client):
    r = client.post("/v1/village/whatif", headers=REV,
                    json={"date": "2027-06-19", "closures": ["S CUYLER AVE|1100"]})
    assert r.status_code == 200, r.text
    pb = r.json()["per_block"][0]
    assert len(pb["centroid"]) == 2 and pb["lines"] and all(len(p) == 2 for p in pb["lines"][0])
    d = client.get("/v1/village/day?date=2027-06-19", headers=REV).json()
    assert d["parties"]
    p = d["parties"][0]
    assert p["block_id"] and len(p["centroid"]) == 2 and p["lines"]


def test_per_candidate_can_approve(client):
    _fill_weekend("2027-06-12", 30, "pcA")
    d = client.get("/v1/village/requests/r2", headers=REV).json()
    first, later = d["candidates"][0], d["candidates"][1]
    assert first["date"] == "2027-06-12" and first["can_approve"]["ok"] is False
    assert any(x.startswith("Weekend is at ") for x in first["can_approve"]["reasons"])
    assert later["can_approve"]["ok"] is True
    assert d["can_approve"] == first["can_approve"]  # top-level stays the first candidate's
    ok = client.post("/v1/village/requests/r2/approve", json={"date": later["date"]}, headers=REV)
    assert ok.status_code == 200


def test_per_candidate_can_approve_too_soon(client):
    from app import seed
    seed.run()
    from app import db as D
    s = D.SessionLocal()
    try:
        r = s.get(D.Request, "r5")
        r.date_start, r.date_end = "2026-10-10", "2026-10-24"  # first Saturday < 14 days out
        s.commit()
    finally:
        s.close()
    d = client.get("/v1/village/requests/r5", headers=REV).json()
    oks = [c["can_approve"]["ok"] for c in d["candidates"]]
    assert oks[0] is False and any(oks[1:])


def test_reject_stale_if_match(client):
    from app import seed
    seed.run()
    bad = client.post("/v1/village/requests/r5/reject", headers={**REV, "If-Match": "99"}, json={"reason": "No"})
    assert bad.status_code == 409 and bad.json()["code"] == "stale_version"
    ok = client.post("/v1/village/requests/r5/reject", headers={**REV, "If-Match": "1"}, json={"reason": "No"})
    assert ok.status_code == 200 and ok.json()["version"] == "2"


def test_resolve_stale_if_match(client):
    from app import db as D
    from app import seed
    seed.run()
    s = D.SessionLocal()
    try:
        s.add(D.ChangeRequest(id="crs", request_id="r1", type="cancel", proposed_start="2027-06-19",
                              message="x", status="open"))
        s.commit()
    finally:
        s.close()
    bad = client.post("/v1/village/change-requests/crs/resolve", headers={**REV, "If-Match": "7"},
                      json={"decision": "decline"})
    assert bad.status_code == 409 and bad.json()["code"] == "stale_version"
    ok = client.post("/v1/village/change-requests/crs/resolve", headers={**REV, "If-Match": "1"},
                     json={"decision": "decline"})
    assert ok.status_code == 200
    s = D.SessionLocal()
    try:
        assert s.get(D.Request, "r1").version == 2
    finally:
        s.close()


def test_reschedule_within_full_weekend(client):
    from app import db as D
    from app import seed
    seed.run()
    _fill_weekend("2027-06-19", 29, "rw")  # r1 is the 30th on that weekend
    s = D.SessionLocal()
    try:
        s.add(D.ChangeRequest(id="crw", request_id="r1", type="reschedule", proposed_start="2027-06-19",
                              proposed_end="2027-06-20", message="Sunday?", status="open"))
        s.commit()
    finally:
        s.close()
    out = client.post("/v1/village/change-requests/crw/resolve", headers=REV,
                      json={"decision": "accept", "new_date": "2027-06-20"})
    assert out.status_code == 200, out.text
    s = D.SessionLocal()
    try:
        assert s.get(D.Request, "r1").approved_date == "2027-06-20"
    finally:
        s.close()
