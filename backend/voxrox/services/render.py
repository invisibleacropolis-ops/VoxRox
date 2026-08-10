from __future__ import annotations

from pathlib import Path

from voxrox import tags
from voxrox.audio import write_wav
from voxrox.config import get_settings
from voxrox.engine.base import SynthesisRequest, SynthesisResult, TTSEngine
from voxrox.models import (
    ArchiveEntry, GenerationParams, Profile, Project, Turn, TurnAudio, VoiceDesign, new_id,
)
from voxrox.services import profiles as profile_service
from voxrox.voicevocab import compose_instruct


class RenderError(ValueError):
    """Raised for user-fixable problems: blank text, unknown tags, missing sample."""


def validate_text(text: str) -> str:
    stripped = (text or "").strip()
    if not stripped:
        raise RenderError("text must not be blank")
    unknown = tags.unknown_tags(stripped)
    if unknown:
        raise RenderError(f"unknown tags: {', '.join(unknown)}")
    return stripped


def _instruct_from(voice: VoiceDesign) -> str:
    return compose_instruct(
        gender=voice.gender, age=voice.age, pitch=voice.pitch, style=voice.style,
        accent=voice.accent, dialect=voice.dialect, mood=voice.mood,
        intensity=voice.intensity, extra=voice.extra,
    )


def _sample_path(profile: Profile) -> tuple[str, str] | None:
    if not profile.active_sample_id:
        return None
    for sample in profile.samples:
        if sample.id == profile.active_sample_id:
            relative = sample.url.removeprefix("/media/")
            return str(get_settings().media_dir / relative), sample.transcript
    return None


def build_request(
    *,
    profile: Profile,
    text: str,
    params: GenerationParams,
    voice_override: VoiceDesign | None = None,
) -> SynthesisRequest:
    """Resolve profile voice mode + overrides into one engine request."""
    request = SynthesisRequest(
        text=validate_text(text),
        num_step=params.num_step,
        speed=params.speed,
        duration=params.duration,
    )
    if voice_override is not None:
        instruct = _instruct_from(voice_override)
        if instruct:
            request.instruct = instruct
            return request

    if profile.voice_mode == "clone":
        resolved = _sample_path(profile)
        if resolved is None:
            raise RenderError("clone mode requires an active audio sample")
        request.ref_audio, ref_text = resolved
        request.ref_text = ref_text or None
    elif profile.voice_mode == "design":
        request.instruct = _instruct_from(profile.voice) or None
    return request


def synthesize_to(
    engine: TTSEngine, request: SynthesisRequest, destination: Path
) -> tuple[str, float]:
    result: SynthesisResult = engine.synthesize(request)
    duration = write_wav(destination, result.samples, result.sample_rate)
    return str(destination), round(duration, 3)


def render_preview(engine: TTSEngine, request: SynthesisRequest) -> tuple[str, float]:
    preview_id = new_id()
    destination = get_settings().preview_dir / f"{preview_id}.wav"
    _, duration = synthesize_to(engine, request, destination)
    return preview_id, duration


def render_turn(
    engine: TTSEngine, project: Project, turn: Turn, profile: Profile
) -> Turn:
    request = build_request(
        profile=profile,
        text=turn.text,
        params=turn.params,
        voice_override=turn.voice_override,
    )
    destination = get_settings().renders_dir / project.id / f"{turn.id}.wav"
    _, duration = synthesize_to(engine, request, destination)
    turn.audio = TurnAudio(
        url=f"/media/renders/{project.id}/{turn.id}.wav",
        filename=f"{turn.id}.wav",
        duration_sec=duration,
    )
    turn.status = "rendered"
    _record_archive(project, turn, profile, duration)
    return turn


def _record_archive(
    project: Project, turn: Turn, profile: Profile, duration: float
) -> None:
    profile.archive = [e for e in profile.archive if e.turn_id != turn.id]
    profile.archive.append(
        ArchiveEntry(
            project_id=project.id,
            project_name=project.name,
            turn_id=turn.id,
            text=turn.text,
            url=turn.audio.url if turn.audio else "",
            duration_sec=duration,
        )
    )
    profile_service.save_profile(profile)
