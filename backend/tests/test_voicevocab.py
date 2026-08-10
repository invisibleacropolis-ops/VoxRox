from voxrox import voicevocab as vv


def test_scales_have_the_documented_values():
    assert vv.GENDERS == ["", "male", "female"]
    assert vv.AGES == ["", "child", "teenage", "young adult", "middle-aged", "elderly"]
    assert vv.PITCHES == ["", "very low", "low", "medium", "high", "very high"]
    assert vv.INTENSITIES == ["faintly", "slightly", "", "very", "extremely"]


def test_compose_instruct_orders_parts_and_drops_blanks():
    result = vv.compose_instruct(
        gender="female", age="elderly", pitch="low", style="",
        accent="british", dialect="", mood="", intensity=2, extra=[],
    )
    assert result == "female, elderly, low pitch, british accent"


def test_compose_instruct_renders_mood_with_intensity():
    result = vv.compose_instruct(
        gender="male", age="", pitch="", style="", accent="", dialect="",
        mood="angry", intensity=4, extra=[],
    )
    assert result == "male, extremely angry"


def test_neutral_mood_contributes_nothing():
    assert vv.compose_instruct(
        gender="male", age="", pitch="", style="", accent="", dialect="",
        mood="neutral", intensity=4, extra=[],
    ) == "male"


def test_style_and_dialect_and_extra_are_appended():
    result = vv.compose_instruct(
        gender="", age="", pitch="", style="whisper", accent="",
        dialect="四川话", mood="", intensity=2, extra=["breathy", "  "],
    )
    assert result == "whisper, 四川话, breathy"


def test_empty_selection_composes_to_empty_string():
    assert vv.compose_instruct(
        gender="", age="", pitch="", style="", accent="", dialect="",
        mood="", intensity=2, extra=[],
    ) == ""


def test_intensity_out_of_range_is_clamped():
    assert vv.compose_instruct(
        gender="", age="", pitch="", style="", accent="", dialect="",
        mood="happy", intensity=99, extra=[],
    ) == "extremely happy"
