from __future__ import annotations

# The leading "" in each scale is the "unset" notch on the UI slider.
GENDERS = ["", "male", "female"]
AGES = ["", "child", "teenage", "young adult", "middle-aged", "elderly"]
PITCHES = ["", "very low", "low", "medium", "high", "very high"]
STYLES = ["", "whisper"]
ACCENTS = ["", "american", "british", "australian", "indian", "scottish"]
DIALECTS = ["", "四川话", "陕西话", "东北话", "粤语"]
MOODS = [
    "", "neutral", "happy", "sad", "angry", "fearful",
    "surprised", "tender", "serious", "playful", "weary",
]
INTENSITIES = ["faintly", "slightly", "", "very", "extremely"]
DEFAULT_INTENSITY = 2


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def compose_instruct(
    *,
    gender: str,
    age: str,
    pitch: str,
    style: str,
    accent: str,
    dialect: str,
    mood: str,
    intensity: int,
    extra: list[str],
) -> str:
    """Build the comma-separated instruct string for voice-design mode."""
    parts: list[str] = [gender, age]
    if pitch:
        parts.append(f"{pitch} pitch")
    if style:
        parts.append(style)
    if accent:
        parts.append(f"{accent} accent")
    if dialect:
        parts.append(dialect)
    if mood and mood != "neutral":
        word = INTENSITIES[_clamp(intensity, 0, len(INTENSITIES) - 1)]
        parts.append(f"{word} {mood}".strip())
    parts.extend(extra)
    return ", ".join(part.strip() for part in parts if part and part.strip())
