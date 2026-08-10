import pytest
from pydantic import ValidationError

from voxrox.models import (
    GenerationParams, Profile, ProfileCard, Project,
    SequencerSettings, Turn, VoiceDesign, new_id,
)


def test_new_id_is_url_safe_and_unique():
    a, b = new_id(), new_id()
    assert a != b
    assert a.replace("-", "").isalnum()


def test_profile_defaults_are_usable():
    profile = Profile(name="Ivy")
    assert profile.id
    assert profile.voice_mode == "auto"
    assert profile.samples == []
    assert profile.params.num_step == 32
    assert profile.params.speed == 1.0
    assert profile.params.duration is None
    assert profile.card.short_name == "Ivy"


def test_profile_serializes_to_camel_case():
    payload = Profile(name="Ivy").model_dump(by_alias=True)
    assert "voiceMode" in payload
    assert "createdAt" in payload
    assert "voice_mode" not in payload


def test_card_short_name_falls_back_to_name():
    profile = Profile(name="Aurelia the Bright", card=ProfileCard(short_name=""))
    assert profile.card.short_name == "Aurelia the Bright"


def test_generation_params_reject_out_of_range():
    with pytest.raises(ValidationError):
        GenerationParams(num_step=8)
    with pytest.raises(ValidationError):
        GenerationParams(speed=5.0)


def test_voice_design_intensity_bounds():
    with pytest.raises(ValidationError):
        VoiceDesign(intensity=9)


def test_turn_starts_as_draft_without_audio():
    turn = Turn(profile_id="p1", text="Hello")
    assert turn.status == "draft"
    assert turn.audio is None


def test_project_defaults_include_sequencer_settings():
    project = Project(name="Scene 1")
    assert project.turns == []
    assert project.sequencer == SequencerSettings()
    assert project.sequencer.mode == "sequential"
    assert project.sequencer.delay_ms == 300
