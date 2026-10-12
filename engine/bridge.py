"""JSON desk used by the browser demo.

The pricing, the letter, and the grammar live in the same modules as the
local server. The browser only runs the model, then hands the text back here.
"""

from __future__ import annotations

import json
from datetime import date, datetime

from engine.pricer import price_reading
from engine.reader import MODEL_META, finish_read, prepare_read
from engine.schemas import Pricebook, Reading
from engine.store import (
    delete_quote,
    get_quote,
    list_quotes,
    load_book,
    reset_book,
    save_book,
    save_quote,
)


def _today(body: dict) -> date:
    raw = body.get("today")
    if isinstance(raw, str) and raw:
        return date.fromisoformat(raw)
    return date.today()


def _dispatch(action: str, body: dict) -> dict:
    if action == "model_meta":
        return MODEL_META
    if action == "pricebook":
        return load_book().model_dump()
    if action == "save_pricebook":
        return save_book(Pricebook.model_validate(body["book"])).model_dump()
    if action == "reset_pricebook":
        return reset_book().model_dump()
    if action == "prepare_read":
        return prepare_read(load_book(), str(body.get("inquiry", "")), today=_today(body))
    if action == "finish_read":
        result = finish_read(
            load_book(),
            str(body.get("inquiry", "")),
            str(body.get("content", "")),
            seconds=float(body.get("seconds") or 0),
            completion_tokens=int(body.get("completion_tokens") or 0),
        )
        return result.model_dump()
    if action == "price":
        reading = Reading.model_validate(body["reading"])
        quote = price_reading(
            load_book(),
            reading,
            today=_today(body),
            inquiry=str(body.get("inquiry") or ""),
            maker_note=str(body.get("maker_note") or ""),
            model_seconds=body.get("model_seconds"),
            created_at=body.get("created_at")
            or datetime.now().astimezone().isoformat(timespec="seconds"),
        )
        if body.get("save"):
            from uuid import uuid4

            quote.id = uuid4().hex[:12]
            save_quote(quote)
        return quote.model_dump()
    if action == "quotes":
        return {"quotes": [quote.model_dump() for quote in list_quotes()]}
    if action == "quote":
        quote = get_quote(str(body.get("id") or ""))
        if quote is None:
            raise LookupError("That ticket isn't on this machine.")
        return quote.model_dump()
    if action == "delete_quote":
        if not delete_quote(str(body.get("id") or "")):
            raise LookupError("That ticket isn't on this machine.")
        return {"ok": True}
    raise ValueError(f"Unknown desk action {action}.")


def handle(action: str, body_json: str) -> str:
    try:
        body = json.loads(body_json or "{}")
        if not isinstance(body, dict):
            raise ValueError("The desk expected an object.")
        return json.dumps({"ok": True, "data": _dispatch(action, body)})
    except LookupError as exc:
        return json.dumps({"ok": False, "status": 404, "detail": str(exc)})
    except ValueError as exc:
        return json.dumps({"ok": False, "status": 400, "detail": str(exc)})
    except RuntimeError as exc:
        return json.dumps({"ok": False, "status": 503, "detail": str(exc)})
    except Exception as exc:  # noqa: BLE001 — the browser desk surfaces the message
        return json.dumps({"ok": False, "status": 400, "detail": str(exc)})
