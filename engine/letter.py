from __future__ import annotations

from datetime import date

from engine.deadlines import Deadline, long_date
from engine.money import money
from engine.schemas import DeliveryZone, Piece, Pricebook, PricedOption, Reading


def _size_sentence(piece: Piece, reading: Reading, width: int, depth: int) -> str:
    if reading.leaf and piece.supports_leaf and piece.leaf_width_in and width and depth:
        return (
            f"Closed, it is {width} by {depth} inches. "
            f"The leaf adds {piece.leaf_width_in} inches."
        )
    if width and depth:
        return f"The rate card sizes this {piece.label.lower()} at {width} by {depth} inches."
    if width:
        return f"The rate card sizes the width at {width} inches."
    return ""


def _delivery_sentence(zone: DeliveryZone) -> str:
    if zone.id == "pickup":
        return "You'd pick this up at the shop. There's no delivery charge in the total."
    return f"Delivery — {zone.label} — is in the total."


def _closer(recommended: PricedOption) -> str:
    if recommended.within_budget is False:
        return "If you want the number lower, we change the wood or the size and I price the ticket again."
    wood = recommended.title.split(",")[0]
    return f"If the {wood.lower()} is the one, I can draw it."


def _drawing_sentence(book: Pricebook) -> str:
    rounds = book.shop.revision_rounds
    round_word = "one round" if rounds == 1 else f"{rounds} rounds"
    if book.shop.design_credited and book.shop.design_hours:
        return f"The drawing includes {round_word} of changes, and that drawing is credited to the build."
    if book.shop.design_hours:
        return f"The drawing includes {round_word} of changes."
    return f"The ticket includes {round_word} of changes to the drawing."


def render_letter(
    *,
    book: Pricebook,
    reading: Reading,
    piece: Piece,
    options: list[PricedOption],
    recommended: PricedOption,
    zone: DeliveryZone,
    width: int,
    depth: int,
    assumptions: list[str],
    exclusions: list[str],
    lead_note: str,
    deadline: Deadline,
    earliest: date,
    today: date,
    maker_note: str,
    deposit_cents: int,
) -> str:
    del deadline, earliest  # lead_note already carries both
    shop = book.shop
    lines: list[str] = [
        shop.name,
        shop.city,
        "",
        long_date(today),
        "",
        f"{reading.client_name} —" if reading.client_name else "Hello —",
        "",
    ]
    place = reading.place_raw.strip()
    opening = "Thank you for the note"
    if place:
        opening += f" from {place}"
    opening += (
        f". This ticket is a {piece.label.lower()}, priced from the rate card in the shop."
    )
    lines.extend([opening, ""])
    size = _size_sentence(piece, reading, width, depth)
    if size:
        lines.extend([size, ""])
    if reading.quantity > 1:
        lines.extend([f"The price is for {reading.quantity}.", ""])

    lines.append("Ways to build it:" if len(options) > 1 else "How I'd build it:")
    lines.append("")
    for option in options:
        lines.append(option.title)
        lines.append(money(option.total_cents))
        lines.append(option.pitch)
        lines.append("")

    if len(options) > 1:
        wood = recommended.title.split(",")[0]
        if recommended.within_budget is False:
            lines.append(f"Neither lands in the range. The lower one is the {wood.lower()}.")
        else:
            lines.append(f"I would build the {wood.lower()}.")
        lines.append("")

    lines.append(_delivery_sentence(zone))
    lines.append("")
    lines.append(lead_note)
    lines.append("")
    lines.append(
        f"The deposit is {shop.deposit_percent}% ({money(deposit_cents)}) and holds a place in the queue. "
        f"This quote is good for {shop.quote_valid_days} days. {_drawing_sentence(book)}"
    )
    lines.append("")

    if assumptions:
        lines.append("I assumed:")
        for item in assumptions:
            text = item.rstrip(".")
            lines.append(f"— {text}.")
        lines.append("")

    lines.append("Not included:")
    for item in exclusions:
        lines.append(f"— {item.rstrip('.')}.")
    lines.append("")

    if maker_note:
        lines.extend([maker_note.strip(), ""])

    lines.append(_closer(recommended))
    lines.append("")
    lines.append(shop.maker)
    lines.append(shop.phone)
    lines.append(shop.email)
    return "\n".join(lines)
