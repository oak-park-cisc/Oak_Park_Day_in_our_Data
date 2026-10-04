import re

import pytest

from app import rules as R
from app.config import DEFAULT_RULES

RULES = DEFAULT_RULES
BLOCK = {"addr_lo": 1100, "addr_hi": 1199, "eligible": True, "reason": "", "bus_stop_list": [],
         "school_nearby": None}


def test_petition_due():
    assert R.petition_due("2026-10-17") == "2026-10-03"


def test_season():
    assert R.season_problems("2026-11-02", "2026-11-02", RULES) == ["2026-11-02 is outside the Apr 4–Oct 31 season"]
    assert R.season_problems("2026-06-02", "2026-06-01", RULES) == ["End date is before start date"]


def test_weekend_key():
    assert R.weekend_key("2027-06-20") == "2027-06-19"
    assert R.weekend_key("2027-06-16") is None
    assert R.weekend_key("2027-06-19") == "2027-06-19"


def test_candidates():
    assert R.candidate_dates("2027-06-12", "2027-06-26", RULES) == ["2027-06-12", "2027-06-19", "2027-06-26"]
    assert R.candidate_dates("2027-06-14", "2027-06-16", RULES) == ["2027-06-14", "2027-06-15", "2027-06-16"]


def test_distinct():
    sigs = [{"house_number": str(1100 + i)} for i in range(10)]
    sigs[9] = {"house_number": "1100"}
    assert R.distinct_addresses(sigs, BLOCK)["count"] == 9
    r = R.distinct_addresses([{"house_number": "1105 1/2"}, {"house_number": "1105"},
                              {"house_number": "900"}, {"house_number": "1101", "state": "struck"}], BLOCK)
    assert r["states"] == ["counted", "duplicate_address", "off_block", "struck"]
    assert r["count"] == 1


def test_traffic_score():
    blk = dict(BLOCK, bus_stop_list=[{"stop_id": "1", "lat": 0, "lon": 0, "weekday_trips": 140}])
    out = R.traffic_score(blk, "2027-06-19", {"rules": RULES})
    assert out["score"] == 25 and out["level"] == "medium" and len(out["reasons"]) == 2
    assert not any(re.search(r"delay|minute", x["text"], re.I) for x in out["reasons"])
    with pytest.raises(ValueError):
        R.traffic_score(dict(BLOCK, eligible=False, reason="no"), "2027-06-19", {"rules": RULES})


def test_can_approve():
    req = {"status": "submitted", "date_start": "2027-06-12", "date_end": "2027-06-26",
           "submitted_at": "2026-10-01T09:00:00+00:00"}
    ctx = {"block": BLOCK, "rules": RULES, "distinct_count": 4, "paper_attested": False,
           "weekend_approved_count": 0, "block_year_count_excl": 0, "same_day_block_approved": False}
    out = R.can_approve(req, "2027-06-19", ctx)
    assert not out["ok"] and "4 of 10" in " ".join(out["reasons"])
    assert R.can_approve(req, "2027-06-19", dict(ctx, distinct_count=10))["ok"]


OFFER = {"vendor_account_id": "va_icecream", "status": "approved", "active": True, "service": "ice_cream",
         "max_guests": 150, "jobs_per_day": 2, "days": ["saturday", "sunday"], "zips": ["60302", "60304"],
         "accepted_on_date": 0, "already_matched": False, "service_filled": False}


def test_match():
    req = {"date": "2027-06-19", "guests": 120, "zip": "60304"}
    out = R.match(req, [OFFER])
    assert out[0]["vendor_account_id"] == "va_icecream" and out[0]["why"][0] == "Available on Saturdays"
    assert R.match(dict(req, guests=200), [OFFER]) == []
    assert R.match(dict(req, zip="60301"), [OFFER]) == []
    assert R.match(req, [dict(OFFER, accepted_on_date=2)]) == []


def test_suggest():
    out = R.suggest([{"block_id": "b", "label": "1100 S X Ave", "near_labels": ["1200 S Y Ave"],
                      "has_school": False, "busy_trips": [140], "alt_saturdays": ["2027-06-26"]}], False)
    assert out["suggestions"][0]["kind"] == "other_saturday"
    assert out["suggestions"][0]["apply"] == {"block_id": "b", "date": "2027-06-26"}
    assert len(out["tips"]) == 1
