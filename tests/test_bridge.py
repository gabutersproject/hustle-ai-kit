import json
from datetime import date

from engine.bridge import handle
from engine.store import load_default


TODAY = "2026-10-12"
NOTE = (
    "Hi, I'm Priya. We just bought a place in Catskill and the dining room is awkward, "
    "about 9 feet by 11. We want a table that seats 6, maybe 8 with a leaf. Walnut if it's "
    "not crazy, otherwise white oak. My partner hates glossy finishes. We'd need it before "
    "Thanksgiving if that's even possible. Budget is around 4-5k."
)
TICKET = {
    "client_name": "Priya",
    "piece": "dining_table",
    "quantity": 1,
    "seats": 6,
    "leaf": False,
    "species_primary": "walnut",
    "species_alternate": "white_oak",
    "finish": "hardwax_oil",
    "delivery": "mid_hudson",
    "base_style": "trestle",
    "budget_low": 4000,
    "budget_high": 5000,
    "deadline_raw": "before Thanksgiving",
    "place_raw": "Catskill",
    "waterfall": False,
    "cable_grommet": False,
    "width_in": 9,
    "depth_in": 11,
}


def _call(action: str, body: dict) -> dict:
    raw = json.loads(handle(action, json.dumps(body)))
    assert raw["ok"] is True, raw
    return raw["data"]


def test_prepare_read_refuses_a_fragment():
    raw = json.loads(handle("prepare_read", json.dumps({"inquiry": "hi", "today": TODAY})))
    assert raw["ok"] is False
    assert "Paste a little more" in raw["detail"]


def test_finish_read_drops_the_room_and_keeps_the_leaf():
    result = _call(
        "finish_read",
        {"inquiry": NOTE, "content": json.dumps(TICKET), "seconds": 1.2, "completion_tokens": 40, "today": TODAY},
    )
    reading = result["reading"]
    assert reading["leaf"] is True
    assert reading["width_in"] == 0
    assert reading["depth_in"] == 0
    assert reading["client_name"] == "Priya"
    assert result["model"]["name"] == "Qwen2.5-1.5B-Instruct"


def test_browser_price_matches_the_rate_card():
    priced = _call(
        "price",
        {
            "today": TODAY,
            "inquiry": NOTE,
            "reading": {**TICKET, "leaf": True, "width_in": 0, "depth_in": 0},
            "save": False,
            "created_at": "2026-10-12T12:00:00-04:00",
        },
    )
    by_id = {option["id"]: option for option in priced["options"]}
    assert by_id["white_oak"]["total_cents"] == 443_800
    assert by_id["walnut"]["total_cents"] == 559_200
    assert priced["recommended_id"] == "white_oak"
    assert "Thanksgiving" in (priced["lead_conflict"] or "")
    assert load_default().shop.name == "Mara Ellison Studio"
