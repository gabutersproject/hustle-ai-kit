from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import date, timedelta


MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

NO_DATE = {
    "",
    "none",
    "n/a",
    "na",
    "no rush",
    "whenever",
    "unspecified",
    "flexible",
    "no deadline",
    "no real deadline",
}


@dataclass(frozen=True)
class Deadline:
    needed_by: date | None
    name: str


def long_date(value: date) -> str:
    return f"{value.day} {value.strftime('%B %Y')}"


def thanksgiving(year: int) -> date:
    first = date(year, 11, 1)
    offset = (3 - first.weekday()) % 7
    return first + timedelta(days=offset + 21)


def _upcoming(month: int, day: int, today: date) -> date:
    year = today.year
    candidate = date(year, month, day)
    if candidate < today:
        candidate = date(year + 1, month, day)
    return candidate


def _month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def parse_deadline(raw: str, today: date) -> Deadline:
    text = re.sub(r"\s+", " ", raw.strip().lower())
    if text in NO_DATE:
        return Deadline(None, "")

    if "thanksgiving" in text:
        year = today.year if thanksgiving(today.year) >= today else today.year + 1
        day = thanksgiving(year)
        return Deadline(day, "Thanksgiving")

    if "christmas" in text or re.search(r"\bxmas\b", text):
        return Deadline(_upcoming(12, 25, today), "Christmas")

    if "new year" in text or "new year's" in text or "new years" in text:
        # 1 January is only "this new year" on the day itself.
        year = today.year if today == date(today.year, 1, 1) else today.year + 1
        return Deadline(date(year, 1, 1), "Before the new year")

    iso = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
    if iso:
        try:
            day = date(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
        except ValueError:
            day = None
        if day:
            return Deadline(day, long_date(day))

    weeks = re.search(r"(\d+)\s*weeks?", text)
    if weeks:
        day = today + timedelta(weeks=int(weeks.group(1)))
        return Deadline(day, f"{weeks.group(1)} weeks from the note")

    if re.search(r"\basap\b|as soon as possible", text):
        return Deadline(today, "As soon as possible")

    for name, month in MONTHS.items():
        if re.search(rf"\b{name}\b", text):
            year = today.year
            if _month_end(year, month) < today:
                year += 1
            return Deadline(_month_end(year, month), name.capitalize())

    return Deadline(None, raw.strip())
