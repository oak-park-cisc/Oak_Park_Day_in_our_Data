def test_health(client):
    r = client.get("/v1/health")
    assert r.status_code == 200
    assert r.json()["blocks"] > 800 and r.json()["ok"] is True


def test_not_found(client):
    r = client.get("/v1/nope")
    assert r.status_code == 404
    assert set(r.json()) == {"code", "message", "reasons"}
