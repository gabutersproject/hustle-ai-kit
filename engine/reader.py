from __future__ import annotations

import json
import os
import re
import threading
import time
from datetime import date
from pathlib import Path

from engine.schemas import Pricebook, ReadResult, Reading

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(
    os.environ.get(
        "SAWHORSE_MODEL",
        ROOT / "models" / "qwen2.5-1.5b-instruct-q5_k_m.gguf",
    )
)

MODEL_META = {
    "name": "Qwen2.5-1.5B-Instruct",
    "repo": "Qwen/Qwen2.5-1.5B-Instruct-GGUF",
    "file": MODEL_PATH.name,
    "parameters": "1.5 billion",
    "quantization": "Q5_K_M",
    "license": "Apache-2.0",
    "runner": "llama.cpp",
    "role": "Reads a client note into a job ticket. The grammar has no price field.",
}

_lock = threading.Lock()
_state: dict[str, object] = {"llm": None, "loading": False, "error": None}


def model_state() -> dict[str, object]:
    return {
        "loaded": _state["llm"] is not None,
        "loading": bool(_state["loading"]),
        "error": _state["error"],
        "model": MODEL_META,
        "path": str(MODEL_PATH),
    }


def load_model() -> None:
    if _state["llm"] is not None or _state["loading"]:
        return
    _state["loading"] = True
    _state["error"] = None
    try:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model file not found at {MODEL_PATH}. Run scripts/download_model.sh."
            )
        from llama_cpp import Llama

        threads = min(4, os.cpu_count() or 4)
        _state["llm"] = Llama(
            model_path=str(MODEL_PATH),
            n_ctx=4096,
            n_threads=threads,
            n_batch=256,
            verbose=False,
            use_mmap=True,
        )
    except Exception as exc:  # noqa: BLE001 — surface any load failure to the desk
        _state["error"] = str(exc)
        _state["llm"] = None
    finally:
        _state["loading"] = False


def _schema(book: Pricebook) -> dict:
    species = [item.id for item in book.species]
    finishes = [item.id for item in book.finishes]
    zones = [item.id for item in book.delivery]
    pieces = [item.id for item in book.pieces]
    bases = sorted({style.id for piece in book.pieces for style in piece.bases})
    properties = {
        "client_name": {"type": "string"},
        "piece": {"type": "string", "enum": pieces},
        "quantity": {"type": "integer"},
        "seats": {"type": "integer"},
        "leaf": {"type": "boolean"},
        "species_primary": {"type": "string", "enum": species + ["unspecified"]},
        "species_alternate": {"type": "string", "enum": species + ["none"]},
        "finish": {"type": "string", "enum": finishes + ["unspecified"]},
        "delivery": {"type": "string", "enum": zones + ["unspecified"]},
        "base_style": {"type": "string", "enum": bases + ["unspecified"]},
        "budget_low": {"type": "integer"},
        "budget_high": {"type": "integer"},
        "deadline_raw": {"type": "string"},
        "place_raw": {"type": "string"},
        "waterfall": {"type": "boolean"},
        "cable_grommet": {"type": "boolean"},
        "width_in": {"type": "integer"},
        "depth_in": {"type": "integer"},
    }
    return {"type": "object", "properties": properties, "required": list(properties)}


def _prompt(book: Pricebook, inquiry: str, today: date) -> str:
    species = "\n".join(f"- {item.id}: {item.label}. {item.note}".rstrip() for item in book.species)
    finishes = "\n".join(f"- {item.id}: {item.label} ({item.sheen})" for item in book.finishes)
    zones = "\n".join(f"- {item.id}: {item.label}" for item in book.delivery)
    pieces = "\n".join(f"- {item.id}: {item.label}" for item in book.pieces)
    glossary_lines = []
    for entry in book.glossary[:40]:
        extra = f" ({entry.note})" if entry.note else ""
        glossary_lines.append(f"- \"{entry.phrase}\" means {entry.kind} {entry.value}{extra}")
    glossary = "\n".join(glossary_lines) or "- (none)"
    pretty_today = f"{today.day} {today.strftime('%B %Y')}"
    return f"""Today is {pretty_today}. Fill the job ticket from the client note.
Never state a price. The ticket has no price field.

Pieces:
{pieces}

Woods (use the id, not a guess):
{species}

Finishes:
{finishes}

Delivery:
{zones}

Glossary for this shop. If a phrase appears, use its id:
{glossary}

Hard rules:
- The client is the sender, never the maker they greet. "Hi Mara — June here" means client_name June.
- piece is the furniture to build. A room's dimensions are not width_in or depth_in.
- seats is the count without a leaf. "6, or 8 with a leaf" means seats 6 and leaf true. Otherwise seats 0.
- species_primary is their first choice. species_alternate is the fallback they allowed, else none. "walnut unless it's too much, then white oak" means walnut then white_oak.
- "hard maple" is maple. Do not substitute white_oak when they named a wood.
- hates glossy, not glossy, matte, or oil means finish hardwax_oil. Rubio means rubio. Glossy means lacquer. If they say nothing about the surface, finish is unspecified.
- pickup wins when they will collect it. If they offer pickup or delivery, use the delivery zone. Towns come from the glossary. "40 minutes from Hudson" is mid_hudson.
- base_style stays unspecified unless they name trestle, legs, or a pedestal.
- Money is never a deadline. "4-5k" means budget_low 4000 and budget_high 5000. "around two thousand" means 2000 and 2000. "under fifteen hundred" or "under nine hundred" means budget_low 0 and that amount as budget_high. No money mentioned means both budgets are 0.
- deadline_raw is only a time phrase such as "before Thanksgiving" or "before the new year", else empty.
- place_raw is a town or neighborhood, else empty.
- cable_grommet is true when they mention a hole, grommet, or charger cable.
- waterfall is true only for waterfall ends.
- width_in is inches. "four feet" is 48. Use 0 when they did not size the piece.
- quantity is usually 1.

Examples:
Note: Hi Mara — June here. Hard maple desk, a hole for the charger, I'll pick it up. Around two thousand.
Ticket: {{"client_name":"June","piece":"desk","quantity":1,"seats":0,"leaf":false,"species_primary":"maple","species_alternate":"none","finish":"unspecified","delivery":"pickup","base_style":"unspecified","budget_low":2000,"budget_high":2000,"deadline_raw":"","place_raw":"","waterfall":false,"cable_grommet":true,"width_in":0,"depth_in":0}}

Note: We hate glossy finishes. Walnut dining table for 6, or white oak if walnut is too much, with a leaf so 8 can sit.
Ticket: {{"client_name":"","piece":"dining_table","quantity":1,"seats":6,"leaf":true,"species_primary":"walnut","species_alternate":"white_oak","finish":"hardwax_oil","delivery":"unspecified","base_style":"unspecified","budget_low":0,"budget_high":0,"deadline_raw":"","place_raw":"","waterfall":false,"cable_grommet":false,"width_in":0,"depth_in":0}}

Note: Under nine hundred for a bookshelf, four feet wide, Brooklyn. We can pick up or you can deliver.
Ticket: {{"client_name":"","piece":"bookshelf","quantity":1,"seats":0,"leaf":false,"species_primary":"unspecified","species_alternate":"none","finish":"unspecified","delivery":"nyc","base_style":"unspecified","budget_low":0,"budget_high":900,"deadline_raw":"","place_raw":"Brooklyn","waterfall":false,"cable_grommet":false,"width_in":48,"depth_in":0}}

Note: It's Ana. Ash bench, no rush, we are in Rhinebeck.
Ticket: {{"client_name":"Ana","piece":"bench","quantity":1,"seats":0,"leaf":false,"species_primary":"ash","species_alternate":"none","finish":"unspecified","delivery":"mid_hudson","base_style":"unspecified","budget_low":0,"budget_high":0,"deadline_raw":"","place_raw":"Rhinebeck","waterfall":false,"cable_grommet":false,"width_in":0,"depth_in":0}}

Client note:
\"\"\"{inquiry.strip()}\"\"\""""


def _normalize_budget(value: int, inquiry: str) -> int:
    if value <= 0:
        return 0
    if value < 100 and re.search(r"hundred", inquiry, re.I):
        return value * 100
    if value < 10:
        return value * 1000
    return value


def apply_note_guards(reading: Reading, inquiry: str) -> Reading:
    """Correct a few high-confidence misses without touching the rate card.

    A 1.5B model copies example shapes. These checks put the leaf, the room
    size, and an unstated finish back on what the note actually said.
    """
    updates: dict[str, object] = {
        "leaf": bool(re.search(r"\bleaf\b", inquiry, re.I)),
    }
    room = re.search(r"(\d+)\s*(?:feet|ft)\s*by\s*(\d+)", inquiry, re.I)
    if room:
        leaked = {int(room.group(1)), int(room.group(2))}
        if reading.width_in in leaked:
            updates["width_in"] = 0
        if reading.depth_in in leaked:
            updates["depth_in"] = 0
    if reading.finish == "hardwax_oil" and not re.search(
        r"gloss|matte|oil|rubio|sheen|shiny|dull", inquiry, re.I
    ):
        updates["finish"] = "unspecified"
    return reading.model_copy(update=updates)


def _clean(data: dict, inquiry: str) -> Reading:
    for key, value in list(data.items()):
        if isinstance(value, str):
            data[key] = value.strip()
    reading = Reading.model_validate(data)
    low = _normalize_budget(reading.budget_low, inquiry)
    high = _normalize_budget(reading.budget_high, inquiry)
    if low and high and high < low:
        low, high = high, low
    if reading.species_alternate == reading.species_primary:
        reading.species_alternate = "none"
    updates = {
        "budget_low": low,
        "budget_high": high,
        "species_alternate": reading.species_alternate,
        "quantity": max(reading.quantity, 1),
        "seats": max(reading.seats, 0),
        "width_in": max(reading.width_in, 0),
        "depth_in": max(reading.depth_in, 0),
        "client_name": reading.client_name.rstrip(".").strip(),
    }
    return apply_note_guards(reading.model_copy(update=updates), inquiry)


def _clip_inquiry(inquiry: str) -> str:
    text = inquiry.strip()
    if len(text) < 8:
        raise ValueError("Paste a little more of the note. A name and a sentence is enough.")
    return text[:4000]


def _messages(book: Pricebook, text: str, today: date) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You fill a furniture shop job ticket from a client note. "
                "Copy the client's own wood, budget, and name. "
                "Never answer with the shop owner's name. Never state a price."
            ),
        },
        {"role": "user", "content": _prompt(book, text, today)},
    ]


def prepare_read(book: Pricebook, inquiry: str, today: date | None = None) -> dict:
    """Prompt and grammar for a read. The caller runs the model."""
    text = _clip_inquiry(inquiry)
    today = today or date.today()
    return {"messages": _messages(book, text, today), "schema": _schema(book)}


def finish_read(
    book: Pricebook,
    inquiry: str,
    content: str,
    seconds: float,
    completion_tokens: int = 0,
) -> ReadResult:
    """Turn model text into a ticket. Shared by the local server and the browser."""
    text = _clip_inquiry(inquiry)
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "The model didn't finish a ticket. Try the note again, or fill the ticket yourself."
        ) from exc
    if not isinstance(payload, dict):
        raise RuntimeError(
            "The model didn't finish a ticket. Try the note again, or fill the ticket yourself."
        )
    rate = round(completion_tokens / seconds, 1) if seconds and completion_tokens else None
    return ReadResult(
        reading=_clean(payload, text),
        seconds=round(seconds, 2),
        tokens_per_second=rate,
        model=MODEL_META,
    )


def read_note(book: Pricebook, inquiry: str, today: date | None = None) -> ReadResult:
    text = _clip_inquiry(inquiry)
    llm = _state["llm"]
    if llm is None:
        if _state["loading"]:
            raise RuntimeError("The model is still loading on this machine.")
        detail = _state["error"] or "The model is not loaded."
        raise RuntimeError(str(detail))

    today = today or date.today()
    messages = _messages(book, text, today)
    started = time.perf_counter()
    with _lock:
        response = llm.create_chat_completion(  # type: ignore[attr-defined]
            messages=messages,
            response_format={"type": "json_object", "schema": _schema(book)},
            temperature=0,
            max_tokens=500,
        )
    seconds = time.perf_counter() - started
    content = response["choices"][0]["message"]["content"] or ""
    usage = response.get("usage") or {}
    completion = usage.get("completion_tokens") or 0
    return finish_read(book, text, content, seconds, int(completion or 0))
