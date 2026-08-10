from __future__ import annotations

from pathlib import Path

IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"}
AUDIO_TYPES = {
    "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave",
    "audio/mpeg", "audio/mp3", "audio/flac", "audio/x-flac", "audio/ogg",
}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
AUDIO_SUFFIXES = {".wav", ".mp3", ".flac", ".ogg", ".opus", ".m4a"}


def safe_suffix(filename: str, allowed: set[str], fallback: str) -> str:
    suffix = Path(filename or "").suffix.lower()
    return suffix if suffix in allowed else fallback


def is_image(content_type: str | None, filename: str) -> bool:
    return (content_type or "") in IMAGE_TYPES or Path(
        filename or ""
    ).suffix.lower() in IMAGE_SUFFIXES


def is_audio(content_type: str | None, filename: str) -> bool:
    return (content_type or "") in AUDIO_TYPES or Path(
        filename or ""
    ).suffix.lower() in AUDIO_SUFFIXES


def write_bytes(path: Path, payload: bytes) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return path
