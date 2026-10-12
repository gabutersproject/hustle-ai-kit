from datetime import date

from engine.deadlines import parse_deadline, thanksgiving


def test_thanksgiving_2026():
    assert thanksgiving(2026) == date(2026, 11, 26)
    parsed = parse_deadline("before Thanksgiving", date(2026, 10, 12))
    assert parsed.needed_by == date(2026, 11, 26)
    assert parsed.name == "Thanksgiving"


def test_new_year_from_october():
    parsed = parse_deadline("maybe before the new year if that's easy", date(2026, 10, 12))
    assert parsed.needed_by == date(2027, 1, 1)


def test_no_rush_is_empty():
    parsed = parse_deadline("no rush", date(2026, 10, 12))
    assert parsed.needed_by is None


def test_weeks_and_month():
    assert parse_deadline("in 3 weeks", date(2026, 10, 12)).needed_by == date(2026, 11, 2)
    assert parse_deadline("by March", date(2026, 10, 12)).needed_by == date(2027, 3, 31)


def test_christmas():
    assert parse_deadline("before Christmas", date(2026, 10, 12)).needed_by == date(2026, 12, 25)
