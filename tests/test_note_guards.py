from engine.reader import apply_note_guards
from engine.schemas import Reading


def test_room_feet_do_not_become_the_table_and_a_leaf_is_kept():
    reading = Reading(
        piece="dining_table",
        width_in=9,
        depth_in=11,
        leaf=False,
        finish="hardwax_oil",
        seats=6,
    )
    inquiry = (
        "the dining room is awkward, about 9 feet by 11. "
        "seats 6, maybe 8 with a leaf. My partner hates glossy finishes."
    )
    cleaned = apply_note_guards(reading, inquiry)
    assert cleaned.width_in == 0
    assert cleaned.depth_in == 0
    assert cleaned.leaf is True
    assert cleaned.finish == "hardwax_oil"


def test_a_desk_does_not_inherit_a_leaf_or_an_unstated_finish():
    reading = Reading(piece="desk", leaf=True, finish="hardwax_oil", species_primary="maple")
    cleaned = apply_note_guards(
        reading,
        "Jonah here. Hard maple desk, a hole for the charger, around two thousand.",
    )
    assert cleaned.leaf is False
    assert cleaned.finish == "unspecified"
    assert cleaned.species_primary == "maple"
