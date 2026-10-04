"""AI explain proxy logic. Explains computed traffic scores only; never decides anything.

The key and the user's question are never logged: only input_hash, latency and fallback_used.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from datetime import date as _date

import httpx

from .config import settings

log = logging.getLogger("app.ai")

API_URL = "https://api.anthropic.com/v1/messages"
TIMEOUT_S = 15.0  # Sonnet answers in ~5 s; fall back to the template after this
LABEL_AI = "AI-written"
LABEL_TEMPLATE = "Templated summary (AI unavailable)"

SYSTEM_PROMPT = (
    "You explain rule-based traffic impact scores to Village staff. Use only numbers and reasons in the JSON. "
    "Never estimate delay, minutes, volumes or speeds. Never recommend approving or rejecting. "
    "You may only point to suggestions in `suggestions`, by index. "
    "If the question can't be answered from the data, say so. "
    'Reply with only a JSON object: {"summary": string (at most 120 words), '
    '"answer": string (at most 80 words), "referenced_suggestions": [integer indexes into suggestions]}.')

_BANNED = re.compile(r"\b(delay|delays|minutes?|mins)\b|congestion time", re.I)
_ADVICE = re.compile(
    r"(^|[.!?]\s+)(approve|reject)\b"
    r"|\b(should|recommend\w*|suggest\w*|advise\w*|must|consider|please|better to|go ahead and)\b[^.!?]{0,40}\b(approv\w*|reject\w*)",
    re.I)


def input_hash(inp: dict) -> str:
    return hashlib.sha256(json.dumps(inp, sort_keys=True).encode("utf-8")).hexdigest()[:12]


def _day_label(d: str) -> str:
    try:
        dt = _date.fromisoformat(d)
        return f"{dt.strftime('%A')}, {dt.strftime('%B')} {dt.day}, {dt.year}"
    except ValueError:
        return d


def template_result(inp: dict) -> dict:
    day = _day_label(inp["date"])
    closures = inp.get("closures") or []
    if not closures:
        summary = f"No test closures on {day} yet. Add blocks on the map to see their impact."
    else:
        top = max(closures, key=lambda c: c["score"])
        reasons = "; ".join(r["text"] for r in top.get("reasons", [])) or "no scoring reasons"
        n = len(closures)
        summary = (f"With {n} test closure{'s' if n != 1 else ''} on {day}, the highest impact is "
                   f"{top['level']} ({top['score']} of 100) on {top['label']}, because of: {reasons}.")
        wk = inp.get("weekend")
        if wk:
            summary += f" That weekend would have {wk['count']} of {wk['cap']} block events."
        k = len(inp.get("suggestions") or [])
        if k:
            summary += f" I found {k} way{'s' if k != 1 else ''} to lower it below."
    return {"summary": summary,
            "answer": "The assistant is unavailable, so there is no written answer to your question. "
                      "Scores come from fixed rules.",
            "referenced_suggestions": [], "source": "template", "label": LABEL_TEMPLATE}


def call_model(system: str, user_json: str) -> str:
    """POST to the Messages API and return the raw text of the first content block."""
    resp = httpx.post(
        API_URL,
        headers={"x-api-key": settings.ANTHROPIC_API_KEY or "", "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        # No `temperature`: current Claude models reject it (HTTP 400). Output is validated instead.
        json={"model": settings.ANTHROPIC_MODEL, "max_tokens": 1024, "system": system,
              "messages": [{"role": "user", "content": user_json}]},
        timeout=TIMEOUT_S)
    resp.raise_for_status()
    # The reply may start with a thinking block; use only the text blocks.
    texts = [b["text"] for b in resp.json().get("content", []) if b.get("type") == "text"]
    if not texts:
        raise ValueError("no text in model reply")
    return "".join(texts)


def _parse(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text).strip()
    try:
        data = json.loads(text)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def validate_output(raw: str, inp: dict) -> dict | None:
    """Return the cleaned {summary, answer, referenced_suggestions} or None if it fails any check."""
    data = _parse(raw)
    if data is None:
        return None
    summary, answer, refs = data.get("summary"), data.get("answer"), data.get("referenced_suggestions", [])
    if not isinstance(summary, str) or not isinstance(answer, str) or not isinstance(refs, list):
        return None
    if len(summary.split()) > 120 or len(answer.split()) > 80:
        return None
    n_sug = len(inp.get("suggestions") or [])
    if not all(isinstance(i, int) and not isinstance(i, bool) and 0 <= i < n_sug for i in refs):
        return None
    text = f"{summary}\n{answer}"
    if _BANNED.search(text) or _ADVICE.search(text):
        return None
    allowed = set(re.findall(r"\d+", json.dumps(inp)))
    if not set(re.findall(r"\d+", text)) <= allowed:
        return None
    return {"summary": summary.strip(), "answer": answer.strip(), "referenced_suggestions": refs}


def explain(inp: dict) -> dict:
    """Template when there is no key; otherwise AI with strict validation and template fallback."""
    h = input_hash(inp)
    start = time.monotonic()
    result = None
    if settings.ANTHROPIC_API_KEY:
        # One retry if the first answer fails validation and there's time left for a second call.
        for _attempt in range(2):
            try:
                raw = call_model(SYSTEM_PROMPT, json.dumps(inp))
                ok = validate_output(raw, inp)
                if ok and time.monotonic() - start <= TIMEOUT_S:
                    result = dict(ok, source="ai", label=LABEL_AI)
                    break
            except Exception:  # noqa: BLE001 - any failure falls back; never log details (may echo input)
                result = None
            if time.monotonic() - start > TIMEOUT_S / 2:
                break
    fallback = result is None
    if fallback:
        result = template_result(inp)
    log.info("ai_explain input_hash=%s latency_ms=%d fallback_used=%s", h,
             int((time.monotonic() - start) * 1000), fallback)
    return result
