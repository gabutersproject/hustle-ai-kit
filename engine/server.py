from __future__ import annotations

import os
import threading
from contextlib import asynccontextmanager
from datetime import date, datetime
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from engine.pricer import price_reading
from engine.reader import load_model, model_state, read_note
from engine.schemas import PriceRequest, Pricebook, ReadRequest
from engine.store import delete_quote, get_quote, list_quotes, load_book, reset_book, save_book, save_quote


@asynccontextmanager
async def lifespan(_app: FastAPI):
    thread = threading.Thread(target=load_model, name="sawhorse-model", daemon=True)
    thread.start()
    yield


app = FastAPI(title="Sawhorse", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:43123", "http://localhost:43123"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _bad(exc: Exception, status: int = 400) -> HTTPException:
    return HTTPException(status_code=status, detail=str(exc))


@app.get("/health")
def health() -> dict:
    state = model_state()
    return {
        "ok": True,
        "model_loaded": state["loaded"],
        "model_loading": state["loading"],
        "model_error": state["error"],
        "model": state["model"],
    }


@app.get("/pricebook")
def get_pricebook() -> dict:
    return load_book().model_dump()


@app.put("/pricebook")
def put_pricebook(book: Pricebook) -> dict:
    try:
        saved = save_book(book)
    except Exception as exc:  # noqa: BLE001
        raise _bad(exc) from exc
    return saved.model_dump()


@app.post("/pricebook/reset")
def post_reset() -> dict:
    return reset_book().model_dump()


@app.post("/read")
def post_read(body: ReadRequest) -> dict:
    try:
        result = read_note(load_book(), body.inquiry)
    except ValueError as exc:
        raise _bad(exc) from exc
    except RuntimeError as exc:
        raise _bad(exc, status=503) from exc
    return result.model_dump()


@app.post("/price")
def post_price(body: PriceRequest) -> dict:
    try:
        quote = price_reading(
            load_book(),
            body.reading,
            today=date.today(),
            inquiry=body.inquiry,
            maker_note=body.maker_note,
            model_seconds=body.model_seconds,
        )
    except ValueError as exc:
        raise _bad(exc) from exc
    if body.save:
        quote.id = uuid4().hex[:12]
        quote.created_at = datetime.now().astimezone().isoformat(timespec="seconds")
        save_quote(quote)
    return quote.model_dump()


@app.get("/quotes")
def get_quotes() -> dict:
    return {"quotes": [quote.model_dump() for quote in list_quotes()]}


@app.get("/quotes/{quote_id}")
def get_one_quote(quote_id: str) -> dict:
    quote = get_quote(quote_id)
    if quote is None:
        raise HTTPException(status_code=404, detail="That ticket isn't on this machine.")
    return quote.model_dump()


@app.delete("/quotes/{quote_id}")
def remove_quote(quote_id: str) -> dict:
    if not delete_quote(quote_id):
        raise HTTPException(status_code=404, detail="That ticket isn't on this machine.")
    return {"ok": True}


def main() -> None:
    import uvicorn

    port = int(os.environ.get("SAWHORSE_PORT", "43124"))
    uvicorn.run("engine.server:app", host="127.0.0.1", port=port, reload=False)


if __name__ == "__main__":
    main()
