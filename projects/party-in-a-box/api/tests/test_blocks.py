import pytest

from app.blocks import get_index
from app.config import REPO_ROOT

has_json = (REPO_ROOT / "web" / "data" / "blocks.json").exists()


@pytest.mark.skipif(has_json, reason="blocks.json present")
def test_fallback_counts():
    blocks = get_index().all()
    assert len(blocks) == 887
    assert sum(1 for b in blocks if b["ns"] is False) == 342
    assert sum(1 for b in blocks if b["eligible"]) == 441


def test_find_cuyler():
    idx = get_index()
    block, n = idx.find_block("1100 S Cuyler Ave")
    assert block["id"] == "S CUYLER AVE|1100"
    assert n == 1100 and block["eligible"]
    assert block["tree_count"] == 55 and block["big_tree_count"] == 18


def test_find_ineligible():
    block, _ = get_index().find_block("600 Superior St")
    assert not block["eligible"]
    assert block["nearest_eligible"] is not None


def test_label_and_unknown():
    idx = get_index()
    assert idx.label(idx.by_id["S CUYLER AVE|1100"]) == "1100 S Cuyler Ave"
    assert idx.find_block("Cuyler Ave") is None
    assert idx.find_block("1100 Nowhere Pkwy") is None
