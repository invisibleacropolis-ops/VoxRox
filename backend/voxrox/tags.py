from __future__ import annotations

import re

from pydantic import BaseModel

# Matches only lowercase/hyphen/digit tokens, so CMU arpabet spans
# such as "[B EY1 S]" (uppercase, spaces) are never treated as tags.
TAG_PATTERN = re.compile(r"\[[a-z0-9]+(?:-[a-z0-9]+)*\]")


class Tag(BaseModel):
    token: str
    label: str
    description: str
    hotkey: str


class TagGroup(BaseModel):
    id: str
    label: str
    tags: list[Tag]


TAG_GROUPS: list[TagGroup] = [
    TagGroup(
        id="vocal",
        label="Vocal",
        tags=[
            Tag(token="[laughter]", label="Laugh", description="Audible laughter.", hotkey="1"),
            Tag(token="[sigh]", label="Sigh", description="Audible exhaled sigh.", hotkey="2"),
        ],
    ),
    TagGroup(
        id="response",
        label="Response",
        tags=[
            Tag(token="[confirmation-en]", label="Mm-hm", description="Affirmative 'en' sound.", hotkey="3"),
            Tag(token="[question-en]", label="Hm?", description="Questioning 'en' sound.", hotkey="4"),
        ],
    ),
    TagGroup(
        id="question",
        label="Question",
        tags=[
            Tag(token="[question-ah]", label="Ah?", description="Questioning 'ah'.", hotkey="Q"),
            Tag(token="[question-oh]", label="Oh?", description="Questioning 'oh'.", hotkey="W"),
            Tag(token="[question-ei]", label="Ei?", description="Questioning 'ei'.", hotkey="E"),
            Tag(token="[question-yi]", label="Yi?", description="Questioning 'yi'.", hotkey="R"),
        ],
    ),
    TagGroup(
        id="surprise",
        label="Surprise",
        tags=[
            Tag(token="[surprise-ah]", label="Ah!", description="Surprised 'ah'.", hotkey="A"),
            Tag(token="[surprise-oh]", label="Oh!", description="Surprised 'oh'.", hotkey="S"),
            Tag(token="[surprise-wa]", label="Wa!", description="Surprised 'wa'.", hotkey="D"),
            Tag(token="[surprise-yo]", label="Yo!", description="Surprised 'yo'.", hotkey="F"),
        ],
    ),
    TagGroup(
        id="dissatisfaction",
        label="Dissatisfaction",
        tags=[
            Tag(token="[dissatisfaction-hnn]", label="Hnn", description="Displeased 'hnn'.", hotkey="Z"),
        ],
    ),
]

ALL_TOKENS: frozenset[str] = frozenset(
    tag.token for group in TAG_GROUPS for tag in group.tags
)


def extract_tags(text: str) -> list[str]:
    """Every known tag occurrence, in order, duplicates preserved."""
    return [m.group(0) for m in TAG_PATTERN.finditer(text) if m.group(0) in ALL_TOKENS]


def unknown_tags(text: str) -> list[str]:
    """Tag-shaped tokens that the engine will not recognise."""
    seen: list[str] = []
    for match in TAG_PATTERN.finditer(text):
        token = match.group(0)
        if token not in ALL_TOKENS and token not in seen:
            seen.append(token)
    return seen


def strip_tags(text: str) -> str:
    """Text with known tags removed — used for transcript previews."""
    without = TAG_PATTERN.sub(
        lambda m: "" if m.group(0) in ALL_TOKENS else m.group(0), text
    )
    return re.sub(r"\s{2,}", " ", without).strip()
