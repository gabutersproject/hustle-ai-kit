from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP


def dollar_round(cents: int) -> int:
    """Round a cent amount to the nearest dollar, half up, keeping the sign."""
    sign = 1 if cents >= 0 else -1
    value = abs(cents)
    rounded = (value + 50) // 100 * 100
    return sign * rounded


def cents_from_decimal(raw: Decimal) -> int:
    cents = int(raw.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return dollar_round(cents)


def money(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    absolute = abs(cents)
    if absolute % 100 == 0:
        return f"{sign}${absolute // 100:,}"
    return f"{sign}${absolute / 100:,.2f}"
