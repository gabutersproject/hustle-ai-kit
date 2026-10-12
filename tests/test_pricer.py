from datetime import date

from engine.pricer import price_reading
from engine.schemas import Reading
from engine.store import load_default

TODAY = date(2026, 10, 12)


def _priya() -> Reading:
    return Reading(
        client_name="Priya",
        piece="dining_table",
        quantity=1,
        seats=6,
        leaf=True,
        species_primary="walnut",
        species_alternate="white_oak",
        finish="hardwax_oil",
        base_style="trestle",
        budget_low=4000,
        budget_high=5000,
        delivery="mid_hudson",
        deadline_raw="before Thanksgiving",
        place_raw="Catskill",
    )


def test_priya_prices_oak_inside_and_walnut_over():
    quote = price_reading(load_default(), _priya(), TODAY)
    by_id = {option.id: option for option in quote.options}
    assert by_id["white_oak"].total_cents == 443_800
    assert by_id["walnut"].total_cents == 559_200
    assert by_id["white_oak"].within_budget is True
    assert by_id["walnut"].within_budget is False
    assert quote.recommended_id == "white_oak"
    assert quote.deposit_cents == 221_900
    assert quote.lead_conflict is not None
    assert "Thanksgiving" in quote.lead_conflict
    assert "26 November 2026" in quote.lead_conflict
    assert any("72 inches" in item for item in quote.assumptions)
    oak_labels = [line.label for line in by_id["white_oak"].lines]
    assert "Design drawing" in oak_labels
    assert "Design credit" in oak_labels
    assert sum(line.cents for line in by_id["white_oak"].lines) == 443_800


def test_desk_with_grommet_lands_under_two_thousand():
    reading = Reading(
        client_name="Jonah",
        piece="desk",
        species_primary="maple",
        finish="hardwax_oil",
        delivery="pickup",
        budget_low=2000,
        budget_high=2000,
        cable_grommet=True,
        deadline_raw="before the new year",
        place_raw="Hudson",
    )
    quote = price_reading(load_default(), reading, TODAY)
    option = quote.options[0]
    assert option.total_cents == 191_300
    assert option.within_budget is True
    assert quote.lead_conflict is None
    assert any(line.label == "Cable grommet" for line in option.lines)


def test_grommet_is_not_priced_on_a_table():
    reading = _priya().model_copy(update={"cable_grommet": True, "species_alternate": "none"})
    quote = price_reading(load_default(), reading, TODAY)
    labels = [line.label for line in quote.options[0].lines]
    assert "Cable grommet" not in labels
    assert any("cable hole" in item.lower() for item in quote.assumptions)


def test_bookshelf_scales_and_shows_the_city_delivery():
    reading = Reading(
        client_name="Andre",
        piece="bookshelf",
        species_primary="white_oak",
        finish="hardwax_oil",
        delivery="nyc",
        budget_low=0,
        budget_high=1500,
        width_in=48,
        place_raw="Brooklyn",
    )
    quote = price_reading(load_default(), reading, TODAY)
    option = quote.options[0]
    assert option.total_cents == 183_700
    assert option.within_budget is False
    assert any("scaled" in item for item in quote.assumptions)
    assert any(line.cents == 34_000 for line in option.lines)


def test_every_piece_prices():
    book = load_default()
    for piece in book.pieces:
        reading = Reading(
            piece=piece.id,
            species_primary="white_oak",
            finish="hardwax_oil",
            delivery="pickup",
            seats=6 if piece.supports_seats else 0,
            leaf=bool(piece.supports_leaf),
        )
        quote = price_reading(book, reading, TODAY, inquiry="")
        assert quote.options[0].total_cents > 0
        assert quote.letter.startswith("Mara Ellison Studio")


def test_unnamed_wood_uses_the_shop_default():
    reading = Reading(piece="bench", species_primary="unspecified", delivery="pickup")
    quote = price_reading(load_default(), reading, TODAY)
    assert quote.options[0].species_id == "white_oak"
    assert any("No wood was named" in item for item in quote.assumptions)


def test_unknown_piece_is_rejected():
    try:
        price_reading(load_default(), Reading(piece="canoe"), TODAY)
    except ValueError as exc:
        assert "canoe" in str(exc)
    else:
        raise AssertionError("expected a rejection")
