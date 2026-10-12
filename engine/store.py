from __future__ import annotations

import json
import threading
from pathlib import Path

from engine.schemas import Pricebook, Quote

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DEFAULT_BOOK = DATA / "pricebook.default.json"
WORKING_BOOK = DATA / "pricebook.json"
QUOTES_PATH = DATA / "quotes.json"

_lock = threading.Lock()


def load_default() -> Pricebook:
    return Pricebook.model_validate_json(DEFAULT_BOOK.read_text())


def load_book() -> Pricebook:
    DATA.mkdir(parents=True, exist_ok=True)
    with _lock:
        if not WORKING_BOOK.exists():
            WORKING_BOOK.write_text(DEFAULT_BOOK.read_text())
        return Pricebook.model_validate_json(WORKING_BOOK.read_text())


def save_book(book: Pricebook) -> Pricebook:
    DATA.mkdir(parents=True, exist_ok=True)
    payload = book.model_dump_json(indent=2) + "\n"
    with _lock:
        WORKING_BOOK.write_text(payload)
    return book


def reset_book() -> Pricebook:
    DATA.mkdir(parents=True, exist_ok=True)
    with _lock:
        WORKING_BOOK.write_text(DEFAULT_BOOK.read_text())
    return load_book()


def _read_quotes() -> list[dict]:
    if not QUOTES_PATH.exists():
        return []
    raw = json.loads(QUOTES_PATH.read_text() or '{"quotes": []}')
    return list(raw.get("quotes", []))


def _write_quotes(quotes: list[dict]) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    QUOTES_PATH.write_text(json.dumps({"quotes": quotes}, indent=2) + "\n")


def list_quotes() -> list[Quote]:
    with _lock:
        rows = _read_quotes()
    quotes = [Quote.model_validate(row) for row in rows]
    quotes.sort(key=lambda quote: quote.created_at, reverse=True)
    return quotes


def get_quote(quote_id: str) -> Quote | None:
    for quote in list_quotes():
        if quote.id == quote_id:
            return quote
    return None


def save_quote(quote: Quote) -> Quote:
    with _lock:
        rows = _read_quotes()
        rows = [row for row in rows if row.get("id") != quote.id]
        rows.append(quote.model_dump())
        _write_quotes(rows)
    return quote


def delete_quote(quote_id: str) -> bool:
    with _lock:
        rows = _read_quotes()
        kept = [row for row in rows if row.get("id") != quote_id]
        if len(kept) == len(rows):
            return False
        _write_quotes(kept)
    return True
