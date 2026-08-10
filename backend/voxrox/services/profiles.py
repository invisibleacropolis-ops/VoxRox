from __future__ import annotations

from typing import Any

from voxrox.config import get_settings
from voxrox.models import Profile, utc_now
from voxrox.storage import JsonStore, NotFoundError
from voxrox.voicevocab import compose_instruct


def _store() -> JsonStore:
    return JsonStore(get_settings().profiles_dir)


def deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Recursive merge; patch values win. Lists are replaced wholesale."""
    merged = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def list_profiles() -> list[Profile]:
    return [Profile.model_validate(doc) for doc in _store().read_all()]


def get_profile(profile_id: str) -> Profile:
    return Profile.model_validate(_store().read(profile_id))


def save_profile(profile: Profile) -> Profile:
    profile.updated_at = utc_now()
    _store().write(profile.id, profile.model_dump(by_alias=True))
    return profile


def create_profile(name: str) -> Profile:
    return save_profile(Profile(name=name.strip()))


def update_profile(profile_id: str, patch: dict[str, Any]) -> Profile:
    current = _store().read(profile_id)
    merged = deep_merge(current, patch)
    merged["id"] = profile_id
    return save_profile(Profile.model_validate(merged))


def delete_profile(profile_id: str) -> None:
    _store().delete(profile_id)


def instruct_for(profile: Profile) -> str:
    voice = profile.voice
    return compose_instruct(
        gender=voice.gender,
        age=voice.age,
        pitch=voice.pitch,
        style=voice.style,
        accent=voice.accent,
        dialect=voice.dialect,
        mood=voice.mood,
        intensity=voice.intensity,
        extra=voice.extra,
    )


__all__ = [
    "NotFoundError",
    "create_profile",
    "deep_merge",
    "delete_profile",
    "get_profile",
    "instruct_for",
    "list_profiles",
    "save_profile",
    "update_profile",
]
