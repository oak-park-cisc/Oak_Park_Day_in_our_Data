import pytest

REV = {"Authorization": "Bearer dev-reviewer"}


@pytest.fixture(autouse=True, scope="module")
def _reseed():
    from app import seed
    seed.run()


def _payload(**over):
    p = {"question": "Why is this date risky?", "date": "2027-06-26", "is_weekday": False,
         "closures": [{"label": "1100 S Cuyler Ave", "score": 40, "level": "medium",
                       "reasons": [{"pts": 10, "text": "Closure that weekend"}]}],
         "weekend": {"count": 2, "cap": 30},
         "suggestions": [{"text": "Try the next Saturday."}], "tips": ["Tell neighbors early."]}
    p.update(over)
    return p


def _post(client, body):
    return client.post("/v1/ai/explain", headers=REV, json=body)


def test_normal_payload_ok(client):
    r = _post(client, _payload())
    assert r.status_code == 200 and r.json()["source"] == "template"


def test_oversized_inputs_rejected(client):
    closure = _payload()["closures"][0]
    bad = [
        _payload(question="x" * 301),
        _payload(closures=[closure] * 51),
        _payload(closures=[dict(closure, level="extreme")]),
        _payload(closures=[dict(closure, score=101)]),
        _payload(closures=[dict(closure, label="x" * 201)]),
        _payload(closures=[dict(closure, reasons=[{"pts": 1, "text": "r"}] * 21)]),
        _payload(suggestions=[{"text": "s"}] * 21),
        _payload(tips=["t"] * 21),
        _payload(tips=["t" * 201]),
        _payload(weekend={"count": 1001, "cap": 30}),
    ]
    for body in bad:
        r = _post(client, body)
        assert r.status_code == 422 and r.json()["code"] == "validation_error"
