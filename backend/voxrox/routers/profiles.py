from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, field_validator

from voxrox.audio import probe_duration
from voxrox.config import get_settings
from voxrox.models import Profile, VoiceSample, new_id
from voxrox.services import media
from voxrox.services import profiles as service
from voxrox.storage import NotFoundError

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


class CreateProfileBody(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("name must not be blank")
        return value


def _load(profile_id: str) -> Profile:
    try:
        return service.get_profile(profile_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="profile not found")


@router.get("")
def list_profiles() -> list[dict]:
    return [p.model_dump(by_alias=True) for p in service.list_profiles()]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_profile(body: CreateProfileBody) -> dict:
    return service.create_profile(body.name).model_dump(by_alias=True)


@router.get("/{profile_id}")
def read_profile(profile_id: str) -> dict:
    return _load(profile_id).model_dump(by_alias=True)


@router.patch("/{profile_id}")
def patch_profile(profile_id: str, patch: dict[str, Any]) -> dict:
    _load(profile_id)
    for immutable in ("id", "createdAt", "archive", "samples"):
        patch.pop(immutable, None)
    try:
        updated = service.update_profile(profile_id, patch)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return updated.model_dump(by_alias=True)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(profile_id: str) -> Response:
    _load(profile_id)
    service.delete_profile(profile_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{profile_id}/instruct")
def read_instruct(profile_id: str) -> dict:
    return {"instruct": service.instruct_for(_load(profile_id))}


@router.post("/{profile_id}/portrait")
def upload_portrait(profile_id: str, file: UploadFile = File(...)) -> dict:
    profile = _load(profile_id)
    if not media.is_image(file.content_type, file.filename or ""):
        raise HTTPException(status_code=415, detail="portrait must be an image")
    suffix = media.safe_suffix(file.filename or "", media.IMAGE_SUFFIXES, ".png")
    name = f"{profile_id}-{new_id()[:8]}{suffix}"
    media.write_bytes(get_settings().portraits_dir / name, file.file.read())
    profile.portrait_url = f"/media/portraits/{name}"
    return service.save_profile(profile).model_dump(by_alias=True)


@router.post("/{profile_id}/samples", status_code=status.HTTP_201_CREATED)
def upload_sample(
    profile_id: str,
    file: UploadFile = File(...),
    transcript: str = Form(""),
) -> dict:
    profile = _load(profile_id)
    if not media.is_audio(file.content_type, file.filename or ""):
        raise HTTPException(status_code=415, detail="sample must be an audio file")
    suffix = media.safe_suffix(file.filename or "", media.AUDIO_SUFFIXES, ".wav")
    sample_id = new_id()
    name = f"{sample_id}{suffix}"
    path = get_settings().samples_dir / profile_id / name
    media.write_bytes(path, file.file.read())
    try:
        duration = probe_duration(path)
    except Exception:
        duration = 0.0
    profile.samples.append(
        VoiceSample(
            id=sample_id,
            filename=file.filename or name,
            url=f"/media/samples/{profile_id}/{name}",
            transcript=transcript,
            duration_sec=round(duration, 3),
        )
    )
    if profile.active_sample_id is None:
        profile.active_sample_id = sample_id
        profile.voice_mode = "clone"
    return service.save_profile(profile).model_dump(by_alias=True)


@router.delete("/{profile_id}/samples/{sample_id}")
def delete_sample(profile_id: str, sample_id: str) -> dict:
    profile = _load(profile_id)
    remaining = [s for s in profile.samples if s.id != sample_id]
    if len(remaining) == len(profile.samples):
        raise HTTPException(status_code=404, detail="sample not found")
    profile.samples = remaining
    if profile.active_sample_id == sample_id:
        profile.active_sample_id = remaining[0].id if remaining else None
        if profile.active_sample_id is None and profile.voice_mode == "clone":
            profile.voice_mode = "auto"
    return service.save_profile(profile).model_dump(by_alias=True)


@router.post("/{profile_id}/samples/{sample_id}/activate")
def activate_sample(profile_id: str, sample_id: str) -> dict:
    profile = _load(profile_id)
    if not any(s.id == sample_id for s in profile.samples):
        raise HTTPException(status_code=404, detail="sample not found")
    profile.active_sample_id = sample_id
    profile.voice_mode = "clone"
    return service.save_profile(profile).model_dump(by_alias=True)
