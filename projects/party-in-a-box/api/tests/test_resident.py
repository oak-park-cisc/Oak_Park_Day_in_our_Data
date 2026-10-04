import pytest

from app.blocks import get_index


@pytest.fixture(autouse=True, scope="module")
def _reseed():
    from app import seed
    seed.run()


def H(name):
    return {"Authorization": f"Bearer dev-{name}"}


A, B, REV = H("resident-a"), H("resident-b"), H("reviewer")
BLOCK = "S HARVEY AVE|1100"


def test_rules(client):
    r = client.get("/v1/rules?year=2027")
    assert r.status_code == 200 and r.json()["petition_min_addresses"] == 10


def test_lookup(client):
    r = client.get("/v1/blocks/lookup", params={"address": "1100 S Cuyler Ave"})
    assert r.status_code == 200
    assert r.json()["block"]["eligible"] is True and r.json()["number"] == 1100
    r = client.get("/v1/blocks/lookup", params={"address": "1100 Superior St"})
    assert r.status_code == 200
    b = r.json()["block"]
    assert b["eligible"] is False and b["reason"] and b["nearest_eligible"]
    r = client.get("/v1/blocks/lookup", params={"address": "99999 Nowhere Pl"})
    assert r.status_code == 404 and r.json()["code"] == "not_found"


def test_get_block(client):
    r = client.get("/v1/blocks/S%20CUYLER%20AVE%7C1100")
    assert r.status_code == 200
    j = r.json()
    assert j["centroid"] and j["lines"] and j["data_version"]
    assert client.get("/v1/blocks/NOPE%7C100").status_code == 404


def test_check_dates(client):
    r = client.post("/v1/checks/dates", json={"block_id": "S CUYLER AVE|1100", "date_start": "2026-10-17",
                                              "date_end": "2026-10-17"})
    assert r.status_code == 200
    j = r.json()
    assert j["petition_due"] == "2026-10-03" and j["due_passed"] is False
    assert j["season"]["ok"] is True and j["max_per_block_per_year"] == 2
    r = client.post("/v1/checks/dates", json={"block_id": "S CUYLER AVE|1100", "date_start": "2027-06-20",
                                              "date_end": "2027-06-10"})
    assert r.status_code == 422
    assert client.post("/v1/checks/dates", json={"block_id": "X|1", "date_start": "2027-06-10",
                                                 "date_end": "2027-06-10"}).status_code == 422


def _new_request(client, headers=A):
    r = client.post("/v1/requests", headers=headers, json={
        "block_id": BLOCK, "date_start": "2027-09-04", "date_end": "2027-09-18", "guests": 50,
        "services": {"barricades": True, "green_kit": False}})
    assert r.status_code == 201, r.text
    return r.json()


def _sign(client, token, number, name="Neighbor"):
    return client.post(f"/v1/petitions/{token}/signatures", json={
        "name": name, "house_number": str(number), "consent": True, "captcha": "x"})


def test_full_flow_and_submit_gate(client):
    lo = get_index().by_id[BLOCK]["addr_lo"]
    req = _new_request(client)
    rid = req["id"]
    assert req["status"] == "draft" and req["petition_due"] == "2027-08-21"
    # edit
    r = client.patch(f"/v1/requests/{rid}", headers=A, json={"guests": 70}, )
    assert r.status_code == 200 and r.json()["version"] == "2"
    assert client.patch(f"/v1/requests/{rid}", headers={**A, "If-Match": "1"},
                        json={"guests": 80}).status_code == 409
    # petition
    r = client.post(f"/v1/requests/{rid}/petition", headers=A)
    assert r.status_code == 200 and r.json()["status"] == "collecting"
    url = r.json()["petition_url"]
    assert client.post(f"/v1/requests/{rid}/petition", headers=A).json()["petition_url"] == url
    token = url.rsplit("/", 1)[1]
    # submit blocked until 10
    for i in range(9):
        assert _sign(client, token, lo + i, f"Secret Name {i}").status_code == 201
    r = client.post(f"/v1/requests/{rid}/submit", headers=A)
    assert r.status_code == 422 and r.json()["code"] == "submit_blocked"
    assert "Needs 1 more address (9 of 10)." in r.json()["reasons"][0]
    # duplicate + off-block do not count
    assert _sign(client, token, lo).json()["state"] == "duplicate_address"
    r = _sign(client, token, lo + 500)
    assert r.json()["state"] == "off_block" and r.json()["distinct_count"] == 9
    assert client.post(f"/v1/requests/{rid}/submit", headers=A).status_code == 422
    # public view never leaks names
    r = client.get(f"/v1/petitions/{token}")
    assert r.status_code == 200 and "Secret Name" not in r.text
    assert r.json()["open"] is True and r.json()["distinct_count"] == 9
    # consent / captcha
    assert client.post(f"/v1/petitions/{token}/signatures", json={
        "name": "x", "house_number": "1", "consent": False, "captcha": "x"}).status_code == 422
    # 10th
    assert _sign(client, token, lo + 9).json()["distinct_count"] == 10
    sigs = client.get(f"/v1/requests/{rid}/signatures", headers=A).json()
    assert sigs["distinct_count"] == 10 and len(sigs["signatures"]) == 12
    assert sigs["signatures"][0]["address"].startswith(f"{lo} S Harvey Ave")
    assert client.get(f"/v1/requests/{rid}/signatures", headers=B).status_code == 403
    # strike then restore count by another sign
    sid = sigs["signatures"][1]["id"]
    r = client.post(f"/v1/requests/{rid}/signatures/{sid}/strike", headers=A)
    assert r.status_code == 200 and r.json()["state"] == "struck"
    assert client.post(f"/v1/requests/{rid}/submit", headers=A).status_code == 422
    assert _sign(client, token, lo + 20).json()["distinct_count"] == 10
    r = client.post(f"/v1/requests/{rid}/submit", headers=A)
    assert r.status_code == 200 and r.json()["status"] == "submitted" and r.json()["submitted_at"]
    # closed petition
    assert client.get(f"/v1/petitions/{token}").status_code == 410
    assert _sign(client, token, lo + 21).status_code == 410
    assert client.get("/v1/petitions/" + "0" * 32).status_code == 404
    # request thread exists, reviewer can read
    card = client.get(f"/v1/requests/{rid}", headers=A).json()
    assert card["village_thread_id"]
    assert client.get(f"/v1/threads/{card['village_thread_id']}/messages", headers=REV).status_code == 200
    # withdraw
    r = client.post(f"/v1/requests/{rid}/withdraw", headers=A)
    assert r.status_code == 200 and r.json()["status"] == "withdrawn"
    assert client.post(f"/v1/requests/{rid}/withdraw", headers=A).status_code == 409


def test_create_validation(client):
    base = {"date_start": "2027-09-04", "date_end": "2027-09-04", "guests": 10,
            "services": {"barricades": True, "green_kit": True}}
    r = client.post("/v1/requests", headers=A, json={**base, "block_id": "SUPERIOR ST|1100"})
    assert r.status_code == 422
    r = client.post("/v1/requests", headers=A, json={**base, "block_id": BLOCK, "date_start": "2027-12-04",
                                                     "date_end": "2027-12-04"})
    assert r.status_code == 422 and r.json()["code"] == "out_of_season"


def test_auth_and_ownership(client):
    assert client.get("/v1/requests/r1", headers=B).status_code == 403
    assert client.get("/v1/requests/r1", headers=A).status_code == 200
    assert client.get("/v1/requests/nope", headers=A).status_code == 404
    r = client.post("/v1/requests", headers=H("vendor-icecream"), json={
        "block_id": BLOCK, "date_start": "2027-09-04", "date_end": "2027-09-04", "guests": 10,
        "services": {"barricades": True, "green_kit": True}})
    assert r.status_code == 403
    assert client.get("/v1/me/requests").status_code == 401


def test_change_requests_and_me(client):
    r = client.post("/v1/requests/r1/change-requests", headers=A,
                    json={"type": "reschedule", "proposed_start": "2027-06-26", "proposed_end": "2027-06-26",
                          "message": "Can we move a week?"})
    assert r.status_code == 201 and r.json()["status"] == "open"
    r = client.post("/v1/requests/r1/change-requests", headers=A, json={"type": "cancel", "message": "never mind"})
    assert r.status_code == 409 and r.json()["code"] == "open_change_request"
    assert client.post("/v1/requests/r3/change-requests", headers=A,
                       json={"type": "cancel", "message": "x"}).status_code == 409
    cards = client.get("/v1/me/requests", headers=A).json()["requests"]
    ids = [c["id"] for c in cards]
    assert {"r1", "r3", "r9"} <= set(ids)
    r1 = next(c for c in cards if c["id"] == "r1")
    assert r1["open_change_request"]["type"] == "reschedule"
    states = {v["service"]: v["state"] for v in r1["vendors"]}
    assert states == {"ice_cream": "Coming", "food_truck": "Waiting for vendor"}
    assert r1["stepper"]["approved"] is True and r1["distinct_count"] == 10 and r1["block_year_used"] == 1
    assert next(c for c in cards if c["id"] == "r3")["vendors"] == []


def test_threads(client):
    r = client.post("/v1/threads/t_r1/messages", headers=A, json={"body": "Thanks!"})
    assert r.status_code == 201 and r.json()["author_role"] == "resident"
    assert client.post("/v1/threads/t_r1/messages", headers=B, json={"body": "hi"}).status_code == 403
    assert client.get("/v1/threads/t_r1/messages", headers=B).status_code == 403
    r = client.get("/v1/threads/t_r1/messages", headers=REV)
    assert r.status_code == 200 and r.json()["thread"]["kind"] == "request"
    assert any(m["body"] == "Thanks!" for m in r.json()["messages"])
    assert client.post("/v1/threads/t_r1/messages", headers=A, json={"body": ""}).status_code == 422
    # job thread: its vendor yes, other vendor no
    assert client.get("/v1/threads/t_r1_job/messages", headers=H("vendor-icecream")).status_code == 200
    assert client.get("/v1/threads/t_r1_job/messages", headers=H("vendor-taco")).status_code == 403
    r = client.post("/v1/threads/t_r1_job/messages", headers=H("vendor-icecream"), json={"body": "On my way"})
    assert r.json()["author_role"] == "vendor"
    assert client.get("/v1/threads/nope/messages", headers=A).status_code == 404
