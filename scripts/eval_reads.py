"""Run the three sample notes through the local model and print the tickets."""

from __future__ import annotations

import json
from pathlib import Path

from engine.reader import load_model, read_note
from engine.store import load_default

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    samples = json.loads((ROOT / "data" / "samples.json").read_text())
    book = load_default()
    load_model()
    for sample in samples:
        print("\n" + "=" * 72)
        print(sample["id"])
        try:
            result = read_note(book, sample["inquiry"])
        except Exception as exc:  # noqa: BLE001
            print("FAILED", exc)
            continue
        print(
            f"{result.seconds}s"
            + (f"  {result.tokens_per_second} tok/s" if result.tokens_per_second else "")
        )
        print(json.dumps(result.reading.model_dump(), indent=2))


if __name__ == "__main__":
    main()
