import re
from datetime import date

from engine.pricer import price_reading
from engine.schemas import Reading
from engine.store import load_default


def test_letter_dollars_come_only_from_the_ticket():
    reading = Reading(
        client_name="Priya",
        piece="dining_table",
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
    quote = price_reading(load_default(), reading, date(2026, 10, 12))
    allowed = {option.total_cents // 100 for option in quote.options}
    allowed.add(quote.deposit_cents // 100)
    found = [int(match.replace(",", "")) for match in re.findall(r"\$([\d,]+)", quote.letter)]
    assert found, "the letter should name the prices"
    assert set(found) <= allowed
    assert "Catskill" in quote.letter
    assert "rate card" in quote.letter
    assert "I would build the white oak." in quote.letter
    assert "Mara Ellison" in quote.letter
