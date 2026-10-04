"""The rich seed (`seed.run(rich=True)`) must leave every frontend screen with content."""
import pytest


def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True, scope="module")
def _reseed():
    from app import seed
    seed.run(rich=True)


def test_resident_a_cards(client):
    cards = client.get("/v1/me/requests", headers=H("dev-resident-a")).json()["requests"]
    assert len(cards) >= 4
    assert {"draft", "collecting", "submitted", "approved"} <= {c["status"] for c in cards}
    collecting = next(c for c in cards if c["status"] == "collecting")
    assert 0 < collecting["distinct_count"] < 10
    states = {v["state"] for c in cards for v in c["vendors"]}
    assert {"Coming", "Waiting for vendor"} <= states
    assert any(c["open_change_request"] for c in cards)


def test_resident_c_and_d(client):
    for t in ("dev-resident-c", "dev-resident-d"):
        assert client.get("/v1/me/requests", headers=H(t)).json()["requests"]


def test_vendor_icecream(client):
    h = H("dev-vendor-icecream")
    assert client.get("/v1/vendor/me", headers=h).status_code == 200
    assert client.get("/v1/vendor/offer", headers=h).status_code == 200
    s = client.get("/v1/vendor/summary", headers=h).json()
    assert s["matched_open"] > 0 and s["accepted"] > 0
    assert len(client.get("/v1/vendor/matches?state=proposed", headers=h).json()["matches"]) >= 3
    jobs = client.get("/v1/vendor/jobs", headers=h).json()["jobs"]
    assert len(jobs) >= 2 and all(j["thread_id"] for j in jobs)
    msgs = [client.get(f"/v1/threads/{j['thread_id']}/messages", headers=h) for j in jobs]
    assert any(r.status_code == 200 and r.json().get("messages") for r in msgs)


@pytest.mark.parametrize("token", ["dev-vendor-face", "dev-vendor-dj", "dev-vendor-taco"])
def test_other_vendors_have_offers_and_jobs(client, token):
    assert client.get("/v1/vendor/offer", headers=H(token)).status_code == 200
    assert client.get("/v1/vendor/jobs", headers=H(token)).json()["jobs"]


def test_reviewer_queue(client):
    body = client.get("/v1/village/requests", headers=H("dev-reviewer")).json()
    items = body["items"]
    assert len(items) >= 10
    assert {"submitted", "approved", "rejected"} <= {i["status"] for i in items}
    assert any(i["status"] == "submitted" and i["distinct_count"] < i["needed"] for i in items)
    sub = {i["id"]: i for i in items if i["status"] == "submitted"}
    assert "r2" in sub and "r14" in sub  # neighboring blocks, same weekends


def test_reviewer_day(client):
    d = client.get("/v1/village/day?date=2027-06-19", headers=H("dev-reviewer")).json()
    assert d["totals"]["count"] >= 4
    assert all(p["vendors"] for p in d["parties"])
    assert d["totals"]["by_level"]["medium"] >= 1 and d["totals"]["bus_stops_closed"] >= 1


def test_reviewer_weekends_and_vendors(client):
    w = client.get("/v1/village/weekends?from=2027-06-01&to=2027-08-31", headers=H("dev-reviewer")).json()
    assert sum(1 for x in w if x["approved"] > 0) >= 3
    assert all(x["approved"] <= x["cap"] for x in w)
    vs = client.get("/v1/village/vendors", headers=H("dev-reviewer")).json()["vendors"]
    assert len(vs) >= 5
    assert {"invited", "suspended", "approved"} <= {v["status"] for v in vs}
    assert all(v["business_name"].startswith("Sample ") for v in vs)


def test_reseed_is_idempotent(client):
    from app import seed
    first = seed.run(rich=True)
    assert seed.run(rich=True) == first
