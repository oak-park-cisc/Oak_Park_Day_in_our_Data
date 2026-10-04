"""Pure rules engine. No I/O, no DB, no date.today(). Callers pass `today` where needed."""
from __future__ import annotations

import re
from datetime import date, timedelta

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _d(s: str) -> date:
    return date.fromisoformat(s)


def petition_due(date_start: str, lead_days: int = 14) -> str:
    return (_d(date_start) - timedelta(days=lead_days)).isoformat()


def _mmdd_label(mmdd: str) -> str:
    m, d = mmdd.split("-")
    return f"{MONTHS[int(m) - 1]} {int(d)}"


def _in_season(d: str, rules: dict) -> bool:
    y = d[:4]
    s = rules["season"]
    return f"{y}-{s['start_mmdd']}" <= d <= f"{y}-{s['end_mmdd']}"


def season_problems(start: str, end: str, rules: dict) -> list[str]:
    s = rules["season"]
    label = f"{_mmdd_label(s['start_mmdd'])}–{_mmdd_label(s['end_mmdd'])}"
    out: list[str] = []
    for d in dict.fromkeys([start, end]):
        if not _in_season(d, rules):
            out.append(f"{d} is outside the {label} season")
    if start > end:
        out.append("End date is before start date")
    return out


def weekend_key(d: str) -> str | None:
    wd = _d(d).weekday()  # Mon=0 .. Sat=5, Sun=6
    if wd == 5:
        return d
    if wd == 6:
        return (_d(d) - timedelta(days=1)).isoformat()
    return None


def day_class(d: str) -> str:
    wd = _d(d).weekday()
    return "saturday" if wd == 5 else "sunday" if wd == 6 else "weekday"


def candidate_dates(start: str, end: str, rules: dict) -> list[str]:
    s, e = _d(start), _d(end)
    days = []
    cur = s
    while cur <= e:
        iso = cur.isoformat()
        if _in_season(iso, rules):
            days.append(iso)
        cur += timedelta(days=1)
    sats = [x for x in days if day_class(x) == "saturday"]
    return sats or days


_HOUSE = re.compile(r"^(\d+)(?:\s*(?:1/2|½))?$")


def distinct_addresses(signatures: list[dict], block: dict) -> dict:
    seen: set[int] = set()
    states: list[str] = []
    count = 0
    for sig in signatures:
        if sig.get("state") == "struck":
            states.append("struck")
            continue
        m = _HOUSE.match(str(sig.get("house_number", "")).strip())
        if not m:
            states.append("off_block")
            continue
        n = int(m.group(1))
        if not block["addr_lo"] <= n <= block["addr_hi"]:
            states.append("off_block")
        elif n in seen:
            states.append("duplicate_address")
        else:
            seen.add(n)
            count += 1
            states.append("counted")
    return {"count": count, "states": states}


def block_year_count(block_id: str, year: int, requests: list[dict], exclude_id: str | None = None) -> int:
    n = 0
    for r in requests:
        if r["id"] == exclude_id or r["block_id"] != block_id:
            continue
        if r["status"] not in ("submitted", "approved", "completed"):
            continue
        d = r.get("approved_date") or r["date_start"]
        if int(d[:4]) == year:
            n += 1
    return n


def can_approve(request: dict, date: str, ctx: dict) -> dict:
    block, rules = ctx["block"], ctx["rules"]
    reasons: list[str] = []
    if request["status"] != "submitted":
        reasons.append("Only submitted requests can be approved.")
    if not block["eligible"]:
        reasons.append(block["reason"])
    if not (request["date_start"] <= date <= request["date_end"]):
        reasons.append("That date is outside the requested range.")
    reasons.extend(season_problems(date, date, rules))
    mn = rules["petition_min_addresses"]
    if ctx["distinct_count"] < mn and not ctx["paper_attested"]:
        reasons.append(f"Petition has {ctx['distinct_count']} of {mn} addresses.")
    sub = request.get("submitted_at")
    if sub:
        sub_date = str(sub)[:10]
        if sub_date > petition_due(date, rules["petition_lead_days"]):
            reasons.append("Petition came in less than 2 weeks before that date.")
    wk = weekend_key(date)
    wc = ctx.get("weekend_approved_count")
    mw = rules["max_events_per_weekend"]
    if wk and wc is not None and wc >= mw:
        reasons.append(f"Weekend is at {wc} of {mw}.")
    mb = rules["max_events_per_block_per_year"]
    if ctx["block_year_count_excl"] >= mb:
        reasons.append(f"This block already has {mb} events in {date[:4]}.")
    if ctx["same_day_block_approved"]:
        reasons.append("Another event is already approved on this block that day.")
    return {"ok": not reasons, "reasons": reasons}


def level(score: int) -> str:
    return "low" if score < 25 else "medium" if score < 50 else "high"


def traffic_score(block: dict, date: str, ctx: dict) -> dict:
    if not block["eligible"]:
        raise ValueError(block["reason"])
    reasons: list[dict] = []

    def add(pts: int, text: str, rule_id: str):
        reasons.append({"pts": pts, "text": text, "rule_id": rule_id})

    for stop in block.get("bus_stop_list", []):
        add(15, "1 bus stop on the block", "bus_stop")
        if stop["weekday_trips"] > 100:
            add(10, f"Busy stop: {stop['weekday_trips']} weekday trips", "busy_stop")
    if block.get("school_nearby"):
        if day_class(date) == "weekday":
            add(20, "School within 150 m on a weekday", "school")
        else:
            add(0, "School nearby; counts on weekdays only", "school_weekend")
    for c in ctx.get("other_closures", []):
        if c.get("same_street"):
            add(10, f"Another closure that weekend on the same street ({c['label']})", "nearby_closure")
        else:
            add(10, f"Another closure that weekend within 200 m ({c['label']})", "nearby_closure")
    for p in ctx.get("pending_nearby", []):
        add(0, f"Pending request nearby may add +10 ({p['label']})", "pending_nearby")
    wc = ctx.get("weekend_approved_count")
    if wc is not None and wc >= 25:
        add(10, f"Weekend is at {wc} of {ctx['rules']['max_events_per_weekend']}", "weekend_load")
    if not reasons:
        add(0, "No bus stops, schools or nearby closures", "none")
    score = min(100, sum(r["pts"] for r in reasons))
    return {"score": score, "level": level(score), "reasons": reasons}


def suggest(items: list[dict], is_weekday: bool) -> dict:
    suggestions: list[dict] = []
    tips: list[str] = []
    for it in items:
        near, alts = it.get("near_labels") or [], it.get("alt_saturdays") or []
        if near and alts:
            alt = alts[0]
            suggestions.append({
                "kind": "other_saturday",
                "text": f"Approve {it['label']} on {alt} instead: it is next to {', '.join(near)}, "
                        f"so this removes {10 * len(near)} points.",
                "apply": {"block_id": it["block_id"], "date": alt}})
        for trips in it.get("busy_trips") or []:
            if trips > 100:
                tips.append(f"{it['label']} has a busy bus stop ({trips} weekday trips). "
                            f"Let the bus agency know before the day.")
    if is_weekday and any(it.get("has_school") for it in items):
        suggestions.append({
            "kind": "weekday_to_saturday",
            "text": "Hold these on a Saturday instead: school points only apply on weekdays.",
            "apply": {"weekday": False}})
    return {"suggestions": suggestions, "tips": tips}


def match(request: dict, offers: list[dict]) -> list[dict]:
    dc = day_class(request["date"])
    word = {"saturday": "Saturdays", "sunday": "Sundays", "weekday": "weekdays"}[dc]
    guests, z = request["guests"], request.get("zip")
    out = []
    for o in offers:
        if (o["status"] == "approved" and o["active"] and dc in o["days"]
                and guests <= o["max_guests"] and (z is None or z in o["zips"])
                and o["accepted_on_date"] < o["jobs_per_day"]
                and not o["already_matched"] and not o["service_filled"]):
            out.append({"vendor_account_id": o["vendor_account_id"], "why": [
                f"Available on {word}",
                f"{guests} guests is within your {o['max_guests']}",
                f"{z} is in your area" if z is not None else "Area not checked (zip unknown)"]})
    return sorted(out, key=lambda x: x["vendor_account_id"])
