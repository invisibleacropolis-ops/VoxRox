from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from voxrox.voicevocab import DEFAULT_INTENSITY

VoiceMode = Literal["auto", "clone", "design"]
TurnStatus = Literal["draft", "rendered"]
SequencerMode = Literal["sequential", "simultaneous"]


def new_id() -> str:
    return uuid.uuid4().hex


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="ignore"
    )


class GenerationParams(Base):
    num_step: int = Field(default=32, ge=16, le=32)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    duration: float | None = Field(default=None, ge=0.5, le=120.0)


class VoiceDesign(Base):
    gender: str = ""
    age: str = ""
    pitch: str = ""
    style: str = ""
    accent: str = ""
    dialect: str = ""
    mood: str = ""
    intensity: int = Field(default=DEFAULT_INTENSITY, ge=0, le=4)
    extra: list[str] = Field(default_factory=list)


class VoiceSample(Base):
    id: str = Field(default_factory=new_id)
    filename: str
    url: str
    transcript: str = ""
    duration_sec: float = 0.0
    added_at: str = Field(default_factory=utc_now)


class ProfileCard(Base):
    short_name: str = ""
    tagline: str = ""
    accent_color: str = "#f2c14e"


class Narrative(Base):
    description: str = ""
    background: str = ""


class ArchiveEntry(Base):
    id: str = Field(default_factory=new_id)
    project_id: str
    project_name: str
    turn_id: str
    text: str
    url: str
    duration_sec: float
    created_at: str = Field(default_factory=utc_now)


class Profile(Base):
    id: str = Field(default_factory=new_id)
    name: str
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)
    portrait_url: str | None = None
    card: ProfileCard = Field(default_factory=ProfileCard)
    voice_mode: VoiceMode = "auto"
    voice: VoiceDesign = Field(default_factory=VoiceDesign)
    params: GenerationParams = Field(default_factory=GenerationParams)
    samples: list[VoiceSample] = Field(default_factory=list)
    active_sample_id: str | None = None
    narrative: Narrative = Field(default_factory=Narrative)
    custom_tags: list[str] = Field(default_factory=list)
    archive: list[ArchiveEntry] = Field(default_factory=list)

    @model_validator(mode="after")
    def _fill_card_short_name(self) -> "Profile":
        if not self.card.short_name:
            self.card.short_name = self.name
        return self


class TurnAudio(Base):
    url: str
    filename: str
    duration_sec: float
    sample_rate: int = 24_000
    rendered_at: str = Field(default_factory=utc_now)


class Turn(Base):
    id: str = Field(default_factory=new_id)
    profile_id: str
    text: str = ""
    params: GenerationParams = Field(default_factory=GenerationParams)
    voice_override: VoiceDesign | None = None
    status: TurnStatus = "draft"
    audio: TurnAudio | None = None
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)


class SequencerSettings(Base):
    mode: SequencerMode = "sequential"
    delay_ms: int = Field(default=300, ge=0, le=10_000)
    stagger_ms: int = Field(default=0, ge=0, le=10_000)
    loop: bool = False
    volume: float = Field(default=1.0, ge=0.0, le=1.0)


class Project(Base):
    id: str = Field(default_factory=new_id)
    name: str
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)
    participant_ids: list[str] = Field(default_factory=list)
    turns: list[Turn] = Field(default_factory=list)
    sequencer: SequencerSettings = Field(default_factory=SequencerSettings)
