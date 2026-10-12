from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from engine.deadlines import Deadline, long_date, parse_deadline
from engine.money import cents_from_decimal, money
from engine.schemas import (
    DeliveryZone,
    Finish,
    LineItem,
    Piece,
    Pricebook,
    PricedOption,
    Quote,
    Reading,
    Species,
)


def _hours_label(hours: Decimal) -> str:
    quantized = hours.quantize(Decimal("0.1"))
    if quantized == quantized.to_integral():
        count = int(quantized)
        return f"{count} hour" if count == 1 else f"{count} hours"
    return f"{quantized} hours"


def _bf_label(board_feet: Decimal) -> str:
    quantized = board_feet.quantize(Decimal("0.1"))
    return f"{quantized} board feet"


def _budget_status(total_cents: int, low: int, high: int) -> bool | None:
    if low <= 0 and high <= 0:
        return None
    ceiling = (high or low) * 100
    return total_cents <= ceiling


def _budget_note(total_cents: int, low: int, high: int) -> str:
    if low <= 0 and high <= 0:
        return "No budget in the note"
    ceiling = high or low
    floor = low or 0
    dollars = total_cents // 100
    if dollars > ceiling:
        return f"${dollars - ceiling:,} over the ${ceiling:,} you named"
    if floor and high and floor != high and dollars < floor:
        return f"Under the ${floor:,}–${high:,} range"
    if floor and high and floor != high:
        return f"Inside ${floor:,}–${high:,}"
    if floor and dollars < floor:
        return f"Under the ${floor:,} you named"
    return f"Inside the ${ceiling:,} you named"


def _resolve_size(piece: Piece, reading: Reading, assumptions: list[str]) -> tuple[int, int, Decimal]:
    width = reading.width_in
    depth = reading.depth_in if reading.depth_in else piece.default_depth_in
    scale = Decimal(1)

    if piece.supports_seats and reading.width_in == 0:
        seats = reading.seats
        keys = sorted(int(key) for key in piece.seat_widths)
        if seats <= 0:
            seats = 6 if 6 in keys else (keys[len(keys) // 2] if keys else 0)
            width = piece.seat_widths.get(str(seats), piece.default_width_in)
            assumptions.append(
                f"Seat count wasn't in the note. Sized for {seats}, which is {width} inches closed."
            )
        elif str(seats) in piece.seat_widths:
            width = piece.seat_widths[str(seats)]
            assumptions.append(
                f"Closed length is {width} inches, taken from {seats} seats, because the note gave no measured length."
            )
        elif keys:
            nearest = min(keys, key=lambda key: (abs(key - seats), key))
            width = piece.seat_widths[str(nearest)]
            assumptions.append(
                f"{seats} seats isn't a size on the rate card. Priced as {nearest}, at {width} inches."
            )
        else:
            width = piece.default_width_in
    elif width == 0:
        width = piece.default_width_in
        if width:
            assumptions.append(
                f"Width is {width} inches, the shop default for a {piece.label.lower()}, because the note gave none."
            )

    if reading.depth_in == 0 and piece.default_depth_in:
        assumptions.append(
            f"Depth is {piece.default_depth_in} inches, the shop default for a {piece.label.lower()}."
        )

    if (
        piece.scale_labor_with_width
        and piece.reference_width_in
        and width
        and width != piece.reference_width_in
    ):
        scale = Decimal(width) / Decimal(piece.reference_width_in)
        assumptions.append(
            f"Lumber and hours are scaled from the {piece.reference_width_in}-inch rate-card {piece.label.lower()} to {width} inches."
        )
    elif (
        not piece.scale_labor_with_width
        and piece.reference_width_in
        and reading.width_in
        and reading.width_in != piece.default_width_in
    ):
        assumptions.append(
            f"The rate card prices a {piece.default_width_in}-inch {piece.label.lower()}. The note asked for {reading.width_in} inches, so check this before you send it."
        )

    return width, depth, scale


def _board_feet(width: int, depth: int, thickness: float, waste: float) -> Decimal:
    return (
        Decimal(width)
        * Decimal(depth)
        * Decimal(str(thickness))
        / Decimal(144)
        * Decimal(str(waste))
    )


def _species_choices(book: Pricebook, reading: Reading, assumptions: list[str]) -> list[Species]:
    chosen: list[Species] = []
    for species_id in (reading.species_primary, reading.species_alternate):
        if species_id in {"", "unspecified", "none"}:
            continue
        species = book.species_by_id(species_id)
        if species is None:
            raise ValueError(f"{species_id} is not a wood on the rate card.")
        if species.id not in {item.id for item in chosen}:
            chosen.append(species)
    if chosen:
        return chosen
    fallback = book.species_by_id(book.shop.default_species)
    if fallback is None:
        raise ValueError("The rate card has no default wood.")
    assumptions.append(
        f"No wood was named. {fallback.label} is the shop default, so that's what's priced."
    )
    return [fallback]


def _finish(book: Pricebook, reading: Reading, assumptions: list[str]) -> Finish:
    if reading.finish in {"", "unspecified"}:
        finish = book.finish_by_id(book.shop.default_finish)
        if finish is None:
            raise ValueError("The rate card has no default finish.")
        assumptions.append(f"No finish was named. {finish.label} is the shop default.")
        return finish
    finish = book.finish_by_id(reading.finish)
    if finish is None:
        raise ValueError(f"{reading.finish} is not a finish on the rate card.")
    return finish


def _zone(book: Pricebook, reading: Reading, assumptions: list[str]) -> DeliveryZone:
    if reading.delivery in {"", "unspecified"}:
        zone = book.zone_by_id("pickup") or book.delivery[0]
        assumptions.append(
            f"No delivery place was named. This ticket is priced as {zone.label.lower()}."
        )
        return zone
    zone = book.zone_by_id(reading.delivery)
    if zone is None:
        raise ValueError(f"{reading.delivery} is not a delivery zone on the rate card.")
    return zone


def _base(piece: Piece, reading: Reading, assumptions: list[str]) -> tuple[str, str, Decimal]:
    if not piece.supports_base or not piece.bases:
        return "", "", Decimal(0)
    styles = {item.id: item for item in piece.bases}
    chosen = reading.base_style
    if chosen in {"", "unspecified"} or chosen not in styles:
        chosen = piece.default_base or piece.bases[0].id
        style = styles[chosen]
        assumptions.append(f"No base was named. A {style.label.lower()} is the shop default.")
        return style.id, style.label, Decimal(str(style.extra_hours))
    style = styles[chosen]
    return style.id, style.label, Decimal(str(style.extra_hours))


def _pitch(
    *,
    is_primary: bool,
    within_budget: bool | None,
    primary_over: bool,
    has_fallback: bool,
) -> str:
    if within_budget is False and is_primary and has_fallback:
        return "This is the wood you asked for first. It is over the range, so the other option is the one that fits."
    if within_budget is False:
        return "This is over the top of the range you named. Same drawing otherwise. I would rather show that than thin the work to force the number."
    if within_budget is True and not is_primary and primary_over:
        return "You named the other wood first and allowed this one if the price got out of hand. It sits inside the range."
    if within_budget is True and is_primary:
        return "This is the wood you asked for first, and it sits inside the range you named."
    if within_budget is True:
        return "This sits inside the range you named."
    return "No budget was in the note. This is the rate-card total for this build."


def _option(
    book: Pricebook,
    reading: Reading,
    piece: Piece,
    species: Species,
    finish: Finish,
    zone: DeliveryZone,
    *,
    width: int,
    depth: int,
    scale: Decimal,
    base_label: str,
    base_extra: Decimal,
    is_primary: bool,
    primary_over: bool,
    has_fallback: bool,
) -> PricedOption:
    shop = book.shop
    hourly = Decimal(shop.hourly_cents)
    quantity = Decimal(max(reading.quantity, 1))
    lines: list[LineItem] = []

    labor_hours = Decimal(str(piece.labor_hours)) * scale + base_extra
    if labor_hours < 0:
        labor_hours = Decimal(0)

    if piece.thickness_in > 0 and width and depth:
        board_feet = _board_feet(width, depth, piece.thickness_in, piece.waste)
    else:
        board_feet = Decimal(str(piece.lumber_bf)) * scale

    lumber_raw = board_feet * Decimal(species.cents_per_bf) * quantity
    lumber_detail = f"{_bf_label(board_feet)} of {species.label.lower()} at {money(species.cents_per_bf)}"
    if quantity > 1:
        lumber_detail += f", times {int(quantity)}"
    lines.append(
        LineItem(
            label=f"{species.label} lumber",
            detail=lumber_detail,
            cents=cents_from_decimal(lumber_raw),
        )
    )

    labor_detail = f"{_hours_label(labor_hours)} at {money(shop.hourly_cents)}"
    if base_label and base_extra != 0:
        labor_detail += f", including the {base_label.lower()}"
    if quantity > 1:
        labor_detail += f", times {int(quantity)}"
    lines.append(
        LineItem(
            label="Shop labor",
            detail=labor_detail,
            cents=cents_from_decimal(labor_hours * hourly * quantity),
        )
    )

    if reading.leaf and piece.supports_leaf and piece.leaf_width_in and depth:
        leaf_bf = _board_feet(piece.leaf_width_in, depth, piece.thickness_in, piece.waste)
        lines.append(
            LineItem(
                label="Leaf lumber",
                detail=f"{piece.leaf_width_in} by {depth} inches, {_bf_label(leaf_bf)} at {money(species.cents_per_bf)}",
                cents=cents_from_decimal(leaf_bf * Decimal(species.cents_per_bf) * quantity),
            )
        )
        lines.append(
            LineItem(
                label="Leaf labor",
                detail=f"{_hours_label(Decimal(str(piece.leaf_hours)))} at {money(shop.hourly_cents)}",
                cents=cents_from_decimal(Decimal(str(piece.leaf_hours)) * hourly * quantity),
            )
        )
        if piece.leaf_hardware_cents:
            lines.append(
                LineItem(
                    label="Leaf hardware",
                    detail="Hinges and alignment, from the rate card",
                    cents=cents_from_decimal(Decimal(piece.leaf_hardware_cents) * quantity),
                )
            )

    waterfall = book.addon("waterfall")
    if reading.waterfall and waterfall and piece.id in waterfall.pieces:
        lines.append(
            LineItem(
                label=waterfall.label,
                detail=f"{_hours_label(Decimal(str(waterfall.hours)))} and {_bf_label(Decimal(str(waterfall.extra_bf)))}",
                cents=cents_from_decimal(
                    (
                        Decimal(str(waterfall.hours)) * hourly
                        + Decimal(str(waterfall.extra_bf)) * Decimal(species.cents_per_bf)
                        + Decimal(waterfall.hardware_cents)
                    )
                    * quantity
                ),
            )
        )

    grommet = book.addon("cable_grommet")
    if reading.cable_grommet and grommet and piece.id in grommet.pieces:
        lines.append(
            LineItem(
                label=grommet.label,
                detail=f"{_hours_label(Decimal(str(grommet.hours)))} and {money(grommet.hardware_cents)} in hardware",
                cents=cents_from_decimal(
                    (Decimal(str(grommet.hours)) * hourly + Decimal(grommet.hardware_cents)) * quantity
                ),
            )
        )

    if finish.extra_hours or finish.supply_cents:
        finish_raw = (
            Decimal(str(finish.extra_hours)) * hourly + Decimal(finish.supply_cents)
        ) * quantity
        finish_detail = money(finish.supply_cents) + " in supplies"
        if finish.extra_hours:
            finish_detail = (
                f"{_hours_label(Decimal(str(finish.extra_hours)))} over the shop's usual oil, plus {money(finish.supply_cents)} in supplies"
            )
        lines.append(LineItem(label=finish.label, detail=finish_detail, cents=cents_from_decimal(finish_raw)))

    lines.append(
        LineItem(
            label=zone.label,
            detail="Once per ticket, not per piece" if quantity > 1 else "From the rate card",
            cents=zone.cents,
        )
    )

    if shop.design_hours:
        design = Decimal(str(shop.design_hours)) * hourly
        lines.append(
            LineItem(
                label="Design drawing",
                detail=f"{_hours_label(Decimal(str(shop.design_hours)))} at {money(shop.hourly_cents)}",
                cents=cents_from_decimal(design),
            )
        )
        if shop.design_credited:
            lines.append(
                LineItem(
                    label="Design credit",
                    detail="Taken off if you build",
                    cents=-cents_from_decimal(design),
                )
            )

    total = sum(line.cents for line in lines)
    within = _budget_status(total, reading.budget_low, reading.budget_high)
    title_parts = [species.label]
    if base_label:
        title_parts.append(base_label.lower())
    title_parts.append(finish.label.lower())
    return PricedOption(
        id=species.id,
        species_id=species.id,
        title=", ".join(title_parts),
        pitch=_pitch(
            is_primary=is_primary,
            within_budget=within,
            primary_over=primary_over,
            has_fallback=has_fallback,
        ),
        lines=lines,
        total_cents=total,
        within_budget=within,
        budget_note=_budget_note(total, reading.budget_low, reading.budget_high),
    )


def _exclusions(book: Pricebook, piece: Piece) -> list[str]:
    rounds = book.shop.revision_rounds
    round_word = "round" if rounds == 1 else "rounds"
    rounds_label = "one" if rounds == 1 else str(rounds)
    items = []
    if piece.id != "bench":
        items.append("Seating. Chairs and benches are a separate ticket")
    else:
        items.append("A table to go with the bench. That's a separate ticket")
    items.extend(
        [
            "Hauling out whatever is in the room now",
            "Floor leveling, painting, or electrical work",
            f"More than {rounds_label} {round_word} of changes to the drawing",
            "Keeping the finished piece in the shop longer than two weeks",
        ]
    )
    return items


def _lead(book: Pricebook, reading: Reading, today: date) -> tuple[str, str | None, Deadline, date]:
    deadline = parse_deadline(reading.deadline_raw, today)
    earliest = today + timedelta(weeks=book.shop.lead_weeks_min)
    window = f"{book.shop.lead_weeks_min} to {book.shop.lead_weeks_max}"
    earliest_line = f"The earliest week I would write on a ticket is the week of {long_date(earliest)}."
    if deadline.needed_by and deadline.needed_by < earliest:
        conflict = (
            f"{deadline.name} is {long_date(deadline.needed_by)}, which is inside the "
            f"{window} week lead time. I can't promise that date."
        )
        note = f"Lead time is {window} weeks from the deposit. {conflict} {earliest_line}"
        return note, conflict, deadline, earliest
    if deadline.needed_by:
        note = (
            f"Lead time is {window} weeks from the deposit. {deadline.name} fits that window. {earliest_line}"
        )
        return note, None, deadline, earliest
    note = (
        f"Lead time is {window} weeks from the deposit. Nothing in the note set a hard date. {earliest_line}"
    )
    return note, None, deadline, earliest


def price_reading(
    book: Pricebook,
    reading: Reading,
    today: date,
    inquiry: str = "",
    maker_note: str = "",
    model_seconds: float | None = None,
    created_at: str | None = None,
) -> Quote:
    piece = book.piece(reading.piece)
    if piece is None:
        raise ValueError(f"{reading.piece} is not a piece on the rate card.")
    if reading.quantity < 1:
        reading = reading.model_copy(update={"quantity": 1})

    assumptions: list[str] = []
    if reading.quantity > 1:
        assumptions.append(
            f"Quantity is {reading.quantity}. Lumber and labor are multiplied. Delivery is charged once."
        )

    width, depth, scale = _resolve_size(piece, reading, assumptions)
    species_list = _species_choices(book, reading, assumptions)
    finish = _finish(book, reading, assumptions)
    zone = _zone(book, reading, assumptions)
    _base_id, base_label, base_extra = _base(piece, reading, assumptions)

    if reading.waterfall and not (
        (addon := book.addon("waterfall")) and piece.id in addon.pieces
    ):
        assumptions.append(
            "Waterfall ends were mentioned. This piece doesn't have them on the rate card, so they aren't priced."
        )
    if reading.cable_grommet and not (
        (grommet := book.addon("cable_grommet")) and piece.id in grommet.pieces
    ):
        assumptions.append(
            "A cable hole was mentioned. This piece doesn't have one on the rate card, so it isn't priced."
        )
    if reading.leaf and not piece.supports_leaf:
        assumptions.append("A leaf was mentioned. This piece doesn't have one, so it isn't priced.")

    # Price the preferred wood first to know whether it blew the budget.
    primary = _option(
        book,
        reading,
        piece,
        species_list[0],
        finish,
        zone,
        width=width,
        depth=depth,
        scale=scale,
        base_label=base_label,
        base_extra=base_extra,
        is_primary=True,
        primary_over=False,
        has_fallback=len(species_list) > 1,
    )
    primary_over = primary.within_budget is False
    options = [
        primary.model_copy(
            update={
                "pitch": _pitch(
                    is_primary=True,
                    within_budget=primary.within_budget,
                    primary_over=primary_over,
                    has_fallback=len(species_list) > 1,
                )
            }
        )
    ]
    for species in species_list[1:]:
        options.append(
            _option(
                book,
                reading,
                piece,
                species,
                finish,
                zone,
                width=width,
                depth=depth,
                scale=scale,
                base_label=base_label,
                base_extra=base_extra,
                is_primary=False,
                primary_over=primary_over,
                has_fallback=True,
            )
        )

    recommended = next((item for item in options if item.within_budget is not False), None)
    if recommended is None:
        recommended = min(options, key=lambda item: item.total_cents)

    deposit_dollars = int(
        (
            Decimal(recommended.total_cents // 100)
            * Decimal(book.shop.deposit_percent)
            / Decimal(100)
        ).quantize(Decimal("1"))
    )
    lead_note, lead_conflict, deadline, earliest = _lead(book, reading, today)
    exclusions = _exclusions(book, piece)

    # Local import avoids a cycle: letter imports nothing from pricer.
    from engine.letter import render_letter

    letter = render_letter(
        book=book,
        reading=reading,
        piece=piece,
        options=options,
        recommended=recommended,
        zone=zone,
        width=width,
        depth=depth,
        assumptions=assumptions,
        exclusions=exclusions,
        lead_note=lead_note,
        deadline=deadline,
        earliest=earliest,
        today=today,
        maker_note=maker_note.strip(),
        deposit_cents=deposit_dollars * 100,
    )

    from datetime import datetime

    return Quote(
        created_at=created_at or datetime.now().astimezone().isoformat(timespec="seconds"),
        inquiry=inquiry.strip(),
        maker_note=maker_note.strip(),
        reading=reading,
        options=options,
        recommended_id=recommended.id,
        deposit_cents=deposit_dollars * 100,
        lead_conflict=lead_conflict,
        lead_note=lead_note,
        assumptions=assumptions,
        exclusions=exclusions,
        letter=letter,
        model_seconds=model_seconds,
    )
