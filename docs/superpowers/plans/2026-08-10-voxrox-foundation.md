# VoxRox Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build VoxRox — a multi-voice TTS narration platform with a low-res pixel-RPG UI — delivering working Character Profiles, a Chat/Project transcript that binds text turns to rendered audio, and a Chat Sequencer that plays rendered turns back in order or simultaneously, all driven by real OmniVoice inference.

**Architecture:** A Vite + React + TypeScript frontend (browser at `localhost:5173`) talks to a local FastAPI backend (`localhost:8000`) over JSON + multipart. The backend owns all durable state as atomic JSON files on disk plus a media tree (portraits, voice samples, rendered WAVs), and owns the single lazily-loaded `OmniVoiceEngine` instance. The frontend is built bottom-up from a pixel primitive library (`PixelFrame`/`PixelButton`/`PixelWindow`/`PixelSlider`/`PixelScrollArea`/`PixelTextArea`/`PixelTabs`) plus a step-timed animation kit, so later screens are pure composition. The tag vocabulary and voice-design vocabulary live in exactly one place (backend `tags.py` / `voicevocab.py`) and are served to the UI, so the hotkey panel can never drift from what the engine accepts.

**Tech Stack:** Python 3.11 + FastAPI + Pydantic v2 + soundfile + numpy + `omnivoice` (PyTorch, CUDA) on the backend; pytest + httpx on backend tests. React 18 + TypeScript + Vite + Zustand on the frontend; Vitest + @testing-library/react + jsdom on frontend tests. No CSS framework — hand-written pixel CSS with `steps()` timing.

---

## Assumptions & Constraints (read before Task 1)

1. **Real engine only.** There is no mock TTS backend in the product; `OmniVoiceEngine` is the only shipped implementation. Tests that exercise HTTP routes inject a stub engine through FastAPI's `app.dependency_overrides` — that is a test double at the seam, not a second product backend. One real end-to-end synthesis test exists and is marked `@pytest.mark.gpu`, deselected by default.
2. **Python version.** The machine's default interpreter is Python 3.14, which PyTorch does not yet publish wheels for. The backend venv in Task 1 is created with **Python 3.11**. If `py -3.11` is unavailable, install it before starting; every later task assumes `backend/.venv` exists and is 3.11.
3. **VRAM.** Target GPU is an RTX 4050 with 6 GB. The engine loads `float16` and exposes `num_step` down to 16 so the user can trade quality for headroom. If a load OOMs, `EngineStatus.error` surfaces it in Settings rather than crashing the server.
4. **Sample rate is 24 000 Hz** everywhere. Never hardcode 22050 or 44100.
5. **All timing values in the UI are milliseconds** and all durations returned by the API are **seconds** (float). Do not mix.

---

## File Structure

**Backend — `backend/`**

| Path | Responsibility |
|---|---|
| `pyproject.toml` | Package metadata, deps, pytest config |
| `voxrox/config.py` | `Settings`: all filesystem paths, device, dtype. Single source of paths. |
| `voxrox/storage.py` | `JsonStore` — atomic read/write/delete of one JSON doc per entity id |
| `voxrox/tags.py` | Non-verbal tag vocabulary + extraction/validation. Single source of truth. |
| `voxrox/voicevocab.py` | Voice-design vocabulary (gender/age/pitch/style/accent/dialect/mood) + `compose_instruct` |
| `voxrox/models.py` | All Pydantic schemas: `Profile`, `Project`, `Turn`, etc. |
| `voxrox/audio.py` | WAV write + duration probe |
| `voxrox/engine/base.py` | `SynthesisRequest`, `SynthesisResult`, `TTSEngine` protocol, `EngineStatus` |
| `voxrox/engine/omnivoice.py` | Real OmniVoice adapter + lazy singleton `get_engine()` |
| `voxrox/services/profiles.py` | Profile business logic (CRUD, samples, portrait, archive) |
| `voxrox/services/projects.py` | Project + turn business logic |
| `voxrox/services/render.py` | Preview + render orchestration (engine → disk → state) |
| `voxrox/routers/*.py` | Thin HTTP layer, one router per domain |
| `voxrox/app.py` | App assembly, CORS, `/media` static mount |
| `tests/` | pytest suite |

**Frontend — `frontend/`**

| Path | Responsibility |
|---|---|
| `src/styles/tokens.css` | Palette, 8px grid, durations, step easings |
| `src/styles/global.css` | Reset, pixelated rendering, CRT scanline overlay |
| `src/ui/primitives/*.tsx` | The reusable pixel widget library |
| `src/ui/anim/animations.css` | Keyframes: window open/close, press, slide, blink |
| `src/api/types.ts` | TS mirrors of backend schemas |
| `src/api/client.ts` | Typed fetch wrapper — the only place `fetch` appears |
| `src/state/*.ts` | Zustand stores: profiles, projects, sequencer, ui |
| `src/features/profiles/*` | ProfileCard, ProfileEditor panels |
| `src/features/chat/*` | Chat log, turn editor window, profile picker |
| `src/features/sequencer/*` | `SequencerEngine` + the sequencer bar |
| `src/screens/*.tsx` | Four top-level screens |
| `src/App.tsx` | Menu bar + sequencer bar + screen switch |

**Runtime data (gitignored) — `data/`**: `data/profiles/*.json`, `data/projects/*.json`, `data/media/portraits/`, `data/media/samples/<profileId>/`, `data/media/renders/<projectId>/`, `data/tmp/preview/`.

---

## Task 1: Repo scaffold and backend health endpoint

**Files:**
- Create: `.gitignore`
- Create: `backend/pyproject.toml`
- Create: `backend/voxrox/__init__.py`
- Create: `backend/voxrox/config.py`
- Create: `backend/voxrox/app.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_health.py`

- [ ] **Step 1: Initialize the repo and the 3.11 virtualenv**

```bash
cd /c/GITHUB/VoxRox && git init && py -3.11 -m venv backend/.venv && backend/.venv/Scripts/python -m pip install -U pip
```

Expected: `Initialized empty Git repository` then pip upgrade succeeds. Verify the version:

```bash
backend/.venv/Scripts/python --version
```

Expected: `Python 3.11.x`. If not, stop and install Python 3.11.

- [ ] **Step 2: Write `.gitignore`**

```gitignore
.venv/
__pycache__/
*.pyc
.pytest_cache/
node_modules/
dist/
data/
.vite/
*.local
```

- [ ] **Step 3: Write `backend/pyproject.toml`**

```toml
[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "voxrox"
version = "0.1.0"
requires-python = ">=3.11,<3.13"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.7",
    "python-multipart>=0.0.9",
    "soundfile>=0.12",
    "numpy>=1.26",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "httpx>=0.27"]
engine = ["omnivoice"]

[tool.setuptools.packages.find]
include = ["voxrox*"]

[tool.pytest.ini_options]
testpaths = ["tests"]
markers = ["gpu: requires a loaded OmniVoice model and CUDA device"]
addopts = "-m 'not gpu'"
```

- [ ] **Step 4: Install the backend in editable mode**

```bash
backend/.venv/Scripts/python -m pip install -e "backend[dev]"
```

Expected: `Successfully installed ... voxrox-0.1.0`.

- [ ] **Step 5: Write `backend/voxrox/__init__.py`**

```python
__version__ = "0.1.0"
```

- [ ] **Step 6: Write `backend/voxrox/config.py`**

```python
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

SAMPLE_RATE = 24_000


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    device: str
    dtype: str
    model_id: str

    @property
    def profiles_dir(self) -> Path:
        return self.data_dir / "profiles"

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def media_dir(self) -> Path:
        return self.data_dir / "media"

    @property
    def portraits_dir(self) -> Path:
        return self.media_dir / "portraits"

    @property
    def samples_dir(self) -> Path:
        return self.media_dir / "samples"

    @property
    def renders_dir(self) -> Path:
        return self.media_dir / "renders"

    @property
    def preview_dir(self) -> Path:
        return self.data_dir / "tmp" / "preview"

    def ensure_dirs(self) -> None:
        for d in (
            self.profiles_dir,
            self.projects_dir,
            self.portraits_dir,
            self.samples_dir,
            self.renders_dir,
            self.preview_dir,
        ):
            d.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    default_data = Path(__file__).resolve().parents[2] / "data"
    settings = Settings(
        data_dir=Path(os.environ.get("VOXROX_DATA_DIR", default_data)),
        device=os.environ.get("VOXROX_DEVICE", "cuda:0"),
        dtype=os.environ.get("VOXROX_DTYPE", "float16"),
        model_id=os.environ.get("VOXROX_MODEL", "k2-fsa/OmniVoice"),
    )
    settings.ensure_dirs()
    return settings
```

- [ ] **Step 7: Write the failing test `backend/tests/test_health.py`**

```python
def test_health_reports_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "sampleRate": 24000}
```

- [ ] **Step 8: Write `backend/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("VOXROX_DATA_DIR", str(tmp_path / "data"))
    from voxrox.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    yield settings.data_dir
    get_settings.cache_clear()


@pytest.fixture()
def client(data_dir):
    from voxrox.app import create_app

    with TestClient(create_app()) as test_client:
        yield test_client
```

- [ ] **Step 9: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_health.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'voxrox.app'`.

- [ ] **Step 10: Write `backend/voxrox/app.py`**

```python
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from voxrox.config import SAMPLE_RATE, get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="VoxRox", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok", "sampleRate": SAMPLE_RATE}

    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    return app


app = create_app()
```

- [ ] **Step 11: Run the test to verify it passes**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_health.py -v
```

Expected: `1 passed`.

- [ ] **Step 12: Commit**

```bash
git add .gitignore backend/pyproject.toml backend/voxrox backend/tests && git commit -m "feat(backend): scaffold FastAPI app with health endpoint"
```

---

## Task 2: Atomic JSON storage layer

**Files:**
- Create: `backend/voxrox/storage.py`
- Test: `backend/tests/test_storage.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_storage.py`**

```python
import pytest

from voxrox.storage import JsonStore, NotFoundError


@pytest.fixture()
def store(tmp_path):
    return JsonStore(tmp_path / "things")


def test_write_then_read_roundtrips(store):
    store.write("abc", {"name": "Ivy", "n": 3})
    assert store.read("abc") == {"name": "Ivy", "n": 3}


def test_read_missing_raises(store):
    with pytest.raises(NotFoundError):
        store.read("nope")


def test_exists_reflects_writes_and_deletes(store):
    assert store.exists("abc") is False
    store.write("abc", {"a": 1})
    assert store.exists("abc") is True
    store.delete("abc")
    assert store.exists("abc") is False


def test_list_ids_is_sorted(store):
    store.write("b", {})
    store.write("a", {})
    assert store.list_ids() == ["a", "b"]


def test_read_all_returns_documents(store):
    store.write("a", {"v": 1})
    store.write("b", {"v": 2})
    assert store.read_all() == [{"v": 1}, {"v": 2}]


def test_delete_missing_raises(store):
    with pytest.raises(NotFoundError):
        store.delete("ghost")


def test_write_rejects_unsafe_ids(store):
    with pytest.raises(ValueError):
        store.write("../escape", {})


def test_write_leaves_no_temp_files(store):
    store.write("a", {"v": 1})
    assert [p.name for p in store.root.iterdir()] == ["a.json"]
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_storage.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'voxrox.storage'`.

- [ ] **Step 3: Write `backend/voxrox/storage.py`**

```python
from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")


class NotFoundError(KeyError):
    """Raised when a document id has no file on disk."""


class JsonStore:
    """One JSON document per id, written atomically."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, doc_id: str) -> Path:
        if not _SAFE_ID.match(doc_id):
            raise ValueError(f"unsafe document id: {doc_id!r}")
        return self.root / f"{doc_id}.json"

    def exists(self, doc_id: str) -> bool:
        return self._path(doc_id).is_file()

    def read(self, doc_id: str) -> dict[str, Any]:
        path = self._path(doc_id)
        if not path.is_file():
            raise NotFoundError(doc_id)
        return json.loads(path.read_text(encoding="utf-8"))

    def write(self, doc_id: str, document: dict[str, Any]) -> None:
        path = self._path(doc_id)
        payload = json.dumps(document, indent=2, ensure_ascii=False)
        handle, tmp_name = tempfile.mkstemp(dir=self.root, suffix=".tmp")
        try:
            with os.fdopen(handle, "w", encoding="utf-8") as fh:
                fh.write(payload)
            os.replace(tmp_name, path)
        except BaseException:
            Path(tmp_name).unlink(missing_ok=True)
            raise

    def delete(self, doc_id: str) -> None:
        path = self._path(doc_id)
        if not path.is_file():
            raise NotFoundError(doc_id)
        path.unlink()

    def list_ids(self) -> list[str]:
        return sorted(p.stem for p in self.root.glob("*.json"))

    def read_all(self) -> list[dict[str, Any]]:
        return [self.read(doc_id) for doc_id in self.list_ids()]
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_storage.py -v
```

Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/voxrox/storage.py backend/tests/test_storage.py && git commit -m "feat(backend): add atomic JSON document store"
```

---

## Task 3: Tag vocabulary — the single source of truth

The tag tokens below are the exact non-verbal symbols OmniVoice accepts. Do not invent additional tokens; the hotkey panel in Task 21 is generated from this module.

**Files:**
- Create: `backend/voxrox/tags.py`
- Test: `backend/tests/test_tags.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_tags.py`**

```python
from voxrox import tags


def test_all_tokens_are_bracketed_and_unique():
    tokens = [tag.token for group in tags.TAG_GROUPS for tag in group.tags]
    assert len(tokens) == len(set(tokens))
    assert all(t.startswith("[") and t.endswith("]") for t in tokens)


def test_known_tokens_include_the_documented_vocabulary():
    assert "[laughter]" in tags.ALL_TOKENS
    assert "[sigh]" in tags.ALL_TOKENS
    assert "[dissatisfaction-hnn]" in tags.ALL_TOKENS
    assert "[surprise-wa]" in tags.ALL_TOKENS
    assert len(tags.ALL_TOKENS) == 13


def test_extract_tags_finds_tokens_in_order_with_duplicates():
    text = "Well [sigh] fine. [laughter] Really? [laughter]"
    assert tags.extract_tags(text) == ["[sigh]", "[laughter]", "[laughter]"]


def test_extract_tags_ignores_pronunciation_brackets():
    assert tags.extract_tags("the [B EY1 S] guitar") == []


def test_unknown_tags_reports_only_lowercase_hyphen_tokens():
    text = "hi [laughter] [wobble] [B EY1 S]"
    assert tags.unknown_tags(text) == ["[wobble]"]


def test_strip_tags_removes_tokens_and_collapses_spaces():
    assert tags.strip_tags("Hey [laughter] there") == "Hey there"


def test_group_ids_are_unique():
    ids = [group.id for group in tags.TAG_GROUPS]
    assert len(ids) == len(set(ids))
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_tags.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'voxrox.tags'`.

- [ ] **Step 3: Write `backend/voxrox/tags.py`**

```python
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_tags.py -v
```

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/voxrox/tags.py backend/tests/test_tags.py && git commit -m "feat(backend): add OmniVoice non-verbal tag vocabulary"
```

---

## Task 4: Voice-design vocabulary and instruct composition

This module turns the profile's sliders into the single `instruct` string OmniVoice's voice-design mode accepts (e.g. `"female, low pitch, british accent"`).

**Files:**
- Create: `backend/voxrox/voicevocab.py`
- Test: `backend/tests/test_voicevocab.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_voicevocab.py`**

```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_voicevocab.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'voxrox.voicevocab'`.

- [ ] **Step 3: Write `backend/voxrox/voicevocab.py`**

```python
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_voicevocab.py -v
```

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/voxrox/voicevocab.py backend/tests/test_voicevocab.py && git commit -m "feat(backend): add voice-design vocabulary and instruct composer"
```

---

## Task 5: Domain models

Every schema uses `alias_generator=to_camel` with `populate_by_name=True`, so JSON on the wire is camelCase while Python stays snake_case. The frontend types in Task 17 mirror the camelCase form exactly.

**Files:**
- Create: `backend/voxrox/models.py`
- Test: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_models.py`**

```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_models.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'voxrox.models'`.

- [ ] **Step 3: Write `backend/voxrox/models.py`**

```python
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_models.py -v
```

Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/voxrox/models.py backend/tests/test_models.py && git commit -m "feat(backend): add profile, project and turn domain models"
```

---

## Task 6: Audio helpers

**Files:**
- Create: `backend/voxrox/audio.py`
- Test: `backend/tests/test_audio.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_audio.py`**

```python
import numpy as np
import pytest

from voxrox.audio import probe_duration, write_wav


def test_write_wav_creates_file_and_returns_duration(tmp_path):
    samples = np.zeros(24_000, dtype=np.float32)
    path = tmp_path / "out.wav"
    duration = write_wav(path, samples, 24_000)
    assert path.is_file()
    assert duration == pytest.approx(1.0, abs=0.01)


def test_write_wav_creates_missing_parent_directories(tmp_path):
    path = tmp_path / "deep" / "nested" / "out.wav"
    write_wav(path, np.zeros(2400, dtype=np.float32), 24_000)
    assert path.is_file()


def test_probe_duration_matches_written_length(tmp_path):
    path = tmp_path / "out.wav"
    write_wav(path, np.zeros(12_000, dtype=np.float32), 24_000)
    assert probe_duration(path) == pytest.approx(0.5, abs=0.01)


def test_write_wav_rejects_empty_audio(tmp_path):
    with pytest.raises(ValueError):
        write_wav(tmp_path / "out.wav", np.zeros(0, dtype=np.float32), 24_000)
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_audio.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'voxrox.audio'`.

- [ ] **Step 3: Write `backend/voxrox/audio.py`**

```python
from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf


def write_wav(path: Path | str, samples: np.ndarray, sample_rate: int) -> float:
    """Write mono float audio as 16-bit PCM WAV. Returns duration in seconds."""
    array = np.asarray(samples, dtype=np.float32).reshape(-1)
    if array.size == 0:
        raise ValueError("refusing to write empty audio")
    peak = float(np.max(np.abs(array)))
    if peak > 1.0:
        array = array / peak
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(destination), array, sample_rate, subtype="PCM_16")
    return array.size / float(sample_rate)


def probe_duration(path: Path | str) -> float:
    info = sf.info(str(path))
    return info.frames / float(info.samplerate)
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_audio.py -v
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/voxrox/audio.py backend/tests/test_audio.py && git commit -m "feat(backend): add WAV write and duration probe helpers"
```

---

## Task 7: Engine interface and OmniVoice adapter

`OmniVoiceEngine` is the only shipped engine. The model is loaded lazily on first synthesis (or on explicit warm-up) so the server starts instantly and a load failure surfaces as status rather than a crash.

**Files:**
- Create: `backend/voxrox/engine/__init__.py`
- Create: `backend/voxrox/engine/base.py`
- Create: `backend/voxrox/engine/omnivoice.py`
- Test: `backend/tests/test_engine.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_engine.py`**

```python
import numpy as np
import pytest

from voxrox.engine.base import EngineStatus, SynthesisRequest
from voxrox.engine.omnivoice import OmniVoiceEngine


class FakeModel:
    def __init__(self):
        self.calls = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        return [np.zeros(2400, dtype=np.float32)]


def test_request_rejects_blank_text():
    with pytest.raises(ValueError):
        SynthesisRequest(text="   ")


def test_engine_starts_unloaded():
    engine = OmniVoiceEngine(model_id="k2-fsa/OmniVoice", device="cuda:0", dtype="float16")
    status = engine.status()
    assert isinstance(status, EngineStatus)
    assert status.loaded is False
    assert status.model == "k2-fsa/OmniVoice"
    assert status.error is None


def test_synthesize_passes_clone_arguments_through():
    engine = OmniVoiceEngine(model_id="m", device="cpu", dtype="float32")
    fake = FakeModel()
    engine._model = fake  # injected: bypasses the lazy loader
    result = engine.synthesize(
        SynthesisRequest(
            text="Hello [laughter]",
            ref_audio="C:/ref.wav",
            ref_text="reference",
            num_step=24,
            speed=1.25,
        )
    )
    assert result.sample_rate == 24_000
    assert result.samples.shape == (2400,)
    assert fake.calls[0] == {
        "text": "Hello [laughter]",
        "num_step": 24,
        "speed": 1.25,
        "ref_audio": "C:/ref.wav",
        "ref_text": "reference",
    }


def test_synthesize_passes_instruct_when_no_reference():
    engine = OmniVoiceEngine(model_id="m", device="cpu", dtype="float32")
    fake = FakeModel()
    engine._model = fake
    engine.synthesize(SynthesisRequest(text="Hi", instruct="female, low pitch"))
    assert fake.calls[0]["instruct"] == "female, low pitch"
    assert "ref_audio" not in fake.calls[0]


def test_synthesize_omits_instruct_and_reference_for_auto_voice():
    engine = OmniVoiceEngine(model_id="m", device="cpu", dtype="float32")
    fake = FakeModel()
    engine._model = fake
    engine.synthesize(SynthesisRequest(text="Hi"))
    assert set(fake.calls[0]) == {"text", "num_step", "speed"}


def test_synthesize_forwards_duration_override():
    engine = OmniVoiceEngine(model_id="m", device="cpu", dtype="float32")
    fake = FakeModel()
    engine._model = fake
    engine.synthesize(SynthesisRequest(text="Hi", duration=4.0))
    assert fake.calls[0]["duration"] == 4.0


def test_load_failure_is_recorded_in_status():
    engine = OmniVoiceEngine(model_id="m", device="cpu", dtype="float32")

    def boom():
        raise RuntimeError("CUDA out of memory")

    engine._build_model = boom
    with pytest.raises(RuntimeError):
        engine.load()
    status = engine.status()
    assert status.loaded is False
    assert "CUDA out of memory" in status.error


@pytest.mark.gpu
def test_real_engine_synthesizes_audio():
    from voxrox.config import get_settings

    settings = get_settings()
    engine = OmniVoiceEngine(
        model_id=settings.model_id, device=settings.device, dtype=settings.dtype
    )
    engine.load()
    result = engine.synthesize(SynthesisRequest(text="This is a VoxRox test.", num_step=16))
    assert result.sample_rate == 24_000
    assert result.samples.size > 12_000
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_engine.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'voxrox.engine'`.

- [ ] **Step 3: Write `backend/voxrox/engine/__init__.py`**

```python
from voxrox.engine.base import EngineStatus, SynthesisRequest, SynthesisResult, TTSEngine
from voxrox.engine.omnivoice import OmniVoiceEngine, get_engine

__all__ = [
    "EngineStatus",
    "SynthesisRequest",
    "SynthesisResult",
    "TTSEngine",
    "OmniVoiceEngine",
    "get_engine",
]
```

- [ ] **Step 4: Write `backend/voxrox/engine/base.py`**

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

import numpy as np

from voxrox.config import SAMPLE_RATE


@dataclass
class SynthesisRequest:
    text: str
    ref_audio: str | None = None
    ref_text: str | None = None
    instruct: str | None = None
    num_step: int = 32
    speed: float = 1.0
    duration: float | None = None

    def __post_init__(self) -> None:
        if not self.text or not self.text.strip():
            raise ValueError("text must not be blank")


@dataclass
class SynthesisResult:
    samples: np.ndarray
    sample_rate: int = SAMPLE_RATE


@dataclass
class EngineStatus:
    model: str
    device: str
    dtype: str
    loaded: bool = False
    error: str | None = None
    capabilities: list[str] = field(
        default_factory=lambda: ["auto", "clone", "design"]
    )


@runtime_checkable
class TTSEngine(Protocol):
    def status(self) -> EngineStatus: ...

    def load(self) -> None: ...

    def synthesize(self, request: SynthesisRequest) -> SynthesisResult: ...
```

- [ ] **Step 5: Write `backend/voxrox/engine/omnivoice.py`**

```python
from __future__ import annotations

import threading
from functools import lru_cache

import numpy as np

from voxrox.config import SAMPLE_RATE, get_settings
from voxrox.engine.base import EngineStatus, SynthesisRequest, SynthesisResult


class OmniVoiceEngine:
    """Adapter over k2-fsa/OmniVoice. The model loads lazily and once."""

    def __init__(self, *, model_id: str, device: str, dtype: str) -> None:
        self.model_id = model_id
        self.device = device
        self.dtype = dtype
        self._model = None
        self._error: str | None = None
        self._lock = threading.Lock()

    def _build_model(self):
        import torch
        from omnivoice import OmniVoice

        torch_dtype = getattr(torch, self.dtype)
        return OmniVoice.from_pretrained(
            self.model_id, device_map=self.device, dtype=torch_dtype
        )

    def load(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            try:
                self._model = self._build_model()
                self._error = None
            except BaseException as exc:  # surfaced through status(), then re-raised
                self._error = f"{type(exc).__name__}: {exc}"
                raise

    def status(self) -> EngineStatus:
        return EngineStatus(
            model=self.model_id,
            device=self.device,
            dtype=self.dtype,
            loaded=self._model is not None,
            error=self._error,
        )

    def synthesize(self, request: SynthesisRequest) -> SynthesisResult:
        if self._model is None:
            self.load()
        kwargs: dict = {
            "text": request.text,
            "num_step": request.num_step,
            "speed": request.speed,
        }
        if request.duration is not None:
            kwargs["duration"] = request.duration
        if request.ref_audio:
            kwargs["ref_audio"] = request.ref_audio
            if request.ref_text:
                kwargs["ref_text"] = request.ref_text
        elif request.instruct:
            kwargs["instruct"] = request.instruct

        audio = self._model.generate(**kwargs)
        samples = np.asarray(audio[0], dtype=np.float32).reshape(-1)
        return SynthesisResult(samples=samples, sample_rate=SAMPLE_RATE)


@lru_cache(maxsize=1)
def get_engine() -> OmniVoiceEngine:
    settings = get_settings()
    return OmniVoiceEngine(
        model_id=settings.model_id, device=settings.device, dtype=settings.dtype
    )
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_engine.py -v
```

Expected: `7 passed, 1 deselected` (the `gpu`-marked test is deselected by `addopts`).

- [ ] **Step 7: Install the real engine dependencies**

```bash
backend/.venv/Scripts/python -m pip install torch==2.8.0+cu128 torchaudio==2.8.0+cu128 --extra-index-url https://download.pytorch.org/whl/cu128 && backend/.venv/Scripts/python -m pip install omnivoice
```

Expected: both installs succeed. This downloads several GB.

- [ ] **Step 8: Run the real-engine test once to confirm the model loads on this GPU**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_engine.py -v -m gpu
```

Expected: `1 passed`. First run also downloads the model weights. If it fails with CUDA OOM, set `VOXROX_DEVICE=cpu` and re-run to confirm the adapter itself is correct, then record the OOM in the Settings screen work (Task 24).

- [ ] **Step 9: Commit**

```bash
git add backend/voxrox/engine backend/tests/test_engine.py && git commit -m "feat(backend): add OmniVoice engine adapter with lazy loading"
```

---

## Task 8: Vocabulary and engine-status routes

**Files:**
- Create: `backend/voxrox/routers/__init__.py`
- Create: `backend/voxrox/routers/vocab.py`
- Modify: `backend/voxrox/app.py`
- Test: `backend/tests/test_vocab_routes.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_vocab_routes.py`**

```python
def test_tags_route_returns_groups(client):
    response = client.get("/api/tags")
    assert response.status_code == 200
    groups = response.json()["groups"]
    assert [g["id"] for g in groups] == [
        "vocal", "response", "question", "surprise", "dissatisfaction",
    ]
    assert groups[0]["tags"][0]["token"] == "[laughter]"
    assert groups[0]["tags"][0]["hotkey"] == "1"


def test_voice_vocab_route_returns_scales(client):
    payload = client.get("/api/voice-vocab").json()
    assert payload["genders"] == ["", "male", "female"]
    assert payload["ages"][1] == "child"
    assert payload["pitches"][-1] == "very high"
    assert payload["intensities"] == ["faintly", "slightly", "", "very", "extremely"]
    assert "whisper" in payload["styles"]


def test_engine_status_route_reports_unloaded_engine(client):
    payload = client.get("/api/engine/status").json()
    assert payload["loaded"] is False
    assert payload["model"] == "k2-fsa/OmniVoice"
    assert payload["capabilities"] == ["auto", "clone", "design"]
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_vocab_routes.py -v
```

Expected: FAIL — all three return 404.

- [ ] **Step 3: Write `backend/voxrox/routers/__init__.py`**

```python
```

(Empty file — it only marks the package.)

- [ ] **Step 4: Write `backend/voxrox/routers/vocab.py`**

```python
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends

from voxrox import tags, voicevocab
from voxrox.engine.base import TTSEngine
from voxrox.engine.omnivoice import get_engine

router = APIRouter(prefix="/api", tags=["vocabulary"])


def engine_dependency() -> TTSEngine:
    return get_engine()


@router.get("/tags")
def read_tags() -> dict:
    return {"groups": [group.model_dump() for group in tags.TAG_GROUPS]}


@router.get("/voice-vocab")
def read_voice_vocab() -> dict:
    return {
        "genders": voicevocab.GENDERS,
        "ages": voicevocab.AGES,
        "pitches": voicevocab.PITCHES,
        "styles": voicevocab.STYLES,
        "accents": voicevocab.ACCENTS,
        "dialects": voicevocab.DIALECTS,
        "moods": voicevocab.MOODS,
        "intensities": voicevocab.INTENSITIES,
    }


@router.get("/engine/status")
def read_engine_status(engine: TTSEngine = Depends(engine_dependency)) -> dict:
    return asdict(engine.status())


@router.post("/engine/warmup")
def warm_up_engine(engine: TTSEngine = Depends(engine_dependency)) -> dict:
    try:
        engine.load()
    except BaseException:
        pass
    return asdict(engine.status())
```

- [ ] **Step 5: Register the router — replace the `app.mount` line in `backend/voxrox/app.py`**

```python
    from voxrox.routers import vocab

    app.include_router(vocab.router)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    return app
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_vocab_routes.py -v
```

Expected: `3 passed`.

- [ ] **Step 7: Commit**

```bash
git add backend/voxrox/routers backend/voxrox/app.py backend/tests/test_vocab_routes.py && git commit -m "feat(backend): expose tag, voice and engine-status routes"
```

---

## Task 9: Profile CRUD service and routes

**Files:**
- Create: `backend/voxrox/services/__init__.py`
- Create: `backend/voxrox/services/profiles.py`
- Create: `backend/voxrox/routers/profiles.py`
- Modify: `backend/voxrox/app.py`
- Test: `backend/tests/test_profile_routes.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_profile_routes.py`**

```python
def create_profile(client, **overrides):
    payload = {"name": "Ivy Thorn"}
    payload.update(overrides)
    response = client.post("/api/profiles", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_list_is_empty_initially(client):
    assert client.get("/api/profiles").json() == []


def test_create_returns_profile_with_defaults(client):
    profile = create_profile(client)
    assert profile["name"] == "Ivy Thorn"
    assert profile["voiceMode"] == "auto"
    assert profile["card"]["shortName"] == "Ivy Thorn"
    assert profile["params"]["numStep"] == 32
    assert profile["samples"] == []


def test_create_rejects_blank_name(client):
    assert client.post("/api/profiles", json={"name": "  "}).status_code == 422


def test_created_profile_appears_in_list(client):
    profile = create_profile(client)
    listed = client.get("/api/profiles").json()
    assert [p["id"] for p in listed] == [profile["id"]]


def test_get_returns_the_profile(client):
    profile = create_profile(client)
    assert client.get(f"/api/profiles/{profile['id']}").json() == profile


def test_get_missing_returns_404(client):
    assert client.get("/api/profiles/deadbeef").status_code == 404


def test_patch_merges_nested_fields_only(client):
    profile = create_profile(client)
    response = client.patch(
        f"/api/profiles/{profile['id']}",
        json={"voiceMode": "design", "voice": {"gender": "female", "pitch": "low"}},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["voiceMode"] == "design"
    assert updated["voice"]["gender"] == "female"
    assert updated["voice"]["pitch"] == "low"
    assert updated["name"] == "Ivy Thorn"
    assert updated["params"]["numStep"] == 32


def test_patch_bumps_updated_at(client):
    profile = create_profile(client)
    updated = client.patch(
        f"/api/profiles/{profile['id']}", json={"narrative": {"description": "A ranger."}}
    ).json()
    assert updated["narrative"]["description"] == "A ranger."
    assert updated["updatedAt"] >= profile["updatedAt"]


def test_patch_rejects_invalid_params(client):
    profile = create_profile(client)
    response = client.patch(f"/api/profiles/{profile['id']}", json={"params": {"speed": 9}})
    assert response.status_code == 422


def test_delete_removes_the_profile(client):
    profile = create_profile(client)
    assert client.delete(f"/api/profiles/{profile['id']}").status_code == 204
    assert client.get(f"/api/profiles/{profile['id']}").status_code == 404


def test_delete_missing_returns_404(client):
    assert client.delete("/api/profiles/deadbeef").status_code == 404


def test_instruct_preview_is_computed_from_voice(client):
    profile = create_profile(client)
    client.patch(
        f"/api/profiles/{profile['id']}",
        json={"voice": {"gender": "female", "age": "elderly", "mood": "weary", "intensity": 3}},
    )
    payload = client.get(f"/api/profiles/{profile['id']}/instruct").json()
    assert payload["instruct"] == "female, elderly, very weary"
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_profile_routes.py -v
```

Expected: FAIL — every request returns 404.

- [ ] **Step 3: Write `backend/voxrox/services/__init__.py`**

```python
```

(Empty file — package marker.)

- [ ] **Step 4: Write `backend/voxrox/services/profiles.py`**

```python
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
```

- [ ] **Step 5: Write `backend/voxrox/routers/profiles.py`**

```python
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, field_validator

from voxrox.models import Profile
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
```

- [ ] **Step 6: Register the router in `backend/voxrox/app.py`**

Replace the import/include block added in Task 8 with:

```python
    from voxrox.routers import profiles, vocab

    app.include_router(vocab.router)
    app.include_router(profiles.router)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    return app
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_profile_routes.py -v
```

Expected: `12 passed`. Pydantic raises `ValidationError` (a `ValueError` subclass) for bad `params`, which the `except ValueError` in `patch_profile` converts to 422.

- [ ] **Step 8: Commit**

```bash
git add backend/voxrox/services backend/voxrox/routers/profiles.py backend/voxrox/app.py backend/tests/test_profile_routes.py && git commit -m "feat(backend): add profile CRUD service and routes"
```

---

## Task 10: Portrait and voice-sample uploads

**Files:**
- Create: `backend/voxrox/services/media.py`
- Modify: `backend/voxrox/routers/profiles.py` (append routes at end of file)
- Test: `backend/tests/test_profile_media.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_profile_media.py`**

```python
import io

import numpy as np
import soundfile as sf

PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c6300010000050001"
    "0d0a2db40000000049454e44ae426082"
)


def wav_bytes(seconds: float = 1.0) -> bytes:
    buffer = io.BytesIO()
    sf.write(buffer, np.zeros(int(24_000 * seconds), dtype=np.float32),
             24_000, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


def make_profile(client):
    return client.post("/api/profiles", json={"name": "Ivy"}).json()


def test_portrait_upload_sets_url_and_writes_file(client, data_dir):
    profile = make_profile(client)
    response = client.post(
        f"/api/profiles/{profile['id']}/portrait",
        files={"file": ("face.png", PNG_1X1, "image/png")},
    )
    assert response.status_code == 200
    url = response.json()["portraitUrl"]
    assert url.startswith("/media/portraits/")
    assert (data_dir / "media" / "portraits").glob("*.png")
    assert client.get(url).status_code == 200


def test_portrait_upload_rejects_non_image(client):
    profile = make_profile(client)
    response = client.post(
        f"/api/profiles/{profile['id']}/portrait",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 415


def test_sample_upload_appends_and_measures_duration(client):
    profile = make_profile(client)
    response = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("ref.wav", wav_bytes(2.0), "audio/wav")},
        data={"transcript": "A reference line."},
    )
    assert response.status_code == 201
    updated = response.json()
    assert len(updated["samples"]) == 1
    sample = updated["samples"][0]
    assert sample["transcript"] == "A reference line."
    assert 1.9 < sample["durationSec"] < 2.1
    assert sample["url"].startswith(f"/media/samples/{profile['id']}/")


def test_first_sample_becomes_active_and_switches_mode_to_clone(client):
    profile = make_profile(client)
    updated = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("ref.wav", wav_bytes(), "audio/wav")},
    ).json()
    assert updated["activeSampleId"] == updated["samples"][0]["id"]
    assert updated["voiceMode"] == "clone"


def test_second_sample_does_not_steal_active(client):
    profile = make_profile(client)
    first = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("a.wav", wav_bytes(), "audio/wav")},
    ).json()
    second = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("b.wav", wav_bytes(), "audio/wav")},
    ).json()
    assert second["activeSampleId"] == first["activeSampleId"]
    assert len(second["samples"]) == 2


def test_sample_upload_rejects_non_audio(client):
    profile = make_profile(client)
    response = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("x.png", PNG_1X1, "image/png")},
    )
    assert response.status_code == 415


def test_delete_sample_clears_active_when_it_was_active(client):
    profile = make_profile(client)
    uploaded = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("a.wav", wav_bytes(), "audio/wav")},
    ).json()
    sample_id = uploaded["samples"][0]["id"]
    response = client.delete(f"/api/profiles/{profile['id']}/samples/{sample_id}")
    assert response.status_code == 200
    assert response.json()["samples"] == []
    assert response.json()["activeSampleId"] is None


def test_delete_missing_sample_returns_404(client):
    profile = make_profile(client)
    assert client.delete(f"/api/profiles/{profile['id']}/samples/nope").status_code == 404


def test_set_active_sample(client):
    profile = make_profile(client)
    client.post(f"/api/profiles/{profile['id']}/samples",
                files={"file": ("a.wav", wav_bytes(), "audio/wav")})
    second = client.post(f"/api/profiles/{profile['id']}/samples",
                         files={"file": ("b.wav", wav_bytes(), "audio/wav")}).json()
    target = second["samples"][1]["id"]
    updated = client.post(
        f"/api/profiles/{profile['id']}/samples/{target}/activate"
    ).json()
    assert updated["activeSampleId"] == target
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_profile_media.py -v
```

Expected: FAIL — upload routes return 404/405.

- [ ] **Step 3: Write `backend/voxrox/services/media.py`**

```python
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
```

- [ ] **Step 4: Append the upload routes to `backend/voxrox/routers/profiles.py`**

Add these imports to the top of the file:

```python
from fastapi import File, Form, UploadFile

from voxrox.audio import probe_duration
from voxrox.config import get_settings
from voxrox.models import VoiceSample, new_id
from voxrox.services import media
```

Then append at the end of the file:

```python
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
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_profile_media.py -v
```

Expected: `9 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/voxrox/services/media.py backend/voxrox/routers/profiles.py backend/tests/test_profile_media.py && git commit -m "feat(backend): add portrait and voice-sample uploads"
```

---

## Task 11: Project and turn CRUD

**Files:**
- Create: `backend/voxrox/services/projects.py`
- Create: `backend/voxrox/routers/projects.py`
- Modify: `backend/voxrox/app.py`
- Test: `backend/tests/test_project_routes.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_project_routes.py`**

```python
import pytest


@pytest.fixture()
def profile_id(client):
    return client.post("/api/profiles", json={"name": "Ivy"}).json()["id"]


@pytest.fixture()
def project(client):
    response = client.post("/api/projects", json={"name": "Scene 1"})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_project_has_defaults(client, project):
    assert project["name"] == "Scene 1"
    assert project["turns"] == []
    assert project["participantIds"] == []
    assert project["sequencer"] == {
        "mode": "sequential", "delayMs": 300, "staggerMs": 0,
        "loop": False, "volume": 1.0,
    }


def test_create_rejects_blank_name(client):
    assert client.post("/api/projects", json={"name": " "}).status_code == 422


def test_list_projects_returns_summaries_without_turns(client, project):
    listed = client.get("/api/projects").json()
    assert listed == [{
        "id": project["id"], "name": "Scene 1",
        "createdAt": project["createdAt"], "updatedAt": project["updatedAt"],
        "turnCount": 0, "renderedCount": 0,
        "participantIds": [],
    }]


def test_add_turn_registers_participant(client, project, profile_id):
    response = client.post(
        f"/api/projects/{project['id']}/turns",
        json={"profileId": profile_id, "text": "Hello there."},
    )
    assert response.status_code == 201
    updated = response.json()
    assert len(updated["turns"]) == 1
    assert updated["turns"][0]["status"] == "draft"
    assert updated["turns"][0]["audio"] is None
    assert updated["participantIds"] == [profile_id]


def test_add_turn_with_unknown_profile_returns_404(client, project):
    response = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": "ghost", "text": "hi"}
    )
    assert response.status_code == 404


def test_adding_second_turn_for_same_profile_keeps_one_participant(client, project, profile_id):
    client.post(f"/api/projects/{project['id']}/turns", json={"profileId": profile_id})
    updated = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()
    assert updated["participantIds"] == [profile_id]
    assert len(updated["turns"]) == 2


def test_patch_turn_updates_text_and_params(client, project, profile_id):
    created = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()
    turn_id = created["turns"][0]["id"]
    updated = client.patch(
        f"/api/projects/{project['id']}/turns/{turn_id}",
        json={"text": "Line [sigh] two", "params": {"speed": 1.2}},
    ).json()
    turn = updated["turns"][0]
    assert turn["text"] == "Line [sigh] two"
    assert turn["params"]["speed"] == 1.2
    assert turn["params"]["numStep"] == 32


def test_patch_turn_rejects_unknown_tags(client, project, profile_id):
    created = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()
    turn_id = created["turns"][0]["id"]
    response = client.patch(
        f"/api/projects/{project['id']}/turns/{turn_id}", json={"text": "hi [wobble]"}
    )
    assert response.status_code == 422
    assert "[wobble]" in response.json()["detail"]


def test_delete_turn_removes_it_and_drops_orphan_participant(client, project, profile_id):
    created = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()
    turn_id = created["turns"][0]["id"]
    updated = client.delete(f"/api/projects/{project['id']}/turns/{turn_id}").json()
    assert updated["turns"] == []
    assert updated["participantIds"] == []


def test_reorder_turns(client, project, profile_id):
    first = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()["turns"][0]["id"]
    second = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()["turns"][1]["id"]
    updated = client.post(
        f"/api/projects/{project['id']}/reorder", json={"turnIds": [second, first]}
    ).json()
    assert [t["id"] for t in updated["turns"]] == [second, first]


def test_reorder_rejects_mismatched_id_set(client, project, profile_id):
    client.post(f"/api/projects/{project['id']}/turns", json={"profileId": profile_id})
    response = client.post(
        f"/api/projects/{project['id']}/reorder", json={"turnIds": ["bogus"]}
    )
    assert response.status_code == 422


def test_patch_project_updates_sequencer_settings(client, project):
    updated = client.patch(
        f"/api/projects/{project['id']}",
        json={"sequencer": {"mode": "simultaneous", "delayMs": 750, "loop": True}},
    ).json()
    assert updated["sequencer"]["mode"] == "simultaneous"
    assert updated["sequencer"]["delayMs"] == 750
    assert updated["sequencer"]["loop"] is True
    assert updated["sequencer"]["volume"] == 1.0


def test_delete_project(client, project):
    assert client.delete(f"/api/projects/{project['id']}").status_code == 204
    assert client.get(f"/api/projects/{project['id']}").status_code == 404
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_project_routes.py -v
```

Expected: FAIL — all project routes return 404.

- [ ] **Step 3: Write `backend/voxrox/services/projects.py`**

```python
from __future__ import annotations

from typing import Any

from voxrox.config import get_settings
from voxrox.models import Project, Turn, utc_now
from voxrox.services.profiles import deep_merge
from voxrox.storage import JsonStore, NotFoundError


def _store() -> JsonStore:
    return JsonStore(get_settings().projects_dir)


def list_projects() -> list[Project]:
    return [Project.model_validate(doc) for doc in _store().read_all()]


def get_project(project_id: str) -> Project:
    return Project.model_validate(_store().read(project_id))


def save_project(project: Project) -> Project:
    project.updated_at = utc_now()
    _store().write(project.id, project.model_dump(by_alias=True))
    return project


def create_project(name: str) -> Project:
    return save_project(Project(name=name.strip()))


def update_project(project_id: str, patch: dict[str, Any]) -> Project:
    current = _store().read(project_id)
    merged = deep_merge(current, patch)
    merged["id"] = project_id
    return save_project(Project.model_validate(merged))


def delete_project(project_id: str) -> None:
    _store().delete(project_id)


def summarize(project: Project) -> dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "createdAt": project.created_at,
        "updatedAt": project.updated_at,
        "turnCount": len(project.turns),
        "renderedCount": sum(1 for t in project.turns if t.audio is not None),
        "participantIds": list(project.participant_ids),
    }


def find_turn(project: Project, turn_id: str) -> Turn:
    for turn in project.turns:
        if turn.id == turn_id:
            return turn
    raise NotFoundError(turn_id)


def sync_participants(project: Project) -> None:
    """participant_ids == distinct profile ids across turns, in first-use order."""
    ordered: list[str] = []
    for turn in project.turns:
        if turn.profile_id not in ordered:
            ordered.append(turn.profile_id)
    project.participant_ids = ordered


__all__ = [
    "NotFoundError",
    "create_project",
    "delete_project",
    "find_turn",
    "get_project",
    "list_projects",
    "save_project",
    "summarize",
    "sync_participants",
    "update_project",
]
```

- [ ] **Step 4: Write `backend/voxrox/routers/projects.py`**

```python
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, field_validator

from voxrox import tags
from voxrox.models import GenerationParams, Project, Turn, utc_now
from voxrox.services import profiles as profile_service
from voxrox.services import projects as service
from voxrox.storage import NotFoundError

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectBody(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("name must not be blank")
        return value


class CreateTurnBody(BaseModel):
    profileId: str
    text: str = ""


class ReorderBody(BaseModel):
    turnIds: list[str]


def _load(project_id: str) -> Project:
    try:
        return service.get_project(project_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="project not found")


def _reject_unknown_tags(text: str) -> None:
    unknown = tags.unknown_tags(text)
    if unknown:
        raise HTTPException(
            status_code=422, detail=f"unknown tags: {', '.join(unknown)}"
        )


@router.get("")
def list_projects() -> list[dict]:
    return [service.summarize(p) for p in service.list_projects()]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(body: CreateProjectBody) -> dict:
    return service.create_project(body.name).model_dump(by_alias=True)


@router.get("/{project_id}")
def read_project(project_id: str) -> dict:
    return _load(project_id).model_dump(by_alias=True)


@router.patch("/{project_id}")
def patch_project(project_id: str, patch: dict[str, Any]) -> dict:
    _load(project_id)
    for immutable in ("id", "createdAt", "turns", "participantIds"):
        patch.pop(immutable, None)
    try:
        return service.update_project(project_id, patch).model_dump(by_alias=True)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str) -> Response:
    _load(project_id)
    service.delete_project(project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/turns", status_code=status.HTTP_201_CREATED)
def add_turn(project_id: str, body: CreateTurnBody) -> dict:
    project = _load(project_id)
    try:
        profile = profile_service.get_profile(body.profileId)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="profile not found")
    _reject_unknown_tags(body.text)
    project.turns.append(
        Turn(
            profile_id=profile.id,
            text=body.text,
            params=GenerationParams(**profile.params.model_dump()),
        )
    )
    service.sync_participants(project)
    return service.save_project(project).model_dump(by_alias=True)


@router.patch("/{project_id}/turns/{turn_id}")
def patch_turn(project_id: str, turn_id: str, patch: dict[str, Any]) -> dict:
    project = _load(project_id)
    try:
        turn = service.find_turn(project, turn_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="turn not found")
    for immutable in ("id", "createdAt", "audio", "status", "profileId"):
        patch.pop(immutable, None)
    if "text" in patch:
        _reject_unknown_tags(patch["text"])
    merged = profile_service.deep_merge(turn.model_dump(by_alias=True), patch)
    try:
        updated = Turn.model_validate(merged)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    updated.updated_at = utc_now()
    project.turns = [updated if t.id == turn_id else t for t in project.turns]
    return service.save_project(project).model_dump(by_alias=True)


@router.delete("/{project_id}/turns/{turn_id}")
def delete_turn(project_id: str, turn_id: str) -> dict:
    project = _load(project_id)
    remaining = [t for t in project.turns if t.id != turn_id]
    if len(remaining) == len(project.turns):
        raise HTTPException(status_code=404, detail="turn not found")
    project.turns = remaining
    service.sync_participants(project)
    return service.save_project(project).model_dump(by_alias=True)


@router.post("/{project_id}/reorder")
def reorder_turns(project_id: str, body: ReorderBody) -> dict:
    project = _load(project_id)
    by_id = {turn.id: turn for turn in project.turns}
    if set(body.turnIds) != set(by_id) or len(body.turnIds) != len(by_id):
        raise HTTPException(status_code=422, detail="turnIds must be a permutation")
    project.turns = [by_id[turn_id] for turn_id in body.turnIds]
    service.sync_participants(project)
    return service.save_project(project).model_dump(by_alias=True)
```

- [ ] **Step 5: Register the router in `backend/voxrox/app.py`**

```python
    from voxrox.routers import profiles, projects, vocab

    app.include_router(vocab.router)
    app.include_router(profiles.router)
    app.include_router(projects.router)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    return app
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_project_routes.py -v
```

Expected: `13 passed`.

- [ ] **Step 7: Commit**

```bash
git add backend/voxrox/services/projects.py backend/voxrox/routers/projects.py backend/voxrox/app.py backend/tests/test_project_routes.py && git commit -m "feat(backend): add project and turn CRUD"
```

---

## Task 12: Preview and render orchestration

This is the seam that binds text → engine → WAV on disk → chat log → profile archive. Preview writes to `data/tmp/preview/` and touches no state; render writes to `data/media/renders/<projectId>/<turnId>.wav`, flips the turn to `rendered`, and appends an `ArchiveEntry` to the profile.

**Files:**
- Create: `backend/voxrox/services/render.py`
- Create: `backend/voxrox/routers/render.py`
- Modify: `backend/voxrox/app.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_render.py`

- [ ] **Step 1: Add the stub-engine fixture to `backend/tests/conftest.py`**

Append to the existing file:

```python
class StubEngine:
    """Test double injected at the engine dependency seam."""

    def __init__(self):
        self.requests = []
        self.seconds = 1.5

    def status(self):
        from voxrox.engine.base import EngineStatus

        return EngineStatus(model="stub", device="cpu", dtype="float32", loaded=True)

    def load(self):
        return None

    def synthesize(self, request):
        import numpy as np

        from voxrox.engine.base import SynthesisResult

        self.requests.append(request)
        count = int(24_000 * self.seconds)
        tone = np.sin(np.linspace(0, 220 * 2 * np.pi, count)).astype("float32") * 0.2
        return SynthesisResult(samples=tone, sample_rate=24_000)


@pytest.fixture()
def stub_engine():
    return StubEngine()


@pytest.fixture()
def engine_client(data_dir, stub_engine):
    from voxrox.app import create_app
    from voxrox.routers.vocab import engine_dependency

    app = create_app()
    app.dependency_overrides[engine_dependency] = lambda: stub_engine
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Write the failing test `backend/tests/test_render.py`**

```python
import io

import numpy as np
import pytest
import soundfile as sf


def wav_bytes(seconds: float = 1.0) -> bytes:
    buffer = io.BytesIO()
    sf.write(buffer, np.zeros(int(24_000 * seconds), dtype=np.float32),
             24_000, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


@pytest.fixture()
def profile(engine_client):
    return engine_client.post("/api/profiles", json={"name": "Ivy"}).json()


@pytest.fixture()
def project(engine_client):
    return engine_client.post("/api/projects", json={"name": "Scene 1"}).json()


@pytest.fixture()
def turn(engine_client, project, profile):
    updated = engine_client.post(
        f"/api/projects/{project['id']}/turns",
        json={"profileId": profile["id"], "text": "Hello [laughter] world."},
    ).json()
    return updated["turns"][0]


def test_preview_returns_playable_url_and_duration(engine_client, profile):
    response = engine_client.post(
        "/api/preview",
        json={"profileId": profile["id"], "text": "Testing one two."},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["url"].startswith("/api/preview/")
    assert payload["durationSec"] == pytest.approx(1.5, abs=0.01)
    assert engine_client.get(payload["url"]).status_code == 200


def test_preview_rejects_blank_text(engine_client, profile):
    response = engine_client.post(
        "/api/preview", json={"profileId": profile["id"], "text": "   "}
    )
    assert response.status_code == 422


def test_preview_rejects_unknown_tags(engine_client, profile):
    response = engine_client.post(
        "/api/preview", json={"profileId": profile["id"], "text": "hi [wobble]"}
    )
    assert response.status_code == 422


def test_auto_mode_sends_neither_instruct_nor_reference(engine_client, profile, stub_engine):
    engine_client.post("/api/preview", json={"profileId": profile["id"], "text": "Hi"})
    request = stub_engine.requests[-1]
    assert request.instruct is None
    assert request.ref_audio is None


def test_design_mode_sends_composed_instruct(engine_client, profile, stub_engine):
    engine_client.patch(
        f"/api/profiles/{profile['id']}",
        json={"voiceMode": "design",
              "voice": {"gender": "female", "pitch": "low", "accent": "british"}},
    )
    engine_client.post("/api/preview", json={"profileId": profile["id"], "text": "Hi"})
    assert stub_engine.requests[-1].instruct == "female, low pitch, british accent"


def test_clone_mode_sends_active_sample_path_and_transcript(
    engine_client, profile, stub_engine, data_dir
):
    engine_client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("ref.wav", wav_bytes(), "audio/wav")},
        data={"transcript": "reference line"},
    )
    engine_client.post("/api/preview", json={"profileId": profile["id"], "text": "Hi"})
    request = stub_engine.requests[-1]
    assert request.ref_audio.endswith(".wav")
    assert (data_dir / "media" / "samples" / profile["id"]).exists()
    assert request.ref_text == "reference line"


def test_preview_overrides_beat_profile_params(engine_client, profile, stub_engine):
    engine_client.post(
        "/api/preview",
        json={"profileId": profile["id"], "text": "Hi",
              "params": {"numStep": 16, "speed": 1.5, "duration": 3.0}},
    )
    request = stub_engine.requests[-1]
    assert (request.num_step, request.speed, request.duration) == (16, 1.5, 3.0)


def test_render_attaches_audio_to_the_turn(engine_client, project, turn):
    response = engine_client.post(
        f"/api/projects/{project['id']}/turns/{turn['id']}/render"
    )
    assert response.status_code == 200
    updated = response.json()["turns"][0]
    assert updated["status"] == "rendered"
    assert updated["audio"]["url"] == f"/media/renders/{project['id']}/{turn['id']}.wav"
    assert updated["audio"]["sampleRate"] == 24_000
    assert updated["audio"]["durationSec"] == pytest.approx(1.5, abs=0.01)


def test_render_writes_the_file(engine_client, project, turn, data_dir):
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    path = data_dir / "media" / "renders" / project["id"] / f"{turn['id']}.wav"
    assert path.is_file()


def test_render_appends_an_archive_entry_to_the_profile(
    engine_client, project, turn, profile
):
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    archive = engine_client.get(f"/api/profiles/{profile['id']}").json()["archive"]
    assert len(archive) == 1
    assert archive[0]["projectId"] == project["id"]
    assert archive[0]["projectName"] == "Scene 1"
    assert archive[0]["turnId"] == turn["id"]
    assert archive[0]["text"] == "Hello [laughter] world."


def test_re_rendering_replaces_the_archive_entry(engine_client, project, turn, profile):
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    archive = engine_client.get(f"/api/profiles/{profile['id']}").json()["archive"]
    assert len(archive) == 1


def test_render_refuses_empty_turn_text(engine_client, project, profile):
    created = engine_client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile["id"]}
    ).json()
    turn_id = created["turns"][0]["id"]
    response = engine_client.post(
        f"/api/projects/{project['id']}/turns/{turn_id}/render"
    )
    assert response.status_code == 422


def test_render_uses_the_turn_params_not_the_profile(
    engine_client, project, turn, stub_engine
):
    engine_client.patch(
        f"/api/projects/{project['id']}/turns/{turn['id']}",
        json={"params": {"numStep": 16, "speed": 0.75}},
    )
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    request = stub_engine.requests[-1]
    assert (request.num_step, request.speed) == (16, 0.75)


def test_render_of_missing_turn_returns_404(engine_client, project):
    assert engine_client.post(
        f"/api/projects/{project['id']}/turns/ghost/render"
    ).status_code == 404


def test_turn_voice_override_wins_over_profile_voice(
    engine_client, project, turn, profile, stub_engine
):
    engine_client.patch(f"/api/profiles/{profile['id']}", json={"voiceMode": "design"})
    engine_client.patch(
        f"/api/projects/{project['id']}/turns/{turn['id']}",
        json={"voiceOverride": {"gender": "male", "mood": "angry", "intensity": 4}},
    )
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    assert stub_engine.requests[-1].instruct == "male, extremely angry"
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
backend/.venv/Scripts/python -m pytest backend/tests/test_render.py -v
```

Expected: FAIL — `/api/preview` and the render route return 404.

- [ ] **Step 4: Write `backend/voxrox/services/render.py`**

```python
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
```

- [ ] **Step 5: Write `backend/voxrox/routers/render.py`**

```python
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from voxrox.config import get_settings
from voxrox.engine.base import TTSEngine
from voxrox.models import GenerationParams, VoiceDesign
from voxrox.routers.vocab import engine_dependency
from voxrox.services import profiles as profile_service
from voxrox.services import projects as project_service
from voxrox.services import render as render_service
from voxrox.storage import NotFoundError

router = APIRouter(prefix="/api", tags=["render"])


class PreviewBody(BaseModel):
    profileId: str
    text: str
    params: GenerationParams | None = None
    voiceOverride: VoiceDesign | None = None


@router.post("/preview")
def create_preview(
    body: PreviewBody, engine: TTSEngine = Depends(engine_dependency)
) -> dict:
    try:
        profile = profile_service.get_profile(body.profileId)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="profile not found")
    try:
        request = render_service.build_request(
            profile=profile,
            text=body.text,
            params=body.params or profile.params,
            voice_override=body.voiceOverride,
        )
        preview_id, duration = render_service.render_preview(engine, request)
    except render_service.RenderError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"synthesis failed: {exc}")
    return {"url": f"/api/preview/{preview_id}", "durationSec": duration}


@router.get("/preview/{preview_id}")
def read_preview(preview_id: str) -> FileResponse:
    path = get_settings().preview_dir / f"{preview_id}.wav"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="preview not found")
    return FileResponse(path, media_type="audio/wav")


@router.post("/projects/{project_id}/turns/{turn_id}/render")
def render_turn(
    project_id: str, turn_id: str, engine: TTSEngine = Depends(engine_dependency)
) -> dict:
    try:
        project = project_service.get_project(project_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="project not found")
    try:
        turn = project_service.find_turn(project, turn_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="turn not found")
    try:
        profile = profile_service.get_profile(turn.profile_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="profile not found")
    try:
        render_service.render_turn(engine, project, turn, profile)
    except render_service.RenderError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"synthesis failed: {exc}")
    project.turns = [turn if t.id == turn_id else t for t in project.turns]
    return project_service.save_project(project).model_dump(by_alias=True)
```

- [ ] **Step 6: Register the router in `backend/voxrox/app.py`**

```python
    from voxrox.routers import profiles, projects, render, vocab

    app.include_router(vocab.router)
    app.include_router(profiles.router)
    app.include_router(projects.router)
    app.include_router(render.router)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    return app
```

- [ ] **Step 7: Run the full backend suite**

```bash
backend/.venv/Scripts/python -m pytest backend/tests -v
```

Expected: all tests pass, `1 deselected` (the gpu test). `test_render.py` contributes `15 passed`.

- [ ] **Step 8: Commit**

```bash
git add backend/voxrox/services/render.py backend/voxrox/routers/render.py backend/voxrox/app.py backend/tests/conftest.py backend/tests/test_render.py && git commit -m "feat(backend): add preview and render orchestration"
```

---

## Task 13: Frontend scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/vitest.setup.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Test: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "voxrox-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.2",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.9",
    "vitest": "^2.1.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd /c/GITHUB/VoxRox/frontend && npm install
```

Expected: `added N packages`.

- [ ] **Step 3: Write `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": "src",
    "paths": { "@/*": ["*"] }
  },
  "include": ["src", "vitest.setup.ts", "vite.config.ts"]
}
```

- [ ] **Step 4: Write `frontend/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: true,
  },
});
```

- [ ] **Step 5: Write `frontend/vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';

// jsdom implements neither of these; the sequencer and window animations need them.
if (!window.HTMLMediaElement.prototype.play) {
  window.HTMLMediaElement.prototype.play = async () => {};
}
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
```

- [ ] **Step 6: Write `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VoxRox</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Write the failing test `frontend/src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the four main menu entries', () => {
    render(<App />);
    for (const label of ['Profiles', 'Chat', 'Script', 'Settings']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('opens on the Profiles screen', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: 'Profiles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/App.test.tsx
```

Expected: FAIL — `Failed to resolve import "./App"`.

- [ ] **Step 9: Write a minimal `frontend/src/App.tsx`**

This is replaced with the real shell in Task 21; it exists now so the scaffold is verifiable.

```tsx
import { useState } from 'react';

const SCREENS = ['Profiles', 'Chat', 'Script', 'Settings'] as const;
export type ScreenName = (typeof SCREENS)[number];

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('Profiles');
  return (
    <div>
      <div role="tablist" aria-label="Main menu">
        {SCREENS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={screen === name}
            onClick={() => setScreen(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <main>{screen}</main>
    </div>
  );
}
```

- [ ] **Step 10: Write `frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/global.css';
import './ui/anim/animations.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

The three CSS imports are created in Task 14. Until then `npm run dev` will fail — that is expected; `vitest` does not load `main.tsx`.

- [ ] **Step 11: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/App.test.tsx
```

Expected: `2 passed`.

- [ ] **Step 12: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html frontend/vitest.setup.ts frontend/src && git commit -m "feat(frontend): scaffold Vite React app with vitest"
```

---

## Task 14: Pixel design tokens, global CSS and the animation kit

Everything visual downstream reads from these three files. The look: 4px logical pixel, hard edges, no anti-aliasing, no border-radius anywhere, all motion quantised with `steps()`.

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/global.css`
- Create: `frontend/src/ui/anim/animations.css`
- Create: `frontend/src/ui/anim/useReducedMotion.ts`
- Test: `frontend/src/ui/anim/useReducedMotion.test.ts`

- [ ] **Step 1: Write `frontend/src/styles/tokens.css`**

```css
:root {
  /* --- grid ------------------------------------------------------- */
  --px: 4px;            /* one logical pixel */
  --grid: 8px;          /* base spacing step  */
  --gap-1: 8px;
  --gap-2: 16px;
  --gap-3: 24px;
  --gap-4: 32px;

  /* --- palette (dark RPG menu) ------------------------------------ */
  --c-void: #07060c;
  --c-ink: #100e1a;
  --c-panel: #1b192b;
  --c-panel-hi: #2b2842;
  --c-panel-lo: #131120;
  --c-line: #eae7f7;
  --c-line-dim: #837fa4;
  --c-shadow: #04030a;

  --c-accent: #f2c14e;
  --c-accent-lo: #a5761f;
  --c-good: #6fe3a1;
  --c-bad: #f2645a;
  --c-cool: #63c7f2;
  --c-magic: #b48cf2;

  /* --- type ------------------------------------------------------- */
  --font-px: 'Press Start 2P', 'VT323', 'Courier New', ui-monospace, monospace;
  --fs-xs: 10px;
  --fs-sm: 12px;
  --fs-md: 14px;
  --fs-lg: 18px;
  --fs-xl: 24px;
  --lh: 1.6;

  /* --- motion ----------------------------------------------------- */
  --dur-fast: 90ms;
  --dur: 160ms;
  --dur-slow: 280ms;
  --step-2: steps(2, end);
  --step-4: steps(4, end);
  --step-6: steps(6, end);

  /* --- borders ---------------------------------------------------- */
  --border-w: var(--px);
  --z-window: 100;
  --z-modal: 200;
  --z-overlay: 900;
}
```

- [ ] **Step 2: Write `frontend/src/styles/global.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  border-radius: 0 !important;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  background: var(--c-void);
  color: var(--c-line);
  font-family: var(--font-px);
  font-size: var(--fs-sm);
  line-height: var(--lh);
  -webkit-font-smoothing: none;
  font-smooth: never;
  text-rendering: optimizeSpeed;
  overflow: hidden;
}

img,
canvas {
  image-rendering: pixelated;
}

button,
input,
textarea,
select {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  outline: none;
}

button {
  cursor: pointer;
}

:focus-visible {
  outline: var(--px) solid var(--c-accent);
  outline-offset: var(--px);
}

::selection {
  background: var(--c-accent);
  color: var(--c-void);
}

/* Chunky pixel scrollbars everywhere. */
* {
  scrollbar-width: none;
}
*::-webkit-scrollbar {
  width: calc(var(--px) * 3);
  height: calc(var(--px) * 3);
}
*::-webkit-scrollbar-track {
  background: var(--c-panel-lo);
}
*::-webkit-scrollbar-thumb {
  background: var(--c-line-dim);
  border: var(--px) solid var(--c-panel-lo);
}
*::-webkit-scrollbar-thumb:hover {
  background: var(--c-accent);
}

/* Full-screen CRT scanlines + vignette. Purely decorative. */
.vx-crt::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  pointer-events: none;
  background:
    repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.22) 0 1px,
      transparent 1px 3px
    ),
    radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.5) 100%);
  mix-blend-mode: multiply;
}

.vx-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--c-void);
}

.vx-screen {
  flex: 1;
  min-height: 0;
  padding: var(--gap-2);
  overflow: hidden;
}

/* Utility: dashed pixel outline used by the outer page frames. */
.vx-dashed {
  border: var(--px) dashed var(--c-line);
}

.vx-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
```

- [ ] **Step 3: Write `frontend/src/ui/anim/animations.css`**

```css
/* Window "unfurl" — the RPG message-box open. */
@keyframes vx-window-open {
  0% {
    transform: scaleX(0.25) scaleY(0.04);
    opacity: 1;
  }
  40% {
    transform: scaleX(1) scaleY(0.12);
  }
  70% {
    transform: scaleX(1) scaleY(0.7);
  }
  100% {
    transform: scaleX(1) scaleY(1);
  }
}

@keyframes vx-window-close {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scaleX(1) scaleY(0.2);
  }
  100% {
    transform: scaleX(0.2) scaleY(0.03);
    opacity: 0;
  }
}

@keyframes vx-panel-slide-in {
  0% {
    transform: translateX(calc(var(--px) * -6));
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes vx-pop-in {
  0% {
    transform: scale(0.6);
  }
  60% {
    transform: scale(1.12);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes vx-blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

@keyframes vx-marquee-dash {
  to {
    background-position: calc(var(--px) * 8) 0;
  }
}

@keyframes vx-pulse-accent {
  0%,
  100% {
    box-shadow: 0 0 0 var(--px) var(--c-accent);
  }
  50% {
    box-shadow: 0 0 0 var(--px) var(--c-accent-lo);
  }
}

.vx-anim-open {
  animation: vx-window-open var(--dur-slow) var(--step-6) both;
  transform-origin: center center;
}
.vx-anim-close {
  animation: vx-window-close var(--dur) var(--step-4) both;
  transform-origin: center center;
}
.vx-anim-slide-in {
  animation: vx-panel-slide-in var(--dur) var(--step-4) both;
}
.vx-anim-pop {
  animation: vx-pop-in var(--dur) var(--step-4) both;
}
.vx-anim-blink {
  animation: vx-blink 1s var(--step-2) infinite;
}
.vx-anim-busy {
  animation: vx-pulse-accent 600ms var(--step-2) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .vx-anim-open,
  .vx-anim-close,
  .vx-anim-slide-in,
  .vx-anim-pop,
  .vx-anim-blink,
  .vx-anim-busy {
    animation: none !important;
  }
}
```

- [ ] **Step 4: Write the failing test `frontend/src/ui/anim/useReducedMotion.test.ts`**

```ts
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from './useReducedMotion';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

describe('useReducedMotion', () => {
  it('returns false when motion is allowed', () => {
    mockMatchMedia(false);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it('returns true when the user prefers reduced motion', () => {
    mockMatchMedia(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/ui/anim/useReducedMotion.test.ts
```

Expected: FAIL — cannot resolve `./useReducedMotion`.

- [ ] **Step 6: Write `frontend/src/ui/anim/useReducedMotion.ts`**

```ts
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const list = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/ui/anim/useReducedMotion.test.ts
```

Expected: `2 passed`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/styles frontend/src/ui && git commit -m "feat(frontend): add pixel design tokens, global CSS and animation kit"
```

---

## Task 15: PixelFrame, PixelPanel and PixelButton

The double-stroke border is produced with layered `box-shadow` rings rather than images, so it stays crisp at any size and needs no assets.

**Files:**
- Create: `frontend/src/ui/primitives/primitives.css`
- Create: `frontend/src/ui/primitives/PixelFrame.tsx`
- Create: `frontend/src/ui/primitives/PixelPanel.tsx`
- Create: `frontend/src/ui/primitives/PixelButton.tsx`
- Test: `frontend/src/ui/primitives/PixelButton.test.tsx`

- [ ] **Step 1: Write `frontend/src/ui/primitives/primitives.css`**

```css
/* ---------- PixelFrame -------------------------------------------- */
.vx-frame {
  position: relative;
  background: var(--c-panel);
  padding: var(--gap-2);
  box-shadow:
    0 0 0 var(--px) var(--c-line),
    0 0 0 calc(var(--px) * 2) var(--c-void);
}
.vx-frame--solid {
  background: var(--c-panel);
}
.vx-frame--sunken {
  background: var(--c-panel-lo);
  box-shadow:
    inset 0 0 0 var(--px) var(--c-line-dim),
    0 0 0 var(--px) var(--c-void);
}
.vx-frame--raised {
  background: var(--c-panel-hi);
  box-shadow:
    0 0 0 var(--px) var(--c-line),
    calc(var(--px) * 2) calc(var(--px) * 2) 0 0 var(--c-shadow),
    0 0 0 calc(var(--px) * 2) var(--c-void);
}
.vx-frame--dashed {
  background: transparent;
  box-shadow: none;
  border: var(--px) dashed var(--c-line);
}
.vx-frame--accent {
  box-shadow:
    0 0 0 var(--px) var(--c-accent),
    0 0 0 calc(var(--px) * 2) var(--c-void);
}
/* Corner notches — the "cut pixel" corners of an RPG menu box. */
.vx-frame--notched::before,
.vx-frame--notched::after {
  content: '';
  position: absolute;
  width: var(--px);
  height: var(--px);
  background: var(--c-void);
}
.vx-frame--notched::before {
  top: 0;
  left: 0;
  box-shadow: calc(100% * 0 + 0px) 0 0 0 var(--c-void);
}
.vx-frame--notched::after {
  bottom: 0;
  right: 0;
}

/* ---------- PixelPanel -------------------------------------------- */
.vx-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.vx-panel__title {
  font-size: var(--fs-xs);
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--c-accent);
  margin-bottom: var(--gap-1);
  padding-bottom: var(--gap-1);
  border-bottom: var(--px) solid var(--c-line-dim);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-1);
}
.vx-panel__body {
  flex: 1;
  min-height: 0;
}

/* ---------- PixelButton ------------------------------------------- */
.vx-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap-1);
  padding: var(--gap-1) var(--gap-2);
  background: var(--c-panel-hi);
  color: var(--c-line);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow:
    0 0 0 var(--px) var(--c-line),
    calc(var(--px) * 1) calc(var(--px) * 1) 0 0 var(--c-shadow);
  transition:
    background var(--dur-fast) var(--step-2),
    color var(--dur-fast) var(--step-2);
}
.vx-btn:hover:not(:disabled) {
  background: var(--c-accent);
  color: var(--c-void);
}
.vx-btn:active:not(:disabled),
.vx-btn[data-pressed='true']:not(:disabled) {
  transform: translate(var(--px), var(--px));
  box-shadow: 0 0 0 var(--px) var(--c-line);
}
.vx-btn:disabled {
  color: var(--c-line-dim);
  background: var(--c-panel-lo);
  box-shadow: 0 0 0 var(--px) var(--c-line-dim);
  cursor: not-allowed;
}
.vx-btn--primary {
  background: var(--c-accent-lo);
  color: var(--c-line);
}
.vx-btn--danger:hover:not(:disabled) {
  background: var(--c-bad);
  color: var(--c-void);
}
.vx-btn--ghost {
  background: transparent;
  box-shadow: 0 0 0 var(--px) var(--c-line-dim);
}
.vx-btn--sm {
  padding: calc(var(--px)) var(--gap-1);
  font-size: var(--fs-xs);
}
.vx-btn--lg {
  padding: var(--gap-2) var(--gap-3);
  font-size: var(--fs-md);
}
.vx-btn--icon {
  padding: var(--gap-1);
  min-width: calc(var(--px) * 9);
}
/* The blinking selector caret an RPG menu puts beside the active item. */
.vx-btn[aria-pressed='true']::before,
.vx-btn[data-selected='true']::before {
  content: '\25B8';
  color: var(--c-accent);
}
```

- [ ] **Step 2: Write `frontend/src/ui/primitives/PixelFrame.tsx`**

```tsx
import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import './primitives.css';

export type FrameVariant = 'solid' | 'sunken' | 'raised' | 'dashed' | 'accent';

export interface PixelFrameProps extends HTMLAttributes<HTMLElement> {
  variant?: FrameVariant;
  notched?: boolean;
  as?: ElementType;
  children?: ReactNode;
  // Callers (RenderedTurn, ChatScreen) attach data-testid / data-active.
  // HTMLAttributes does not cover data-*, so allow it explicitly.
  [key: `data-${string}`]: unknown;
}

export function PixelFrame({
  variant = 'solid',
  notched = false,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}: PixelFrameProps) {
  const classes = [
    'vx-frame',
    `vx-frame--${variant}`,
    notched ? 'vx-frame--notched' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 3: Write `frontend/src/ui/primitives/PixelPanel.tsx`**

```tsx
import type { ReactNode } from 'react';
import { PixelFrame, type FrameVariant } from './PixelFrame';
import './primitives.css';

export interface PixelPanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  variant?: FrameVariant;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

export function PixelPanel({
  title,
  actions,
  variant = 'solid',
  className = '',
  bodyClassName = '',
  children,
}: PixelPanelProps) {
  return (
    <PixelFrame variant={variant} className={`vx-panel ${className}`}>
      {title !== undefined && (
        <div className="vx-panel__title">
          <span>{title}</span>
          {actions && <span>{actions}</span>}
        </div>
      )}
      <div className={`vx-panel__body ${bodyClassName}`}>{children}</div>
    </PixelFrame>
  );
}
```

- [ ] **Step 4: Write the failing test `frontend/src/ui/primitives/PixelButton.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PixelButton } from './PixelButton';

describe('PixelButton', () => {
  it('renders its label and fires onClick', async () => {
    const onClick = vi.fn();
    render(<PixelButton onClick={onClick}>Render</PixelButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Render' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <PixelButton disabled onClick={onClick}>
        Render
      </PixelButton>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Render' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the variant and size classes', () => {
    render(
      <PixelButton variant="danger" size="sm">
        Delete
      </PixelButton>,
    );
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveClass('vx-btn', 'vx-btn--danger', 'vx-btn--sm');
  });

  it('marks itself busy and blocks clicks while busy', async () => {
    const onClick = vi.fn();
    render(
      <PixelButton busy onClick={onClick}>
        Render
      </PixelButton>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('vx-anim-busy');
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('exposes aria-pressed when selected', () => {
    render(<PixelButton selected>Ivy</PixelButton>);
    expect(screen.getByRole('button', { name: 'Ivy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/ui/primitives/PixelButton.test.tsx
```

Expected: FAIL — cannot resolve `./PixelButton`.

- [ ] **Step 6: Write `frontend/src/ui/primitives/PixelButton.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './primitives.css';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface PixelButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
  selected?: boolean;
  children?: ReactNode;
}

export function PixelButton({
  variant = 'default',
  size = 'md',
  busy = false,
  selected = false,
  disabled = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: PixelButtonProps) {
  const classes = [
    'vx-btn',
    variant !== 'default' ? `vx-btn--${variant}` : '',
    size !== 'md' ? `vx-btn--${size}` : '',
    busy ? 'vx-anim-busy' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-pressed={selected ? true : undefined}
      data-selected={selected ? 'true' : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/ui/primitives/PixelButton.test.tsx
```

Expected: `5 passed`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/ui/primitives && git commit -m "feat(frontend): add PixelFrame, PixelPanel and PixelButton primitives"
```

---

## Task 16: PixelWindow and PixelTabs

`PixelWindow` owns the open/close "unfurl" animation and is used for the turn editor and the profile picker. It keeps the element mounted through the close animation so the animation is actually visible.

**Files:**
- Create: `frontend/src/ui/primitives/PixelWindow.tsx`
- Create: `frontend/src/ui/primitives/PixelTabs.tsx`
- Modify: `frontend/src/ui/primitives/primitives.css` (append)
- Test: `frontend/src/ui/primitives/PixelWindow.test.tsx`
- Test: `frontend/src/ui/primitives/PixelTabs.test.tsx`

- [ ] **Step 1: Append to `frontend/src/ui/primitives/primitives.css`**

```css
/* ---------- PixelWindow ------------------------------------------- */
.vx-window {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
}
.vx-window__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-1);
  padding: var(--gap-1) var(--gap-2);
  background: var(--c-line);
  color: var(--c-void);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 2px;
  user-select: none;
}
.vx-window__title {
  display: flex;
  align-items: center;
  gap: var(--gap-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vx-window__close {
  padding: 0 var(--gap-1);
  background: var(--c-void);
  color: var(--c-line);
  box-shadow: 0 0 0 var(--px) var(--c-void);
}
.vx-window__close:hover {
  background: var(--c-bad);
  color: var(--c-void);
}
.vx-window__body {
  flex: 1;
  min-height: 0;
  padding: var(--gap-2);
  overflow: auto;
}
.vx-window__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--gap-1);
  padding: var(--gap-1) var(--gap-2);
  border-top: var(--px) solid var(--c-line-dim);
}
.vx-window-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--gap-3);
  background: rgba(7, 6, 12, 0.82);
}

/* ---------- PixelTabs --------------------------------------------- */
.vx-tabs {
  display: flex;
  align-items: flex-end;
  gap: var(--gap-3);
  padding: var(--gap-1) var(--gap-2) 0;
  border-bottom: calc(var(--px) * 2) solid var(--c-line);
  background: var(--c-void);
}
.vx-tab {
  position: relative;
  padding: var(--gap-1) var(--gap-2);
  background: transparent;
  color: var(--c-line-dim);
  font-size: var(--fs-md);
  text-transform: none;
  letter-spacing: 1px;
  transition: color var(--dur-fast) var(--step-2);
}
.vx-tab:hover {
  color: var(--c-line);
}
.vx-tab[aria-selected='true'] {
  color: var(--c-accent);
}
.vx-tab[aria-selected='true']::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(var(--px) * -2);
  height: calc(var(--px) * 2);
  background: var(--c-accent);
}
.vx-tab:disabled {
  color: var(--c-panel-hi);
  cursor: not-allowed;
}
```

- [ ] **Step 2: Write the failing test `frontend/src/ui/primitives/PixelWindow.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PixelWindow } from './PixelWindow';

describe('PixelWindow', () => {
  it('renders nothing when closed', () => {
    render(
      <PixelWindow open={false} title="Editor">
        body
      </PixelWindow>,
    );
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders title and body when open with the open animation', () => {
    render(
      <PixelWindow open title="Editor">
        body
      </PixelWindow>,
    );
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveClass('vx-anim-open');
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    render(
      <PixelWindow open title="Editor" onClose={onClose}>
        body
      </PixelWindow>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close Editor' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn();
    render(
      <PixelWindow open title="Editor" onClose={onClose}>
        body
      </PixelWindow>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a backdrop only in modal mode', () => {
    const { rerender, container } = render(
      <PixelWindow open title="Picker" modal>
        body
      </PixelWindow>,
    );
    expect(container.querySelector('.vx-window-backdrop')).toBeTruthy();
    rerender(
      <PixelWindow open title="Picker">
        body
      </PixelWindow>,
    );
    expect(container.querySelector('.vx-window-backdrop')).toBeFalsy();
  });

  it('renders footer content when provided', () => {
    render(
      <PixelWindow open title="Editor" footer={<span>foot</span>}>
        body
      </PixelWindow>,
    );
    expect(screen.getByText('foot')).toBeInTheDocument();
  });

  it('omits the close button when onClose is absent', () => {
    render(
      <PixelWindow open title="Editor">
        body
      </PixelWindow>,
    );
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/ui/primitives/PixelWindow.test.tsx
```

Expected: FAIL — cannot resolve `./PixelWindow`.

- [ ] **Step 4: Write `frontend/src/ui/primitives/PixelWindow.tsx`**

```tsx
import { useEffect, type ReactNode } from 'react';
import { PixelFrame } from './PixelFrame';
import './primitives.css';

export interface PixelWindowProps {
  open: boolean;
  title: ReactNode;
  onClose?: () => void;
  modal?: boolean;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

export function PixelWindow({
  open,
  title,
  onClose,
  modal = false,
  footer,
  className = '',
  bodyClassName = '',
  children,
}: PixelWindowProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const titleText = typeof title === 'string' ? title : 'window';

  const windowEl = (
    <PixelFrame
      variant="raised"
      role="dialog"
      aria-modal={modal || undefined}
      aria-label={titleText}
      className={`vx-window vx-anim-open ${className}`}
    >
      <div className="vx-window__bar">
        <span className="vx-window__title">{title}</span>
        {onClose && (
          <button
            type="button"
            className="vx-btn vx-btn--sm vx-window__close"
            aria-label={`Close ${titleText}`}
            onClick={onClose}
          >
            X
          </button>
        )}
      </div>
      <div className={`vx-window__body ${bodyClassName}`}>{children}</div>
      {footer && <div className="vx-window__footer">{footer}</div>}
    </PixelFrame>
  );

  if (!modal) return windowEl;
  return (
    <div
      className="vx-window-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      {windowEl}
    </div>
  );
}
```

- [ ] **Step 5: Write the failing test `frontend/src/ui/primitives/PixelTabs.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PixelTabs } from './PixelTabs';

const ITEMS = [
  { id: 'a', label: 'Profiles' },
  { id: 'b', label: 'Chat' },
  { id: 'c', label: 'Script', disabled: true },
];

describe('PixelTabs', () => {
  it('marks the active tab as selected', () => {
    render(<PixelTabs items={ITEMS} value="b" onChange={() => {}} label="Main menu" />);
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Profiles' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('calls onChange with the clicked id', async () => {
    const onChange = vi.fn();
    render(<PixelTabs items={ITEMS} value="a" onChange={onChange} label="Main menu" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not call onChange for a disabled tab', async () => {
    const onChange = vi.fn();
    render(<PixelTabs items={ITEMS} value="a" onChange={onChange} label="Main menu" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Script' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves selection with the arrow keys, skipping disabled tabs', async () => {
    const onChange = vi.fn();
    render(<PixelTabs items={ITEMS} value="b" onChange={onChange} label="Main menu" />);
    screen.getByRole('tab', { name: 'Chat' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('labels the tablist', () => {
    render(<PixelTabs items={ITEMS} value="a" onChange={() => {}} label="Main menu" />);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Main menu');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/ui/primitives/PixelTabs.test.tsx
```

Expected: FAIL — cannot resolve `./PixelTabs`.

- [ ] **Step 7: Write `frontend/src/ui/primitives/PixelTabs.tsx`**

```tsx
import type { ReactNode } from 'react';
import './primitives.css';

export interface TabItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface PixelTabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}

export function PixelTabs({
  items,
  value,
  onChange,
  label,
  className = '',
}: PixelTabsProps) {
  const enabled = items.filter((item) => !item.disabled);

  const step = (direction: 1 | -1) => {
    if (enabled.length === 0) return;
    const current = enabled.findIndex((item) => item.id === value);
    const next = (current + direction + enabled.length) % enabled.length;
    onChange(enabled[next].id);
  };

  return (
    <div role="tablist" aria-label={label} className={`vx-tabs ${className}`}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className="vx-btn vx-tab"
          aria-selected={item.id === value}
          disabled={item.disabled}
          tabIndex={item.id === value ? 0 : -1}
          onClick={() => !item.disabled && onChange(item.id)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              step(1);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              step(-1);
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

Note on the arrow-key test: `enabled` is `[Profiles, Chat]`, current index for `b` is 1, so `ArrowRight` wraps to index 0 → `'a'`. That is the asserted behaviour.

- [ ] **Step 8: Run both tests to verify they pass**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/ui/primitives
```

Expected: `17 passed` (5 button + 7 window + 5 tabs).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/ui/primitives && git commit -m "feat(frontend): add PixelWindow and PixelTabs primitives"
```

---

## Task 17: PixelSlider, PixelStepSlider, PixelTextArea, PixelScrollArea

`PixelSlider` is continuous (speed, volume, delay). `PixelStepSlider` is the notched selector used for the age/pitch/emotion scales — it takes an array of labels and reports the chosen index. `PixelTextArea` is the auto-expanding editor from the mockup: it grows with content and starts scrolling only past `maxRows`.

**Files:**
- Create: `frontend/src/ui/primitives/PixelSlider.tsx`
- Create: `frontend/src/ui/primitives/PixelStepSlider.tsx`
- Create: `frontend/src/ui/primitives/PixelTextArea.tsx`
- Create: `frontend/src/ui/primitives/PixelScrollArea.tsx`
- Modify: `frontend/src/ui/primitives/primitives.css` (append)
- Test: `frontend/src/ui/primitives/PixelSlider.test.tsx`
- Test: `frontend/src/ui/primitives/PixelStepSlider.test.tsx`
- Test: `frontend/src/ui/primitives/PixelTextArea.test.tsx`

- [ ] **Step 1: Append to `frontend/src/ui/primitives/primitives.css`**

```css
/* ---------- Sliders ------------------------------------------------ */
.vx-slider {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--gap-1);
  padding: calc(var(--px)) 0;
}
.vx-slider__label {
  grid-column: 1 / -1;
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--c-line-dim);
  display: flex;
  justify-content: space-between;
  gap: var(--gap-1);
}
.vx-slider__value {
  color: var(--c-accent);
}
.vx-slider__input {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: calc(var(--px) * 4);
  background: var(--c-panel-lo);
  box-shadow: inset 0 0 0 var(--px) var(--c-line-dim);
  cursor: pointer;
}
.vx-slider__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: calc(var(--px) * 3);
  height: calc(var(--px) * 6);
  background: var(--c-accent);
  box-shadow: 0 0 0 var(--px) var(--c-void);
}
.vx-slider__input::-moz-range-thumb {
  border: none;
  width: calc(var(--px) * 3);
  height: calc(var(--px) * 6);
  background: var(--c-accent);
  box-shadow: 0 0 0 var(--px) var(--c-void);
}
.vx-slider__input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.vx-slider__notches {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  color: var(--c-line-dim);
  letter-spacing: 0;
}
.vx-slider__notch[data-active='true'] {
  color: var(--c-accent);
}

/* ---------- Text area ---------------------------------------------- */
.vx-textarea {
  display: block;
  width: 100%;
  padding: var(--gap-1);
  background: var(--c-panel-lo);
  color: var(--c-line);
  font-family: var(--font-px);
  font-size: var(--fs-sm);
  line-height: var(--lh);
  resize: none;
  overflow-y: auto;
  box-shadow: inset 0 0 0 var(--px) var(--c-line-dim);
}
.vx-textarea:focus {
  box-shadow: inset 0 0 0 var(--px) var(--c-accent);
}
.vx-textarea::placeholder {
  color: var(--c-panel-hi);
}

/* ---------- Scroll area -------------------------------------------- */
.vx-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  scrollbar-width: thin;
}
.vx-scroll--x {
  overflow-x: auto;
}
```

- [ ] **Step 2: Write the failing test `frontend/src/ui/primitives/PixelSlider.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { PixelSlider } from './PixelSlider';

describe('PixelSlider', () => {
  it('renders the label and formatted value', () => {
    render(
      <PixelSlider
        label="Speed"
        min={0.5}
        max={2}
        step={0.05}
        value={1.25}
        onChange={() => {}}
        format={(v) => `${v.toFixed(2)}x`}
      />,
    );
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('1.25x')).toBeInTheDocument();
  });

  it('reports numeric changes', () => {
    const onChange = vi.fn();
    render(
      <PixelSlider label="Speed" min={0.5} max={2} step={0.05} value={1} onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenCalledWith(1.5);
  });

  it('exposes range attributes for assistive tech', () => {
    render(
      <PixelSlider label="Delay" min={0} max={5000} step={50} value={300} onChange={() => {}} />,
    );
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '5000');
    expect(slider).toHaveAttribute('step', '50');
    expect(slider).toHaveValue('300');
  });

  it('can be disabled', () => {
    render(
      <PixelSlider label="Speed" min={0} max={2} step={0.1} value={1} onChange={() => {}} disabled />,
    );
    expect(screen.getByRole('slider')).toBeDisabled();
  });
});
```

- [ ] **Step 3: Write the failing test `frontend/src/ui/primitives/PixelStepSlider.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { PixelStepSlider } from './PixelStepSlider';

const AGES = ['—', 'child', 'teenage', 'young adult', 'middle-aged', 'elderly'];

describe('PixelStepSlider', () => {
  it('shows the label and the option at the current index', () => {
    render(
      <PixelStepSlider label="Age" options={AGES} index={3} onChange={() => {}} />,
    );
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('young adult')).toBeInTheDocument();
  });

  it('reports the new index as a number', () => {
    const onChange = vi.fn();
    render(<PixelStepSlider label="Age" options={AGES} index={0} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('sets max to the last option index', () => {
    render(<PixelStepSlider label="Age" options={AGES} index={0} onChange={() => {}} />);
    expect(screen.getByRole('slider')).toHaveAttribute('max', '5');
  });

  it('marks the active notch', () => {
    render(<PixelStepSlider label="Age" options={AGES} index={2} onChange={() => {}} />);
    const notches = screen.getAllByTestId('notch');
    expect(notches[2]).toHaveAttribute('data-active', 'true');
    expect(notches[0]).toHaveAttribute('data-active', 'false');
  });

  it('clamps an out-of-range index into the array', () => {
    render(<PixelStepSlider label="Age" options={AGES} index={99} onChange={() => {}} />);
    expect(screen.getByText('elderly')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Write the failing test `frontend/src/ui/primitives/PixelTextArea.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PixelTextArea } from './PixelTextArea';

describe('PixelTextArea', () => {
  it('renders its value and reports edits', async () => {
    const onChange = vi.fn();
    render(<PixelTextArea value="" onChange={onChange} aria-label="Turn text" />);
    await userEvent.type(screen.getByLabelText('Turn text'), 'Hi');
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0]).toBe('H');
  });

  it('applies min and max row bounds as inline heights', () => {
    render(
      <PixelTextArea value="" onChange={() => {}} minRows={3} maxRows={10} aria-label="Turn text" />,
    );
    const area = screen.getByLabelText('Turn text');
    expect(area.style.minHeight).not.toBe('');
    expect(area.style.maxHeight).not.toBe('');
  });

  it('forwards a ref to the underlying textarea', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<PixelTextArea ref={ref} value="x" onChange={() => {}} aria-label="Turn text" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(ref.current!.value).toBe('x');
  });

  it('shows the placeholder when empty', () => {
    render(
      <PixelTextArea value="" onChange={() => {}} placeholder="Speak..." aria-label="Turn text" />,
    );
    expect(screen.getByPlaceholderText('Speak...')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the three tests to verify they fail**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/ui/primitives/PixelSlider.test.tsx src/ui/primitives/PixelStepSlider.test.tsx src/ui/primitives/PixelTextArea.test.tsx
```

Expected: FAIL — three unresolved imports.

- [ ] **Step 6: Write `frontend/src/ui/primitives/PixelSlider.tsx`**

```tsx
import { useId } from 'react';
import './primitives.css';

export interface PixelSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

export function PixelSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format = (v) => String(v),
  disabled = false,
  className = '',
}: PixelSliderProps) {
  const id = useId();
  return (
    <div className={`vx-slider ${className}`}>
      <label className="vx-slider__label" htmlFor={id}>
        <span>{label}</span>
        <span className="vx-slider__value">{format(value)}</span>
      </label>
      <input
        id={id}
        className="vx-slider__input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ gridColumn: '1 / -1' }}
      />
    </div>
  );
}
```

- [ ] **Step 7: Write `frontend/src/ui/primitives/PixelStepSlider.tsx`**

```tsx
import { useId } from 'react';
import './primitives.css';

export interface PixelStepSliderProps {
  label: string;
  options: string[];
  index: number;
  onChange: (index: number) => void;
  showNotches?: boolean;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
}

export function PixelStepSlider({
  label,
  options,
  index,
  onChange,
  showNotches = true,
  disabled = false,
  className = '',
  emptyLabel = '—',
}: PixelStepSliderProps) {
  const id = useId();
  const last = Math.max(options.length - 1, 0);
  const safeIndex = Math.min(Math.max(index, 0), last);
  const current = options[safeIndex] || emptyLabel;

  return (
    <div className={`vx-slider ${className}`}>
      <label className="vx-slider__label" htmlFor={id}>
        <span>{label}</span>
        <span className="vx-slider__value">{current}</span>
      </label>
      <input
        id={id}
        className="vx-slider__input"
        type="range"
        min={0}
        max={last}
        step={1}
        value={safeIndex}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ gridColumn: '1 / -1' }}
      />
      {showNotches && (
        <div className="vx-slider__notches">
          {options.map((option, position) => (
            <span
              key={`${option}-${position}`}
              className="vx-slider__notch"
              data-testid="notch"
              data-active={position === safeIndex ? 'true' : 'false'}
            >
              |
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Write `frontend/src/ui/primitives/PixelTextArea.tsx`**

```tsx
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type TextareaHTMLAttributes,
} from 'react';
import './primitives.css';

const LINE_HEIGHT_PX = 19; // 12px font * 1.6 line-height, rounded
const VERTICAL_PADDING_PX = 16;

export interface PixelTextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  maxRows?: number;
}

export const PixelTextArea = forwardRef<HTMLTextAreaElement, PixelTextAreaProps>(
  function PixelTextArea(
    { value, onChange, minRows = 3, maxRows = 18, className = '', ...rest },
    ref,
  ) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement, []);

    const resize = useCallback(() => {
      const node = inner.current;
      if (!node) return;
      node.style.height = 'auto';
      const max = maxRows * LINE_HEIGHT_PX + VERTICAL_PADDING_PX;
      node.style.height = `${Math.min(node.scrollHeight, max)}px`;
    }, [maxRows]);

    useEffect(resize, [value, resize]);

    return (
      <textarea
        ref={inner}
        className={`vx-textarea ${className}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          minHeight: `${minRows * LINE_HEIGHT_PX + VERTICAL_PADDING_PX}px`,
          maxHeight: `${maxRows * LINE_HEIGHT_PX + VERTICAL_PADDING_PX}px`,
        }}
        {...rest}
      />
    );
  },
);
```

- [ ] **Step 9: Write `frontend/src/ui/primitives/PixelScrollArea.tsx`**

```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import './primitives.css';

export interface PixelScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  horizontal?: boolean;
  children?: ReactNode;
}

export function PixelScrollArea({
  horizontal = false,
  className = '',
  children,
  ...rest
}: PixelScrollAreaProps) {
  return (
    <div
      className={`vx-scroll ${horizontal ? 'vx-scroll--x' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 10: Run the primitive suite to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/ui/primitives
```

Expected: `30 passed` (17 from Tasks 15–16 plus 4 slider + 5 step-slider + 4 text-area).

- [ ] **Step 11: Commit**

```bash
git add frontend/src/ui/primitives && git commit -m "feat(frontend): add slider, text area and scroll primitives"
```

---

## Task 18: PixelTransport audio player

One transport component serves the preview panel, every rendered turn in the chat log, and the profile archive rows.

**Files:**
- Create: `frontend/src/ui/primitives/PixelTransport.tsx`
- Create: `frontend/src/lib/formatTime.ts`
- Modify: `frontend/src/ui/primitives/primitives.css` (append)
- Test: `frontend/src/lib/formatTime.test.ts`
- Test: `frontend/src/ui/primitives/PixelTransport.test.tsx`

- [ ] **Step 1: Append to `frontend/src/ui/primitives/primitives.css`**

```css
/* ---------- Transport ---------------------------------------------- */
.vx-transport {
  display: flex;
  align-items: center;
  gap: var(--gap-1);
  padding: calc(var(--px)) var(--gap-1);
  background: var(--c-panel-lo);
  box-shadow: inset 0 0 0 var(--px) var(--c-line-dim);
}
.vx-transport__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-xs);
  color: var(--c-line-dim);
}
.vx-transport__bar {
  flex: 2;
  height: calc(var(--px) * 3);
  background: var(--c-void);
  box-shadow: inset 0 0 0 var(--px) var(--c-line-dim);
  cursor: pointer;
  position: relative;
}
.vx-transport__fill {
  height: 100%;
  background: var(--c-accent);
  transition: width var(--dur-fast) var(--step-4);
}
.vx-transport__time {
  font-size: var(--fs-xs);
  color: var(--c-accent);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.vx-transport--empty {
  color: var(--c-panel-hi);
}
```

- [ ] **Step 2: Write the failing test `frontend/src/lib/formatTime.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatTime } from './formatTime';

describe('formatTime', () => {
  it('formats sub-minute durations', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(7.4)).toBe('0:07');
    expect(formatTime(59.9)).toBe('0:59');
  });

  it('formats minutes', () => {
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(125)).toBe('2:05');
  });

  it('treats invalid input as zero', () => {
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});
```

- [ ] **Step 3: Write `frontend/src/lib/formatTime.ts`**

```ts
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.floor(safe);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Write the failing test `frontend/src/ui/primitives/PixelTransport.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { PixelTransport } from './PixelTransport';

describe('PixelTransport', () => {
  it('shows the placeholder and disables play when there is no source', () => {
    render(<PixelTransport src={null} name="no audio yet" />);
    expect(screen.getByText('no audio yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('renders a play button and an audio element for a source', () => {
    const { container } = render(<PixelTransport src="/media/a.wav" name="a.wav" />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(container.querySelector('audio')).toHaveAttribute('src', '/media/a.wav');
  });

  it('calls play on the audio element and swaps to Pause', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.play = play;
    render(<PixelTransport src="/media/a.wav" name="a.wav" />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(play).toHaveBeenCalled();
    const audio = document.querySelector('audio')!;
    fireEvent.play(audio);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('shows current and total time', () => {
    render(<PixelTransport src="/media/a.wav" name="a.wav" durationSec={65} />);
    expect(screen.getByText('0:00 / 1:05')).toBeInTheDocument();
  });

  it('updates elapsed time on timeupdate', () => {
    render(<PixelTransport src="/media/a.wav" name="a.wav" durationSec={65} />);
    const audio = document.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'currentTime', { value: 12, configurable: true });
    fireEvent.timeUpdate(audio);
    expect(screen.getByText('0:12 / 1:05')).toBeInTheDocument();
  });

  it('resets to Play when playback ends', () => {
    render(<PixelTransport src="/media/a.wav" name="a.wav" />);
    const audio = document.querySelector('audio') as HTMLAudioElement;
    fireEvent.play(audio);
    fireEvent.ended(audio);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('stop rewinds and pauses', () => {
    render(<PixelTransport src="/media/a.wav" name="a.wav" />);
    const audio = document.querySelector('audio') as HTMLAudioElement;
    audio.currentTime = 5;
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(audio.currentTime).toBe(0);
  });

  it('offers a download link when downloadable', () => {
    render(<PixelTransport src="/media/a.wav" name="a.wav" downloadable />);
    expect(screen.getByRole('link', { name: 'Download a.wav' })).toHaveAttribute(
      'href',
      '/media/a.wav',
    );
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/lib/formatTime.test.ts src/ui/primitives/PixelTransport.test.tsx
```

Expected: FAIL — unresolved imports.

- [ ] **Step 6: Write `frontend/src/ui/primitives/PixelTransport.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/lib/formatTime';
import { PixelButton } from './PixelButton';
import './primitives.css';

export interface PixelTransportProps {
  src: string | null;
  name: string;
  durationSec?: number;
  downloadable?: boolean;
  volume?: number;
  className?: string;
}

export function PixelTransport({
  src,
  name,
  durationSec = 0,
  downloadable = false,
  volume = 1,
  className = '',
}: PixelTransportProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(durationSec);

  useEffect(() => setTotal(durationSec), [durationSec]);
  useEffect(() => {
    setPlaying(false);
    setElapsed(0);
  }, [src]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setElapsed(0);
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !total) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / (rect.width || 1);
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * total;
    setElapsed(audio.currentTime);
  };

  const progress = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;

  return (
    <div className={`vx-transport ${src ? '' : 'vx-transport--empty'} ${className}`}>
      <span className="vx-transport__name">{name}</span>
      <div
        className="vx-transport__bar"
        role="presentation"
        onClick={seek}
        title="Seek"
      >
        <div className="vx-transport__fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="vx-transport__time">
        {formatTime(elapsed)} / {formatTime(total)}
      </span>
      <PixelButton size="sm" onClick={toggle} disabled={!src}>
        {playing ? 'Pause' : 'Play'}
      </PixelButton>
      <PixelButton size="sm" variant="ghost" onClick={stop} disabled={!src}>
        Stop
      </PixelButton>
      {downloadable && src && (
        <a
          className="vx-btn vx-btn--sm vx-btn--ghost"
          href={src}
          download={name}
          aria-label={`Download ${name}`}
        >
          Save
        </a>
      )}
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setElapsed(0);
          }}
          onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setTotal(value);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/lib src/ui/primitives/PixelTransport.test.tsx
```

Expected: `11 passed` (3 formatTime + 8 transport).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib frontend/src/ui/primitives && git commit -m "feat(frontend): add PixelTransport audio player"
```

---

## Task 19: API types and client

`client.ts` is the only module in the app that calls `fetch`.

**Files:**
- Create: `frontend/src/api/types.ts`
- Create: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts`

- [ ] **Step 1: Write `frontend/src/api/types.ts`**

```ts
export type VoiceMode = 'auto' | 'clone' | 'design';
export type TurnStatus = 'draft' | 'rendered';
export type SequencerMode = 'sequential' | 'simultaneous';

export interface GenerationParams {
  numStep: number;
  speed: number;
  duration: number | null;
}

export interface VoiceDesign {
  gender: string;
  age: string;
  pitch: string;
  style: string;
  accent: string;
  dialect: string;
  mood: string;
  intensity: number;
  extra: string[];
}

export interface VoiceSample {
  id: string;
  filename: string;
  url: string;
  transcript: string;
  durationSec: number;
  addedAt: string;
}

export interface ProfileCard {
  shortName: string;
  tagline: string;
  accentColor: string;
}

export interface Narrative {
  description: string;
  background: string;
}

export interface ArchiveEntry {
  id: string;
  projectId: string;
  projectName: string;
  turnId: string;
  text: string;
  url: string;
  durationSec: number;
  createdAt: string;
}

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  portraitUrl: string | null;
  card: ProfileCard;
  voiceMode: VoiceMode;
  voice: VoiceDesign;
  params: GenerationParams;
  samples: VoiceSample[];
  activeSampleId: string | null;
  narrative: Narrative;
  customTags: string[];
  archive: ArchiveEntry[];
}

export interface TurnAudio {
  url: string;
  filename: string;
  durationSec: number;
  sampleRate: number;
  renderedAt: string;
}

export interface Turn {
  id: string;
  profileId: string;
  text: string;
  params: GenerationParams;
  voiceOverride: VoiceDesign | null;
  status: TurnStatus;
  audio: TurnAudio | null;
  createdAt: string;
  updatedAt: string;
}

export interface SequencerSettings {
  mode: SequencerMode;
  delayMs: number;
  staggerMs: number;
  loop: boolean;
  volume: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  participantIds: string[];
  turns: Turn[];
  sequencer: SequencerSettings;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
  renderedCount: number;
  participantIds: string[];
}

export interface Tag {
  token: string;
  label: string;
  description: string;
  hotkey: string;
}

export interface TagGroup {
  id: string;
  label: string;
  tags: Tag[];
}

export interface VoiceVocab {
  genders: string[];
  ages: string[];
  pitches: string[];
  styles: string[];
  accents: string[];
  dialects: string[];
  moods: string[];
  intensities: string[];
}

export interface EngineStatus {
  model: string;
  device: string;
  dtype: string;
  loaded: boolean;
  error: string | null;
  capabilities: string[];
}

export interface PreviewResult {
  url: string;
  durationSec: number;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
```

- [ ] **Step 2: Write the failing test `frontend/src/api/client.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './client';

function mockFetch(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  const spy = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('lists profiles with a GET', async () => {
    const spy = mockFetch([{ id: 'p1' }]);
    await expect(api.listProfiles()).resolves.toEqual([{ id: 'p1' }]);
    expect(spy.mock.calls[0][0]).toBe('/api/profiles');
    expect(spy.mock.calls[0][1].method).toBe('GET');
  });

  it('creates a profile with a JSON body', async () => {
    const spy = mockFetch({ id: 'p1', name: 'Ivy' });
    await api.createProfile('Ivy');
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/profiles');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ name: 'Ivy' });
  });

  it('patches a profile', async () => {
    const spy = mockFetch({ id: 'p1' });
    await api.updateProfile('p1', { voiceMode: 'design' });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/profiles/p1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ voiceMode: 'design' });
  });

  it('throws ApiError carrying the server detail', async () => {
    mockFetch({ detail: 'unknown tags: [wobble]' }, { status: 422 });
    await expect(api.createPreview({ profileId: 'p1', text: 'x' })).rejects.toThrow(
      ApiError,
    );
    await expect(
      api.createPreview({ profileId: 'p1', text: 'x' }),
    ).rejects.toThrow('unknown tags: [wobble]');
  });

  it('sends uploads as multipart without a JSON content type', async () => {
    const spy = mockFetch({ id: 'p1' });
    const file = new File(['x'], 'ref.wav', { type: 'audio/wav' });
    await api.uploadSample('p1', file, 'line');
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/profiles/p1/samples');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers?.['Content-Type']).toBeUndefined();
  });

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null }),
    );
    await expect(api.deleteProfile('p1')).resolves.toBeUndefined();
  });

  it('renders a turn at the nested route', async () => {
    const spy = mockFetch({ id: 'proj1' });
    await api.renderTurn('proj1', 't1');
    expect(spy.mock.calls[0][0]).toBe('/api/projects/proj1/turns/t1/render');
    expect(spy.mock.calls[0][1].method).toBe('POST');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/api/client.test.ts
```

Expected: FAIL — cannot resolve `./client`.

- [ ] **Step 4: Write `frontend/src/api/client.ts`**

```ts
import type {
  ArchiveEntry,
  DeepPartial,
  EngineStatus,
  GenerationParams,
  PreviewResult,
  Profile,
  Project,
  ProjectSummary,
  SequencerSettings,
  TagGroup,
  VoiceDesign,
  VoiceVocab,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const method = init.method ?? 'GET';
  const options: Record<string, unknown> = { method };
  if (init.form) {
    options.body = init.form;
  } else if (init.body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(init.body);
  }

  const response = await fetch(path, options as RequestInit);
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    let detail = `request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.detail === 'string') detail = payload.detail;
      else if (payload) detail = JSON.stringify(payload.detail ?? payload);
    } catch {
      /* keep the default message */
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export const api = {
  // vocabulary + engine
  getTags: () => request<{ groups: TagGroup[] }>('/api/tags'),
  getVoiceVocab: () => request<VoiceVocab>('/api/voice-vocab'),
  getEngineStatus: () => request<EngineStatus>('/api/engine/status'),
  warmUpEngine: () => request<EngineStatus>('/api/engine/warmup', { method: 'POST' }),

  // profiles
  listProfiles: () => request<Profile[]>('/api/profiles'),
  getProfile: (id: string) => request<Profile>(`/api/profiles/${id}`),
  createProfile: (name: string) =>
    request<Profile>('/api/profiles', { method: 'POST', body: { name } }),
  updateProfile: (id: string, patch: DeepPartial<Profile>) =>
    request<Profile>(`/api/profiles/${id}`, { method: 'PATCH', body: patch }),
  deleteProfile: (id: string) =>
    request<void>(`/api/profiles/${id}`, { method: 'DELETE' }),
  getInstruct: (id: string) =>
    request<{ instruct: string }>(`/api/profiles/${id}/instruct`),

  uploadPortrait: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<Profile>(`/api/profiles/${id}/portrait`, { method: 'POST', form });
  },
  uploadSample: (id: string, file: File, transcript = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('transcript', transcript);
    return request<Profile>(`/api/profiles/${id}/samples`, { method: 'POST', form });
  },
  deleteSample: (id: string, sampleId: string) =>
    request<Profile>(`/api/profiles/${id}/samples/${sampleId}`, { method: 'DELETE' }),
  activateSample: (id: string, sampleId: string) =>
    request<Profile>(`/api/profiles/${id}/samples/${sampleId}/activate`, {
      method: 'POST',
    }),

  // projects
  listProjects: () => request<ProjectSummary[]>('/api/projects'),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (name: string) =>
    request<Project>('/api/projects', { method: 'POST', body: { name } }),
  updateProject: (
    id: string,
    patch: { name?: string; sequencer?: Partial<SequencerSettings> },
  ) => request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: patch }),
  deleteProject: (id: string) =>
    request<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  // turns
  addTurn: (projectId: string, profileId: string, text = '') =>
    request<Project>(`/api/projects/${projectId}/turns`, {
      method: 'POST',
      body: { profileId, text },
    }),
  updateTurn: (
    projectId: string,
    turnId: string,
    patch: {
      text?: string;
      params?: Partial<GenerationParams>;
      voiceOverride?: VoiceDesign | null;
    },
  ) =>
    request<Project>(`/api/projects/${projectId}/turns/${turnId}`, {
      method: 'PATCH',
      body: patch,
    }),
  deleteTurn: (projectId: string, turnId: string) =>
    request<Project>(`/api/projects/${projectId}/turns/${turnId}`, {
      method: 'DELETE',
    }),
  reorderTurns: (projectId: string, turnIds: string[]) =>
    request<Project>(`/api/projects/${projectId}/reorder`, {
      method: 'POST',
      body: { turnIds },
    }),
  renderTurn: (projectId: string, turnId: string) =>
    request<Project>(`/api/projects/${projectId}/turns/${turnId}/render`, {
      method: 'POST',
    }),

  // synthesis
  createPreview: (body: {
    profileId: string;
    text: string;
    params?: GenerationParams;
    voiceOverride?: VoiceDesign | null;
  }) => request<PreviewResult>('/api/preview', { method: 'POST', body }),
};

export type { ArchiveEntry };
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/api/client.test.ts
```

Expected: `7 passed`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api && git commit -m "feat(frontend): add typed API client"
```

---

## Task 20: State stores

**Files:**
- Create: `frontend/src/state/vocabStore.ts`
- Create: `frontend/src/state/profileStore.ts`
- Create: `frontend/src/state/projectStore.ts`
- Test: `frontend/src/state/profileStore.test.ts`
- Test: `frontend/src/state/projectStore.test.ts`

- [ ] **Step 1: Write the failing test `frontend/src/state/profileStore.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Profile } from '@/api/types';
import { useProfileStore } from './profileStore';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    name: 'Ivy',
    createdAt: '2026-08-10T00:00:00+00:00',
    updatedAt: '2026-08-10T00:00:00+00:00',
    portraitUrl: null,
    card: { shortName: 'Ivy', tagline: '', accentColor: '#f2c14e' },
    voiceMode: 'auto',
    voice: {
      gender: '', age: '', pitch: '', style: '', accent: '',
      dialect: '', mood: '', intensity: 2, extra: [],
    },
    params: { numStep: 32, speed: 1, duration: null },
    samples: [],
    activeSampleId: null,
    narrative: { description: '', background: '' },
    customTags: [],
    archive: [],
    ...overrides,
  };
}

beforeEach(() => {
  useProfileStore.setState({
    profiles: [], selectedId: null, loading: false, error: null,
  });
  vi.restoreAllMocks();
});

describe('profileStore', () => {
  it('loads profiles and clears loading', async () => {
    vi.spyOn(api, 'listProfiles').mockResolvedValue([makeProfile()]);
    await useProfileStore.getState().load();
    expect(useProfileStore.getState().profiles).toHaveLength(1);
    expect(useProfileStore.getState().loading).toBe(false);
    expect(useProfileStore.getState().error).toBeNull();
  });

  it('records an error message when loading fails', async () => {
    vi.spyOn(api, 'listProfiles').mockRejectedValue(new Error('offline'));
    await useProfileStore.getState().load();
    expect(useProfileStore.getState().error).toBe('offline');
    expect(useProfileStore.getState().loading).toBe(false);
  });

  it('creates a profile, appends it and selects it', async () => {
    vi.spyOn(api, 'createProfile').mockResolvedValue(makeProfile({ id: 'p2', name: 'Rook' }));
    await useProfileStore.getState().create('Rook');
    const state = useProfileStore.getState();
    expect(state.profiles.map((p) => p.id)).toEqual(['p2']);
    expect(state.selectedId).toBe('p2');
  });

  it('replaces the stored profile after an update', async () => {
    useProfileStore.setState({ profiles: [makeProfile()] });
    vi.spyOn(api, 'updateProfile').mockResolvedValue(
      makeProfile({ voiceMode: 'design' }),
    );
    await useProfileStore.getState().update('p1', { voiceMode: 'design' });
    expect(useProfileStore.getState().profiles[0].voiceMode).toBe('design');
  });

  it('removes a deleted profile and clears the selection', async () => {
    useProfileStore.setState({ profiles: [makeProfile()], selectedId: 'p1' });
    vi.spyOn(api, 'deleteProfile').mockResolvedValue(undefined);
    await useProfileStore.getState().remove('p1');
    const state = useProfileStore.getState();
    expect(state.profiles).toEqual([]);
    expect(state.selectedId).toBeNull();
  });

  it('byId resolves a profile or undefined', () => {
    useProfileStore.setState({ profiles: [makeProfile()] });
    expect(useProfileStore.getState().byId('p1')?.name).toBe('Ivy');
    expect(useProfileStore.getState().byId('nope')).toBeUndefined();
  });

  it('applies a server profile returned by an upload', () => {
    useProfileStore.setState({ profiles: [makeProfile()] });
    useProfileStore.getState().applyProfile(makeProfile({ portraitUrl: '/media/x.png' }));
    expect(useProfileStore.getState().profiles[0].portraitUrl).toBe('/media/x.png');
  });
});
```

- [ ] **Step 2: Write the failing test `frontend/src/state/projectStore.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Project } from '@/api/types';
import { useProjectStore } from './projectStore';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj1',
    name: 'Scene 1',
    createdAt: '2026-08-10T00:00:00+00:00',
    updatedAt: '2026-08-10T00:00:00+00:00',
    participantIds: [],
    turns: [],
    sequencer: { mode: 'sequential', delayMs: 300, staggerMs: 0, loop: false, volume: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  useProjectStore.setState({
    summaries: [], current: null, loading: false, error: null, renderingTurnId: null,
  });
  vi.restoreAllMocks();
});

describe('projectStore', () => {
  it('opens a project and stores it as current', async () => {
    vi.spyOn(api, 'getProject').mockResolvedValue(makeProject());
    await useProjectStore.getState().open('proj1');
    expect(useProjectStore.getState().current?.id).toBe('proj1');
  });

  it('creates a project, refreshes summaries and opens it', async () => {
    vi.spyOn(api, 'createProject').mockResolvedValue(makeProject());
    vi.spyOn(api, 'listProjects').mockResolvedValue([
      { id: 'proj1', name: 'Scene 1', createdAt: 'x', updatedAt: 'x',
        turnCount: 0, renderedCount: 0, participantIds: [] },
    ]);
    await useProjectStore.getState().create('Scene 1');
    const state = useProjectStore.getState();
    expect(state.current?.id).toBe('proj1');
    expect(state.summaries).toHaveLength(1);
  });

  it('adds a turn and stores the returned project', async () => {
    useProjectStore.setState({ current: makeProject() });
    vi.spyOn(api, 'addTurn').mockResolvedValue(
      makeProject({
        participantIds: ['p1'],
        turns: [
          { id: 't1', profileId: 'p1', text: '', params: { numStep: 32, speed: 1, duration: null },
            voiceOverride: null, status: 'draft', audio: null,
            createdAt: 'x', updatedAt: 'x' },
        ],
      }),
    );
    await useProjectStore.getState().addTurn('p1');
    expect(useProjectStore.getState().current?.turns).toHaveLength(1);
  });

  it('tracks the rendering turn id while a render is in flight', async () => {
    useProjectStore.setState({ current: makeProject() });
    let seen: string | null = null;
    vi.spyOn(api, 'renderTurn').mockImplementation(async () => {
      seen = useProjectStore.getState().renderingTurnId;
      return makeProject();
    });
    await useProjectStore.getState().renderTurn('t1');
    expect(seen).toBe('t1');
    expect(useProjectStore.getState().renderingTurnId).toBeNull();
  });

  it('clears the rendering id and records the error when a render fails', async () => {
    useProjectStore.setState({ current: makeProject() });
    vi.spyOn(api, 'renderTurn').mockRejectedValue(new Error('synthesis failed'));
    await useProjectStore.getState().renderTurn('t1');
    const state = useProjectStore.getState();
    expect(state.renderingTurnId).toBeNull();
    expect(state.error).toBe('synthesis failed');
  });

  it('updates sequencer settings optimistically then from the server', async () => {
    useProjectStore.setState({ current: makeProject() });
    vi.spyOn(api, 'updateProject').mockResolvedValue(
      makeProject({
        sequencer: { mode: 'simultaneous', delayMs: 300, staggerMs: 120, loop: true, volume: 0.8 },
      }),
    );
    await useProjectStore.getState().setSequencer({ mode: 'simultaneous', staggerMs: 120 });
    expect(useProjectStore.getState().current?.sequencer.mode).toBe('simultaneous');
    expect(useProjectStore.getState().current?.sequencer.staggerMs).toBe(120);
  });

  it('renderedTurns returns only turns with audio, in order', () => {
    useProjectStore.setState({
      current: makeProject({
        turns: [
          { id: 't1', profileId: 'p1', text: 'a', params: { numStep: 32, speed: 1, duration: null },
            voiceOverride: null, status: 'draft', audio: null, createdAt: 'x', updatedAt: 'x' },
          { id: 't2', profileId: 'p1', text: 'b', params: { numStep: 32, speed: 1, duration: null },
            voiceOverride: null, status: 'rendered',
            audio: { url: '/media/b.wav', filename: 'b.wav', durationSec: 1,
                     sampleRate: 24000, renderedAt: 'x' },
            createdAt: 'x', updatedAt: 'x' },
        ],
      }),
    });
    expect(useProjectStore.getState().renderedTurns().map((t) => t.id)).toEqual(['t2']);
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/state
```

Expected: FAIL — cannot resolve `./profileStore` and `./projectStore`.

- [ ] **Step 4: Write `frontend/src/state/vocabStore.ts`**

```ts
import { create } from 'zustand';
import { api } from '@/api/client';
import type { EngineStatus, TagGroup, VoiceVocab } from '@/api/types';

const EMPTY_VOCAB: VoiceVocab = {
  genders: [], ages: [], pitches: [], styles: [],
  accents: [], dialects: [], moods: [], intensities: [],
};

interface VocabState {
  tagGroups: TagGroup[];
  vocab: VoiceVocab;
  engine: EngineStatus | null;
  loaded: boolean;
  load: () => Promise<void>;
  refreshEngine: () => Promise<void>;
  warmUp: () => Promise<void>;
}

export const useVocabStore = create<VocabState>((set) => ({
  tagGroups: [],
  vocab: EMPTY_VOCAB,
  engine: null,
  loaded: false,
  load: async () => {
    const [tags, vocab, engine] = await Promise.all([
      api.getTags(),
      api.getVoiceVocab(),
      api.getEngineStatus().catch(() => null),
    ]);
    set({ tagGroups: tags.groups, vocab, engine, loaded: true });
  },
  refreshEngine: async () => {
    set({ engine: await api.getEngineStatus() });
  },
  warmUp: async () => {
    set({ engine: await api.warmUpEngine() });
  },
}));
```

- [ ] **Step 5: Write `frontend/src/state/profileStore.ts`**

```ts
import { create } from 'zustand';
import { api } from '@/api/client';
import type { DeepPartial, Profile } from '@/api/types';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ProfileState {
  profiles: Profile[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (name: string) => Promise<void>;
  update: (id: string, patch: DeepPartial<Profile>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  select: (id: string | null) => void;
  applyProfile: (profile: Profile) => void;
  byId: (id: string) => Profile | undefined;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  selectedId: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      set({ profiles: await api.listProfiles(), loading: false });
    } catch (error) {
      set({ error: message(error), loading: false });
    }
  },

  create: async (name) => {
    set({ error: null });
    try {
      const profile = await api.createProfile(name);
      set((state) => ({
        profiles: [...state.profiles, profile],
        selectedId: profile.id,
      }));
    } catch (error) {
      set({ error: message(error) });
    }
  },

  update: async (id, patch) => {
    set({ error: null });
    try {
      get().applyProfile(await api.updateProfile(id, patch));
    } catch (error) {
      set({ error: message(error) });
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await api.deleteProfile(id);
      set((state) => ({
        profiles: state.profiles.filter((p) => p.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }));
    } catch (error) {
      set({ error: message(error) });
    }
  },

  select: (id) => set({ selectedId: id }),

  applyProfile: (profile) =>
    set((state) => ({
      profiles: state.profiles.some((p) => p.id === profile.id)
        ? state.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...state.profiles, profile],
    })),

  byId: (id) => get().profiles.find((p) => p.id === id),
}));
```

- [ ] **Step 6: Write `frontend/src/state/projectStore.ts`**

```ts
import { create } from 'zustand';
import { api } from '@/api/client';
import type {
  GenerationParams,
  Project,
  ProjectSummary,
  SequencerSettings,
  Turn,
  VoiceDesign,
} from '@/api/types';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ProjectState {
  summaries: ProjectSummary[];
  current: Project | null;
  loading: boolean;
  error: string | null;
  renderingTurnId: string | null;
  loadSummaries: () => Promise<void>;
  open: (id: string) => Promise<void>;
  create: (name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addTurn: (profileId: string, text?: string) => Promise<string | null>;
  updateTurn: (
    turnId: string,
    patch: {
      text?: string;
      params?: Partial<GenerationParams>;
      voiceOverride?: VoiceDesign | null;
    },
  ) => Promise<void>;
  deleteTurn: (turnId: string) => Promise<void>;
  reorderTurns: (turnIds: string[]) => Promise<void>;
  renderTurn: (turnId: string) => Promise<void>;
  setSequencer: (patch: Partial<SequencerSettings>) => Promise<void>;
  clearError: () => void;
  renderedTurns: () => Turn[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  summaries: [],
  current: null,
  loading: false,
  error: null,
  renderingTurnId: null,

  loadSummaries: async () => {
    set({ loading: true, error: null });
    try {
      set({ summaries: await api.listProjects(), loading: false });
    } catch (error) {
      set({ error: message(error), loading: false });
    }
  },

  open: async (id) => {
    set({ loading: true, error: null });
    try {
      set({ current: await api.getProject(id), loading: false });
    } catch (error) {
      set({ error: message(error), loading: false });
    }
  },

  create: async (name) => {
    set({ error: null });
    try {
      const project = await api.createProject(name);
      set({ current: project });
      await get().loadSummaries();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await api.deleteProject(id);
      set((state) => ({ current: state.current?.id === id ? null : state.current }));
      await get().loadSummaries();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  addTurn: async (profileId, text = '') => {
    const project = get().current;
    if (!project) return null;
    set({ error: null });
    try {
      const updated = await api.addTurn(project.id, profileId, text);
      set({ current: updated });
      return updated.turns.at(-1)?.id ?? null;
    } catch (error) {
      set({ error: message(error) });
      return null;
    }
  },

  updateTurn: async (turnId, patch) => {
    const project = get().current;
    if (!project) return;
    set({ error: null });
    try {
      set({ current: await api.updateTurn(project.id, turnId, patch) });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  deleteTurn: async (turnId) => {
    const project = get().current;
    if (!project) return;
    try {
      set({ current: await api.deleteTurn(project.id, turnId) });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  reorderTurns: async (turnIds) => {
    const project = get().current;
    if (!project) return;
    try {
      set({ current: await api.reorderTurns(project.id, turnIds) });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  renderTurn: async (turnId) => {
    const project = get().current;
    if (!project) return;
    set({ renderingTurnId: turnId, error: null });
    try {
      set({ current: await api.renderTurn(project.id, turnId) });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ renderingTurnId: null });
    }
  },

  setSequencer: async (patch) => {
    const project = get().current;
    if (!project) return;
    const optimistic = { ...project, sequencer: { ...project.sequencer, ...patch } };
    set({ current: optimistic });
    try {
      set({ current: await api.updateProject(project.id, { sequencer: patch }) });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  clearError: () => set({ error: null }),

  renderedTurns: () => (get().current?.turns ?? []).filter((turn) => turn.audio !== null),
}));
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/state
```

Expected: `14 passed` (7 profile + 7 project).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/state && git commit -m "feat(frontend): add vocab, profile and project stores"
```

---

## Task 21: SequencerEngine

Playback logic lives in a plain class so it can be tested with fake timers and fake audio elements, independent of React.

**Files:**
- Create: `frontend/src/features/sequencer/SequencerEngine.ts`
- Test: `frontend/src/features/sequencer/SequencerEngine.test.ts`

- [ ] **Step 1: Write the failing test `frontend/src/features/sequencer/SequencerEngine.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SequencerEngine, type SequencerItem } from './SequencerEngine';

class FakeAudio {
  src = '';
  volume = 1;
  currentTime = 0;
  paused = true;
  playCount = 0;
  private handlers: Record<string, Array<() => void>> = {};

  play() {
    this.playCount += 1;
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  addEventListener(name: string, handler: () => void) {
    (this.handlers[name] ||= []).push(handler);
  }
  removeEventListener(name: string, handler: () => void) {
    this.handlers[name] = (this.handlers[name] || []).filter((h) => h !== handler);
  }
  end() {
    this.paused = true;
    for (const handler of this.handlers.ended || []) handler();
  }
}

const ITEMS: SequencerItem[] = [
  { turnId: 't1', url: '/media/1.wav', durationSec: 1 },
  { turnId: 't2', url: '/media/2.wav', durationSec: 1 },
  { turnId: 't3', url: '/media/3.wav', durationSec: 1 },
];

let created: FakeAudio[] = [];

function makeEngine(overrides: Partial<ConstructorParameters<typeof SequencerEngine>[0]> = {}) {
  created = [];
  return new SequencerEngine({
    createAudio: (src: string) => {
      const audio = new FakeAudio();
      audio.src = src;
      created.push(audio);
      return audio as unknown as HTMLAudioElement;
    },
    ...overrides,
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SequencerEngine', () => {
  it('plays the first item on play in sequential mode', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.play();
    expect(created).toHaveLength(1);
    expect(created[0].src).toBe('/media/1.wav');
    expect(created[0].playCount).toBe(1);
  });

  it('advances to the next item after the configured delay', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ delayMs: 500 });
    engine.play();
    created[0].end();
    expect(created).toHaveLength(1);
    vi.advanceTimersByTime(499);
    expect(created).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(created[1].src).toBe('/media/2.wav');
  });

  it('stops after the last item when loop is off', () => {
    const engine = makeEngine();
    const onState = vi.fn();
    engine.subscribe(onState);
    engine.setItems(ITEMS);
    engine.setSettings({ delayMs: 0 });
    engine.play();
    for (let index = 0; index < 3; index += 1) {
      created[index].end();
      vi.advanceTimersByTime(0);
    }
    expect(engine.getState().playing).toBe(false);
    expect(engine.getState().activeTurnIds).toEqual([]);
  });

  it('wraps to the first item when loop is on', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ delayMs: 0, loop: true });
    engine.play();
    for (let index = 0; index < 3; index += 1) {
      created[index].end();
      vi.advanceTimersByTime(0);
    }
    expect(created).toHaveLength(4);
    expect(created[3].src).toBe('/media/1.wav');
  });

  it('starts every item at once in simultaneous mode', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ mode: 'simultaneous', staggerMs: 0 });
    engine.play();
    expect(created).toHaveLength(3);
    expect(created.every((audio) => audio.playCount === 1)).toBe(true);
    expect(engine.getState().activeTurnIds).toEqual(['t1', 't2', 't3']);
  });

  it('staggers simultaneous starts', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ mode: 'simultaneous', staggerMs: 200 });
    engine.play();
    expect(created).toHaveLength(1);
    vi.advanceTimersByTime(200);
    expect(created).toHaveLength(2);
    vi.advanceTimersByTime(200);
    expect(created).toHaveLength(3);
  });

  it('applies volume to every element it creates', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ mode: 'simultaneous', staggerMs: 0, volume: 0.25 });
    engine.play();
    expect(created.map((audio) => audio.volume)).toEqual([0.25, 0.25, 0.25]);
  });

  it('stop halts playback, clears timers and resets the index', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ delayMs: 1000 });
    engine.play();
    created[0].end();
    engine.stop();
    vi.advanceTimersByTime(5000);
    expect(created).toHaveLength(1);
    expect(engine.getState().playing).toBe(false);
    expect(engine.getState().index).toBe(0);
  });

  it('pause keeps the index so play resumes the same item', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ delayMs: 0 });
    engine.play();
    created[0].end();
    vi.advanceTimersByTime(0);
    engine.pause();
    expect(engine.getState().playing).toBe(false);
    expect(engine.getState().index).toBe(1);
  });

  it('notifies subscribers of state changes', () => {
    const engine = makeEngine();
    const onState = vi.fn();
    engine.subscribe(onState);
    engine.setItems(ITEMS);
    engine.play();
    expect(onState).toHaveBeenCalled();
    expect(onState.mock.calls.at(-1)![0].activeTurnIds).toEqual(['t1']);
  });

  it('play with no items does nothing', () => {
    const engine = makeEngine();
    engine.setItems([]);
    engine.play();
    expect(created).toHaveLength(0);
    expect(engine.getState().playing).toBe(false);
  });

  it('playFrom starts at the given index', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.playFrom(2);
    expect(created[0].src).toBe('/media/3.wav');
    expect(engine.getState().index).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/sequencer
```

Expected: FAIL — cannot resolve `./SequencerEngine`.

- [ ] **Step 3: Write `frontend/src/features/sequencer/SequencerEngine.ts`**

```ts
import type { SequencerMode } from '@/api/types';

export interface SequencerItem {
  turnId: string;
  url: string;
  durationSec: number;
}

export interface SequencerSettingsInput {
  mode?: SequencerMode;
  delayMs?: number;
  staggerMs?: number;
  loop?: boolean;
  volume?: number;
}

export interface SequencerState {
  playing: boolean;
  index: number;
  activeTurnIds: string[];
}

interface Options {
  createAudio?: (src: string) => HTMLAudioElement;
}

const DEFAULTS = {
  mode: 'sequential' as SequencerMode,
  delayMs: 300,
  staggerMs: 0,
  loop: false,
  volume: 1,
};

export class SequencerEngine {
  private items: SequencerItem[] = [];
  private settings = { ...DEFAULTS };
  private state: SequencerState = { playing: false, index: 0, activeTurnIds: [] };
  private active: Array<{ turnId: string; audio: HTMLAudioElement; onEnded: () => void }> = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private listeners = new Set<(state: SequencerState) => void>();
  private createAudio: (src: string) => HTMLAudioElement;

  constructor(options: Options = {}) {
    this.createAudio =
      options.createAudio ?? ((src: string) => new Audio(src));
  }

  subscribe(listener: (state: SequencerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): SequencerState {
    return this.state;
  }

  setItems(items: SequencerItem[]): void {
    this.items = items;
    if (this.state.index >= items.length) this.patch({ index: 0 });
  }

  setSettings(patch: SequencerSettingsInput): void {
    this.settings = { ...this.settings, ...patch };
    for (const entry of this.active) entry.audio.volume = this.settings.volume;
  }

  play(): void {
    this.playFrom(this.state.index);
  }

  playFrom(index: number): void {
    if (this.items.length === 0) return;
    this.teardown();
    const start = Math.max(0, Math.min(index, this.items.length - 1));
    this.patch({ playing: true, index: start });
    if (this.settings.mode === 'simultaneous') this.startAll();
    else this.startAt(start);
  }

  pause(): void {
    for (const entry of this.active) entry.audio.pause();
    this.teardown();
    this.patch({ playing: false, activeTurnIds: [] });
  }

  stop(): void {
    for (const entry of this.active) {
      entry.audio.pause();
      entry.audio.currentTime = 0;
    }
    this.teardown();
    this.patch({ playing: false, index: 0, activeTurnIds: [] });
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
  }

  // --- internals -----------------------------------------------------

  private patch(partial: Partial<SequencerState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener(this.state);
  }

  private teardown(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
    for (const entry of this.active) {
      entry.audio.removeEventListener('ended', entry.onEnded);
    }
    this.active = [];
  }

  private spawn(item: SequencerItem, onEnded: () => void): void {
    const audio = this.createAudio(item.url);
    audio.volume = this.settings.volume;
    audio.addEventListener('ended', onEnded);
    this.active.push({ turnId: item.turnId, audio, onEnded });
    void audio.play();
  }

  private startAt(index: number): void {
    const item = this.items[index];
    if (!item) {
      this.patch({ playing: false, index: 0, activeTurnIds: [] });
      return;
    }
    this.spawn(item, () => this.advanceFrom(index));
    this.patch({ index, activeTurnIds: [item.turnId] });
  }

  private advanceFrom(index: number): void {
    const next = index + 1;
    const wrapped = next >= this.items.length;
    if (wrapped && !this.settings.loop) {
      this.teardown();
      this.patch({ playing: false, index: 0, activeTurnIds: [] });
      return;
    }
    const target = wrapped ? 0 : next;
    this.patch({ index: target });
    const timer = setTimeout(() => {
      this.teardown();
      if (!this.state.playing) return;
      this.startAt(target);
    }, this.settings.delayMs);
    this.timers.push(timer);
  }

  private startAll(): void {
    const finished = new Set<string>();
    const complete = (turnId: string) => {
      finished.add(turnId);
      if (finished.size < this.items.length) return;
      this.teardown();
      if (this.settings.loop) this.startAll();
      else this.patch({ playing: false, index: 0, activeTurnIds: [] });
    };

    this.items.forEach((item, position) => {
      const launch = () => {
        this.spawn(item, () => complete(item.turnId));
        this.patch({
          activeTurnIds: [...this.state.activeTurnIds, item.turnId],
        });
      };
      if (position === 0 || this.settings.staggerMs === 0) launch();
      else {
        this.timers.push(setTimeout(launch, this.settings.staggerMs * position));
      }
    });
    this.patch({
      activeTurnIds: this.active.map((entry) => entry.turnId),
    });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/sequencer
```

Expected: `12 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/sequencer && git commit -m "feat(frontend): add sequencer playback engine"
```

---

## Task 22: ProfileCard

The condensed card used in three places: the chat participant rail, the picker grid, and the profile list.

**Files:**
- Create: `frontend/src/features/profiles/profiles.css`
- Create: `frontend/src/features/profiles/ProfileCard.tsx`
- Test: `frontend/src/features/profiles/ProfileCard.test.tsx`

- [ ] **Step 1: Write `frontend/src/features/profiles/profiles.css`**

```css
.vx-card {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--gap-1);
  padding: var(--gap-1);
  width: 100%;
  text-align: left;
  background: var(--c-panel);
  box-shadow:
    0 0 0 var(--px) var(--c-line),
    calc(var(--px) * 1) calc(var(--px) * 1) 0 0 var(--c-shadow);
  transition: background var(--dur-fast) var(--step-2);
}
.vx-card:hover:not(:disabled) {
  background: var(--c-panel-hi);
}
.vx-card[aria-pressed='true'] {
  box-shadow:
    0 0 0 var(--px) var(--c-accent),
    calc(var(--px) * 1) calc(var(--px) * 1) 0 0 var(--c-shadow);
}
.vx-card[data-active='true'] {
  animation: vx-pulse-accent 600ms var(--step-2) infinite;
}
.vx-card__pic {
  width: calc(var(--px) * 12);
  height: calc(var(--px) * 12);
  object-fit: cover;
  background: var(--c-panel-lo);
  box-shadow: inset 0 0 0 var(--px) var(--c-line-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-lg);
  color: var(--c-line-dim);
}
.vx-card--lg .vx-card__pic {
  width: calc(var(--px) * 20);
  height: calc(var(--px) * 20);
}
.vx-card__body {
  min-width: 0;
}
.vx-card__name {
  font-size: var(--fs-sm);
  color: var(--c-line);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vx-card__tagline {
  font-size: var(--fs-xs);
  color: var(--c-line-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vx-card__meta {
  font-size: 8px;
  color: var(--c-accent);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.vx-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--gap-2);
}
```

- [ ] **Step 2: Write the failing test `frontend/src/features/profiles/ProfileCard.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/api/types';
import { ProfileCard } from './ProfileCard';

const PROFILE: Profile = {
  id: 'p1',
  name: 'Ivy Thorn',
  createdAt: 'x',
  updatedAt: 'x',
  portraitUrl: null,
  card: { shortName: 'Ivy', tagline: 'Ranger of the marsh', accentColor: '#6fe3a1' },
  voiceMode: 'design',
  voice: {
    gender: 'female', age: 'young adult', pitch: 'low', style: '',
    accent: '', dialect: '', mood: '', intensity: 2, extra: [],
  },
  params: { numStep: 32, speed: 1, duration: null },
  samples: [],
  activeSampleId: null,
  narrative: { description: '', background: '' },
  customTags: [],
  archive: [],
};

describe('ProfileCard', () => {
  it('shows the short name and tagline', () => {
    render(<ProfileCard profile={PROFILE} />);
    expect(screen.getByText('Ivy')).toBeInTheDocument();
    expect(screen.getByText('Ranger of the marsh')).toBeInTheDocument();
  });

  it('shows the voice mode as meta text', () => {
    render(<ProfileCard profile={PROFILE} />);
    expect(screen.getByText('design')).toBeInTheDocument();
  });

  it('renders a placeholder glyph when there is no portrait', () => {
    render(<ProfileCard profile={PROFILE} />);
    expect(screen.getByTestId('card-placeholder')).toBeInTheDocument();
  });

  it('renders an img when a portrait exists', () => {
    render(<ProfileCard profile={{ ...PROFILE, portraitUrl: '/media/portraits/a.png' }} />);
    expect(screen.getByRole('img', { name: 'Ivy' })).toHaveAttribute(
      'src',
      '/media/portraits/a.png',
    );
  });

  it('is a button that fires onSelect when selectable', async () => {
    const onSelect = vi.fn();
    render(<ProfileCard profile={PROFILE} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('p1');
  });

  it('is not a button when there is no onSelect', () => {
    render(<ProfileCard profile={PROFILE} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reports the selected state', () => {
    render(<ProfileCard profile={PROFILE} onSelect={() => {}} selected />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks itself active for the sequencer highlight', () => {
    render(<ProfileCard profile={PROFILE} active />);
    expect(screen.getByTestId('profile-card')).toHaveAttribute('data-active', 'true');
  });

  it('falls back to the full name when shortName is blank', () => {
    render(
      <ProfileCard profile={{ ...PROFILE, card: { ...PROFILE.card, shortName: '' } }} />,
    );
    expect(screen.getByText('Ivy Thorn')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/profiles
```

Expected: FAIL — cannot resolve `./ProfileCard`.

- [ ] **Step 4: Write `frontend/src/features/profiles/ProfileCard.tsx`**

```tsx
import type { Profile } from '@/api/types';
import './profiles.css';

export interface ProfileCardProps {
  profile: Profile;
  onSelect?: (id: string) => void;
  selected?: boolean;
  active?: boolean;
  size?: 'md' | 'lg';
  className?: string;
}

export function ProfileCard({
  profile,
  onSelect,
  selected = false,
  active = false,
  size = 'md',
  className = '',
}: ProfileCardProps) {
  const label = profile.card.shortName || profile.name;
  const classes = [
    'vx-card',
    size === 'lg' ? 'vx-card--lg' : '',
    'vx-anim-pop',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {profile.portraitUrl ? (
        <img className="vx-card__pic" src={profile.portraitUrl} alt={label} />
      ) : (
        <span className="vx-card__pic" data-testid="card-placeholder" aria-hidden="true">
          ?
        </span>
      )}
      <span className="vx-card__body">
        <span
          className="vx-card__name"
          style={{ color: profile.card.accentColor || undefined }}
        >
          {label}
        </span>
        {profile.card.tagline && (
          <span className="vx-card__tagline">{profile.card.tagline}</span>
        )}
        <span className="vx-card__meta">{profile.voiceMode}</span>
      </span>
    </>
  );

  if (!onSelect) {
    return (
      <div
        className={classes}
        data-testid="profile-card"
        data-active={active ? 'true' : 'false'}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      data-testid="profile-card"
      data-active={active ? 'true' : 'false'}
      aria-pressed={selected}
      onClick={() => onSelect(profile.id)}
    >
      {inner}
    </button>
  );
}
```

The card's name/tagline/meta are stacked because `.vx-card__body` children are inline spans in a grid cell; add `display:block` to each in CSS if the browser render disagrees with the mockup — the class names above already exist for that.

- [ ] **Step 5: Add the stacking rules to `frontend/src/features/profiles/profiles.css`**

```css
.vx-card__name,
.vx-card__tagline,
.vx-card__meta {
  display: block;
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/profiles
```

Expected: `9 passed`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/profiles && git commit -m "feat(frontend): add ProfileCard component"
```

---

## Task 23: Profiles screen

Layout matches the first mockup: portrait + name (top-left), settings panel with sliders and tag chips (top-right), narrative panel with the sample upload bar and expanding sample list (middle), archive of generated audio (bottom).

**Files:**
- Create: `frontend/src/features/profiles/VoiceSettingsPanel.tsx`
- Create: `frontend/src/features/profiles/SamplesBar.tsx`
- Create: `frontend/src/features/profiles/ArchivePanel.tsx`
- Create: `frontend/src/screens/ProfilesScreen.tsx`
- Modify: `frontend/src/features/profiles/profiles.css` (append)
- Test: `frontend/src/screens/ProfilesScreen.test.tsx`

- [ ] **Step 1: Append to `frontend/src/features/profiles/profiles.css`**

```css
.vx-profiles {
  display: grid;
  grid-template-columns: minmax(200px, 260px) 1fr;
  gap: var(--gap-2);
  height: 100%;
  min-height: 0;
}
.vx-profiles__rail {
  display: flex;
  flex-direction: column;
  gap: var(--gap-1);
  min-height: 0;
}
.vx-profiles__list {
  display: flex;
  flex-direction: column;
  gap: var(--gap-1);
  flex: 1;
  min-height: 0;
}
.vx-profiles__detail {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: var(--gap-2);
  min-height: 0;
  overflow-y: auto;
}
.vx-profiles__head {
  display: grid;
  grid-template-columns: minmax(180px, 280px) 1fr;
  gap: var(--gap-2);
}
.vx-portrait {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-1);
}
.vx-portrait__img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  background: var(--c-panel-lo);
  box-shadow: inset 0 0 0 var(--px) var(--c-line-dim);
}
.vx-field {
  display: flex;
  flex-direction: column;
  gap: calc(var(--px));
  margin-bottom: var(--gap-1);
}
.vx-field__label {
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--c-line-dim);
}
.vx-input {
  width: 100%;
  padding: var(--gap-1);
  background: var(--c-panel-lo);
  color: var(--c-line);
  box-shadow: inset 0 0 0 var(--px) var(--c-line-dim);
}
.vx-input:focus {
  box-shadow: inset 0 0 0 var(--px) var(--c-accent);
}
.vx-chips {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--px));
}
.vx-chip {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--px));
  padding: calc(var(--px)) var(--gap-1);
  font-size: var(--fs-xs);
  background: var(--c-panel-lo);
  box-shadow: 0 0 0 var(--px) var(--c-line-dim);
}
.vx-samples {
  display: flex;
  flex-direction: column;
  gap: calc(var(--px));
}
.vx-sample {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: var(--gap-1);
  padding: calc(var(--px)) var(--gap-1);
  background: var(--c-panel-lo);
  box-shadow: inset 0 0 0 var(--px) var(--c-line-dim);
  font-size: var(--fs-xs);
}
.vx-sample[data-active='true'] {
  box-shadow: inset 0 0 0 var(--px) var(--c-accent);
}
.vx-archive-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--gap-1);
  align-items: center;
  padding: calc(var(--px)) 0;
  border-bottom: var(--px) solid var(--c-panel-hi);
  font-size: var(--fs-xs);
}
.vx-empty {
  color: var(--c-line-dim);
  font-size: var(--fs-xs);
  padding: var(--gap-2);
  text-align: center;
}
```

- [ ] **Step 2: Write `frontend/src/features/profiles/VoiceSettingsPanel.tsx`**

```tsx
import { useState } from 'react';
import type { DeepPartial, Profile, VoiceMode } from '@/api/types';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelSlider } from '@/ui/primitives/PixelSlider';
import { PixelStepSlider } from '@/ui/primitives/PixelStepSlider';
import { useVocabStore } from '@/state/vocabStore';
import './profiles.css';

const MODES: VoiceMode[] = ['auto', 'clone', 'design'];

export interface VoiceSettingsPanelProps {
  profile: Profile;
  onChange: (patch: DeepPartial<Profile>) => void;
}

export function VoiceSettingsPanel({ profile, onChange }: VoiceSettingsPanelProps) {
  const vocab = useVocabStore((state) => state.vocab);
  const [tagDraft, setTagDraft] = useState('');

  const indexOf = (list: string[], value: string) => {
    const found = list.indexOf(value);
    return found < 0 ? 0 : found;
  };
  const pick = (list: string[], index: number) => list[index] ?? '';

  const addTag = () => {
    const token = tagDraft.trim();
    if (!token || profile.customTags.includes(token)) return;
    onChange({ customTags: [...profile.customTags, token] } as DeepPartial<Profile>);
    setTagDraft('');
  };

  return (
    <PixelPanel title="Profile Settings" variant="solid">
      <div className="vx-field">
        <span className="vx-field__label">Voice mode</span>
        <div className="vx-chips">
          {MODES.map((mode) => (
            <PixelButton
              key={mode}
              size="sm"
              selected={profile.voiceMode === mode}
              onClick={() => onChange({ voiceMode: mode })}
            >
              {mode}
            </PixelButton>
          ))}
        </div>
      </div>

      <PixelStepSlider
        label="Gender"
        options={vocab.genders}
        index={indexOf(vocab.genders, profile.voice.gender)}
        onChange={(index) => onChange({ voice: { gender: pick(vocab.genders, index) } })}
      />
      <PixelStepSlider
        label="Age"
        options={vocab.ages}
        index={indexOf(vocab.ages, profile.voice.age)}
        onChange={(index) => onChange({ voice: { age: pick(vocab.ages, index) } })}
      />
      <PixelStepSlider
        label="Pitch"
        options={vocab.pitches}
        index={indexOf(vocab.pitches, profile.voice.pitch)}
        onChange={(index) => onChange({ voice: { pitch: pick(vocab.pitches, index) } })}
      />
      <PixelStepSlider
        label="Emotion"
        options={vocab.moods}
        index={indexOf(vocab.moods, profile.voice.mood)}
        onChange={(index) => onChange({ voice: { mood: pick(vocab.moods, index) } })}
      />
      <PixelStepSlider
        label="Intensity"
        options={vocab.intensities.map((word) => word || 'plain')}
        index={profile.voice.intensity}
        onChange={(index) => onChange({ voice: { intensity: index } })}
      />
      <PixelStepSlider
        label="Accent"
        options={vocab.accents}
        index={indexOf(vocab.accents, profile.voice.accent)}
        onChange={(index) => onChange({ voice: { accent: pick(vocab.accents, index) } })}
      />
      <PixelStepSlider
        label="Dialect"
        options={vocab.dialects}
        index={indexOf(vocab.dialects, profile.voice.dialect)}
        onChange={(index) => onChange({ voice: { dialect: pick(vocab.dialects, index) } })}
      />
      <PixelStepSlider
        label="Style"
        options={vocab.styles}
        index={indexOf(vocab.styles, profile.voice.style)}
        onChange={(index) => onChange({ voice: { style: pick(vocab.styles, index) } })}
      />

      <PixelSlider
        label="Speed"
        min={0.5}
        max={2}
        step={0.05}
        value={profile.params.speed}
        onChange={(speed) => onChange({ params: { speed } })}
        format={(value) => `${value.toFixed(2)}x`}
      />
      <PixelSlider
        label="Diffusion steps"
        min={16}
        max={32}
        step={1}
        value={profile.params.numStep}
        onChange={(numStep) => onChange({ params: { numStep } })}
      />

      <div className="vx-field">
        <span className="vx-field__label">Custom tags</span>
        <div className="vx-chips">
          {profile.customTags.map((tag) => (
            <span key={tag} className="vx-chip">
              {tag}
              <PixelButton
                size="sm"
                variant="ghost"
                aria-label={`Remove tag ${tag}`}
                onClick={() =>
                  onChange({
                    customTags: profile.customTags.filter((t) => t !== tag),
                  } as DeepPartial<Profile>)
                }
              >
                x
              </PixelButton>
            </span>
          ))}
        </div>
        <div className="vx-chips">
          <input
            className="vx-input"
            style={{ flex: 1 }}
            aria-label="New tag"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addTag();
              }
            }}
          />
          <PixelButton size="sm" onClick={addTag}>
            Add tag
          </PixelButton>
        </div>
      </div>
    </PixelPanel>
  );
}
```

- [ ] **Step 3: Write `frontend/src/features/profiles/SamplesBar.tsx`**

```tsx
import { useRef, useState } from 'react';
import { api } from '@/api/client';
import type { Profile } from '@/api/types';
import { useProfileStore } from '@/state/profileStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelTransport } from '@/ui/primitives/PixelTransport';
import './profiles.css';

export interface SamplesBarProps {
  profile: Profile;
}

export function SamplesBar({ profile }: SamplesBarProps) {
  const applyProfile = useProfileStore((state) => state.applyProfile);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      applyProfile(await api.uploadSample(profile.id, file, transcript));
      setTranscript('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (sampleId: string) => {
    applyProfile(await api.deleteSample(profile.id, sampleId));
  };

  const activate = async (sampleId: string) => {
    applyProfile(await api.activateSample(profile.id, sampleId));
  };

  return (
    <div className="vx-field">
      <span className="vx-field__label">Audio samples for cloning</span>
      <div className="vx-chips">
        <input
          className="vx-input"
          style={{ flex: 1 }}
          aria-label="Sample transcript"
          placeholder="Transcript (optional)"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          data-testid="sample-input"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <PixelButton size="sm" busy={busy} onClick={() => fileRef.current?.click()}>
          Upload sample
        </PixelButton>
      </div>
      {error && <span className="vx-field__label">{error}</span>}

      <div className="vx-samples">
        {profile.samples.length === 0 && (
          <span className="vx-empty">no samples yet</span>
        )}
        {profile.samples.map((sample) => (
          <div
            key={sample.id}
            className="vx-sample"
            data-active={profile.activeSampleId === sample.id ? 'true' : 'false'}
          >
            <PixelButton
              size="sm"
              variant="ghost"
              selected={profile.activeSampleId === sample.id}
              aria-label={`Use ${sample.filename} for cloning`}
              onClick={() => void activate(sample.id)}
            >
              Use
            </PixelButton>
            <span>{sample.filename}</span>
            <PixelTransport
              src={sample.url}
              name={sample.transcript || sample.filename}
              durationSec={sample.durationSec}
            />
            <PixelButton
              size="sm"
              variant="danger"
              aria-label={`Delete ${sample.filename}`}
              onClick={() => void remove(sample.id)}
            >
              Del
            </PixelButton>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `frontend/src/features/profiles/ArchivePanel.tsx`**

```tsx
import type { Profile } from '@/api/types';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelScrollArea } from '@/ui/primitives/PixelScrollArea';
import { PixelTransport } from '@/ui/primitives/PixelTransport';
import { strip } from '@/lib/tagText';
import './profiles.css';

export interface ArchivePanelProps {
  profile: Profile;
}

export function ArchivePanel({ profile }: ArchivePanelProps) {
  const entries = [...profile.archive].reverse();
  return (
    <PixelPanel title="Generated audio archive" variant="sunken">
      <PixelScrollArea style={{ maxHeight: '180px' }}>
        {entries.length === 0 && <div className="vx-empty">nothing rendered yet</div>}
        {entries.map((entry) => (
          <div key={entry.id} className="vx-archive-row">
            <span data-testid="archive-text">
              <strong>{entry.projectName}</strong> — {strip(entry.text) || '(empty)'}
              <br />
              <span className="vx-card__meta">{entry.createdAt}</span>
            </span>
            <PixelTransport
              src={entry.url}
              name={`${entry.turnId}.wav`}
              durationSec={entry.durationSec}
              downloadable
            />
          </div>
        ))}
      </PixelScrollArea>
    </PixelPanel>
  );
}
```

- [ ] **Step 5: Create `frontend/src/lib/tagText.ts`**

```ts
const TAG_PATTERN = /\[[a-z0-9]+(?:-[a-z0-9]+)*\]/g;

/** Text with non-verbal tags removed, for compact previews. */
export function strip(text: string): string {
  return text.replace(TAG_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
}

/** Insert `token` at `position`, returning the new text and caret offset. */
export function insertAt(
  text: string,
  position: number,
  token: string,
): { text: string; caret: number } {
  const safe = Math.max(0, Math.min(position, text.length));
  const needsLeadingSpace = safe > 0 && !/\s$/.test(text.slice(0, safe));
  const insertion = `${needsLeadingSpace ? ' ' : ''}${token} `;
  return {
    text: `${text.slice(0, safe)}${insertion}${text.slice(safe)}`,
    caret: safe + insertion.length,
  };
}
```

- [ ] **Step 6: Write the failing test `frontend/src/screens/ProfilesScreen.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Profile } from '@/api/types';
import { useProfileStore } from '@/state/profileStore';
import { useVocabStore } from '@/state/vocabStore';
import { ProfilesScreen } from './ProfilesScreen';

const VOCAB = {
  genders: ['', 'male', 'female'],
  ages: ['', 'child', 'teenage', 'young adult', 'middle-aged', 'elderly'],
  pitches: ['', 'very low', 'low', 'medium', 'high', 'very high'],
  styles: ['', 'whisper'],
  accents: ['', 'american', 'british'],
  dialects: ['', '四川话'],
  moods: ['', 'neutral', 'happy', 'angry'],
  intensities: ['faintly', 'slightly', '', 'very', 'extremely'],
};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1', name: 'Ivy', createdAt: 'x', updatedAt: 'x', portraitUrl: null,
    card: { shortName: 'Ivy', tagline: '', accentColor: '#f2c14e' },
    voiceMode: 'auto',
    voice: { gender: '', age: '', pitch: '', style: '', accent: '',
             dialect: '', mood: '', intensity: 2, extra: [] },
    params: { numStep: 32, speed: 1, duration: null },
    samples: [], activeSampleId: null,
    narrative: { description: '', background: '' },
    customTags: [], archive: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useVocabStore.setState({ tagGroups: [], vocab: VOCAB, engine: null, loaded: true });
  useProfileStore.setState({
    profiles: [], selectedId: null, loading: false, error: null,
  });
});

describe('ProfilesScreen', () => {
  it('prompts to create a profile when there are none', () => {
    render(<ProfilesScreen />);
    expect(screen.getByText(/no profiles yet/i)).toBeInTheDocument();
  });

  it('creates a profile from the new-profile control', async () => {
    const spy = vi.spyOn(api, 'createProfile').mockResolvedValue(makeProfile());
    render(<ProfilesScreen />);
    await userEvent.type(screen.getByLabelText('New profile name'), 'Ivy');
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(spy).toHaveBeenCalledWith('Ivy');
  });

  it('shows the editor for the selected profile', () => {
    useProfileStore.setState({ profiles: [makeProfile()], selectedId: 'p1' });
    render(<ProfilesScreen />);
    expect(screen.getByLabelText('Character name')).toHaveValue('Ivy');
    expect(screen.getByText('Profile Settings')).toBeInTheDocument();
    expect(screen.getByText('Character description and narrative background')).toBeInTheDocument();
    expect(screen.getByText('Generated audio archive')).toBeInTheDocument();
  });

  it('patches the name on blur', async () => {
    useProfileStore.setState({ profiles: [makeProfile()], selectedId: 'p1' });
    const spy = vi
      .spyOn(api, 'updateProfile')
      .mockResolvedValue(makeProfile({ name: 'Ivy Thorn' }));
    render(<ProfilesScreen />);
    const input = screen.getByLabelText('Character name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Ivy Thorn');
    await userEvent.tab();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('p1', { name: 'Ivy Thorn' }));
  });

  it('patches the voice mode from the settings panel', async () => {
    useProfileStore.setState({ profiles: [makeProfile()], selectedId: 'p1' });
    const spy = vi
      .spyOn(api, 'updateProfile')
      .mockResolvedValue(makeProfile({ voiceMode: 'design' }));
    render(<ProfilesScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'design' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('p1', { voiceMode: 'design' }));
  });

  it('uploads a voice sample', async () => {
    useProfileStore.setState({ profiles: [makeProfile()], selectedId: 'p1' });
    const spy = vi.spyOn(api, 'uploadSample').mockResolvedValue(makeProfile());
    render(<ProfilesScreen />);
    const file = new File(['x'], 'ref.wav', { type: 'audio/wav' });
    await userEvent.upload(screen.getByTestId('sample-input'), file);
    await waitFor(() => expect(spy).toHaveBeenCalledWith('p1', file, ''));
  });

  it('lists uploaded samples with an active marker', () => {
    useProfileStore.setState({
      profiles: [
        makeProfile({
          activeSampleId: 's1',
          samples: [
            { id: 's1', filename: 'ref.wav', url: '/media/samples/p1/s1.wav',
              transcript: 'hello', durationSec: 2, addedAt: 'x' },
          ],
        }),
      ],
      selectedId: 'p1',
    });
    render(<ProfilesScreen />);
    expect(screen.getByText('ref.wav')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use ref.wav for cloning' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders archive rows', () => {
    useProfileStore.setState({
      profiles: [
        makeProfile({
          archive: [
            { id: 'a1', projectId: 'proj1', projectName: 'Scene 1', turnId: 't1',
              text: 'Hello [laughter] world', url: '/media/renders/proj1/t1.wav',
              durationSec: 1.5, createdAt: '2026-08-10T00:00:00+00:00' },
          ],
        }),
      ],
      selectedId: 'p1',
    });
    render(<ProfilesScreen />);
    const row = screen.getByTestId('archive-text');
    expect(row).toHaveTextContent('Hello world');
    expect(row).toHaveTextContent('Scene 1');
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/screens/ProfilesScreen.test.tsx
```

Expected: FAIL — cannot resolve `./ProfilesScreen`.

- [ ] **Step 8: Write `frontend/src/screens/ProfilesScreen.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import type { DeepPartial, Profile } from '@/api/types';
import { ArchivePanel } from '@/features/profiles/ArchivePanel';
import { ProfileCard } from '@/features/profiles/ProfileCard';
import { SamplesBar } from '@/features/profiles/SamplesBar';
import { VoiceSettingsPanel } from '@/features/profiles/VoiceSettingsPanel';
import { useProfileStore } from '@/state/profileStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelScrollArea } from '@/ui/primitives/PixelScrollArea';
import { PixelTextArea } from '@/ui/primitives/PixelTextArea';
import '@/features/profiles/profiles.css';

export function ProfilesScreen() {
  const { profiles, selectedId, select, create, update, remove, applyProfile, error } =
    useProfileStore();
  const [draftName, setDraftName] = useState('');
  const portraitRef = useRef<HTMLInputElement | null>(null);
  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [background, setBackground] = useState('');
  const [tagline, setTagline] = useState('');

  useEffect(() => {
    setName(selected?.name ?? '');
    setDescription(selected?.narrative.description ?? '');
    setBackground(selected?.narrative.background ?? '');
    setTagline(selected?.card.tagline ?? '');
  }, [selected?.id]);

  const patch = (body: DeepPartial<Profile>) => {
    if (selected) void update(selected.id, body);
  };

  const uploadPortrait = async (file: File) => {
    if (!selected) return;
    applyProfile(await api.uploadPortrait(selected.id, file));
  };

  return (
    <div className="vx-profiles">
      <PixelFrame variant="dashed" className="vx-profiles__rail">
        <PixelPanel title="Characters" variant="solid" className="vx-profiles__list">
          <PixelScrollArea style={{ flex: 1 }}>
            {profiles.length === 0 && (
              <div className="vx-empty">no profiles yet — create one below</div>
            )}
            <div className="vx-profiles__list">
              {profiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  onSelect={select}
                  selected={profile.id === selectedId}
                />
              ))}
            </div>
          </PixelScrollArea>
        </PixelPanel>
        <div className="vx-chips">
          <input
            className="vx-input"
            style={{ flex: 1 }}
            aria-label="New profile name"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && draftName.trim()) {
                void create(draftName.trim());
                setDraftName('');
              }
            }}
          />
          <PixelButton
            variant="primary"
            disabled={!draftName.trim()}
            onClick={() => {
              void create(draftName.trim());
              setDraftName('');
            }}
          >
            New
          </PixelButton>
        </div>
        {error && <span className="vx-field__label">{error}</span>}
      </PixelFrame>

      {selected ? (
        <PixelFrame variant="dashed" className="vx-profiles__detail">
          <div className="vx-profiles__head">
            <PixelPanel title="Portrait" variant="solid">
              <div className="vx-portrait">
                {selected.portraitUrl ? (
                  <img
                    className="vx-portrait__img"
                    src={selected.portraitUrl}
                    alt={selected.name}
                  />
                ) : (
                  <div className="vx-portrait__img" />
                )}
                <input
                  ref={portraitRef}
                  type="file"
                  accept="image/*"
                  data-testid="portrait-input"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPortrait(file);
                  }}
                />
                <PixelButton size="sm" onClick={() => portraitRef.current?.click()}>
                  Upload picture
                </PixelButton>
                <div className="vx-field" style={{ width: '100%' }}>
                  <span className="vx-field__label">Name</span>
                  <input
                    className="vx-input"
                    aria-label="Character name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={() => name !== selected.name && patch({ name })}
                  />
                  <span className="vx-field__label">Card tagline</span>
                  <input
                    className="vx-input"
                    aria-label="Card tagline"
                    value={tagline}
                    onChange={(event) => setTagline(event.target.value)}
                    onBlur={() =>
                      tagline !== selected.card.tagline && patch({ card: { tagline } })
                    }
                  />
                </div>
                <PixelButton
                  size="sm"
                  variant="danger"
                  onClick={() => void remove(selected.id)}
                >
                  Delete profile
                </PixelButton>
              </div>
            </PixelPanel>
            <VoiceSettingsPanel profile={selected} onChange={patch} />
          </div>

          <PixelPanel title="Character description and narrative background" variant="solid">
            <SamplesBar profile={selected} />
            <div className="vx-field">
              <span className="vx-field__label">Description</span>
              <PixelTextArea
                aria-label="Character description"
                value={description}
                minRows={3}
                maxRows={10}
                onChange={setDescription}
                onBlur={() =>
                  description !== selected.narrative.description &&
                  patch({ narrative: { description } })
                }
              />
            </div>
            <div className="vx-field">
              <span className="vx-field__label">Background</span>
              <PixelTextArea
                aria-label="Character background"
                value={background}
                minRows={3}
                maxRows={10}
                onChange={setBackground}
                onBlur={() =>
                  background !== selected.narrative.background &&
                  patch({ narrative: { background } })
                }
              />
            </div>
          </PixelPanel>

          <ArchivePanel profile={selected} />
        </PixelFrame>
      ) : (
        <PixelFrame variant="dashed">
          <div className="vx-empty">select a character to edit</div>
        </PixelFrame>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/screens/ProfilesScreen.test.tsx
```

Expected: `8 passed`.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/profiles frontend/src/lib frontend/src/screens && git commit -m "feat(frontend): add Profiles screen with settings, samples and archive"
```

---

## Task 24: Tag insertion helpers and the tag hotkey panel

**Files:**
- Create: `frontend/src/features/chat/chat.css`
- Create: `frontend/src/features/chat/TagPanel.tsx`
- Test: `frontend/src/lib/tagText.test.ts`
- Test: `frontend/src/features/chat/TagPanel.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/lib/tagText.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { insertAt, strip } from './tagText';

describe('strip', () => {
  it('removes tags and collapses whitespace', () => {
    expect(strip('Hey [laughter] there')).toBe('Hey there');
  });
  it('leaves plain text alone', () => {
    expect(strip('Hey there')).toBe('Hey there');
  });
  it('returns an empty string for tag-only text', () => {
    expect(strip('[sigh]')).toBe('');
  });
});

describe('insertAt', () => {
  it('inserts at the caret with a trailing space', () => {
    expect(insertAt('', 0, '[sigh]')).toEqual({ text: '[sigh] ', caret: 7 });
  });

  it('adds a leading space when the caret follows a word', () => {
    expect(insertAt('Hello', 5, '[sigh]')).toEqual({
      text: 'Hello [sigh] ',
      caret: 13,
    });
  });

  it('does not double the space when one already precedes the caret', () => {
    expect(insertAt('Hello ', 6, '[sigh]')).toEqual({
      text: 'Hello [sigh] ',
      caret: 13,
    });
  });

  it('splices into the middle of existing text', () => {
    const result = insertAt('ab cd', 2, '[sigh]');
    expect(result.text).toBe('ab [sigh]  cd');
  });

  it('clamps an out-of-range caret to the end', () => {
    expect(insertAt('ab', 99, '[sigh]').text).toBe('ab [sigh] ');
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

`tagText.ts` was written in Task 23. Run:

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/lib/tagText.test.ts
```

Expected: `8 passed`. If any fail, fix `tagText.ts` — the tests define the contract.

- [ ] **Step 3: Write `frontend/src/features/chat/chat.css`**

```css
.vx-chat {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr;
  gap: var(--gap-2);
  height: 100%;
  min-height: 0;
}
.vx-chat__rail {
  display: flex;
  flex-direction: column;
  gap: var(--gap-1);
  min-height: 0;
}
.vx-chat__cards {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-1);
}
.vx-chat__log {
  display: flex;
  flex-direction: column;
  gap: var(--gap-2);
  min-height: 0;
  overflow-y: auto;
  padding-right: var(--gap-1);
}
.vx-turn {
  display: flex;
  flex-direction: column;
  gap: var(--gap-1);
}
.vx-turn[data-active='true'] {
  animation: vx-pulse-accent 600ms var(--step-2) infinite;
}
.vx-turn__text {
  font-size: var(--fs-md);
  line-height: var(--lh);
  white-space: pre-wrap;
  word-break: break-word;
  padding: var(--gap-1);
  background: var(--c-panel-lo);
  box-shadow: inset 0 0 0 var(--px) var(--c-line-dim);
}
.vx-turn__tag {
  color: var(--c-magic);
}
.vx-turn__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-1);
  font-size: var(--fs-xs);
  color: var(--c-line-dim);
}
.vx-editor {
  display: grid;
  grid-template-columns: 1fr minmax(160px, 220px);
  gap: var(--gap-2);
  min-height: 0;
}
.vx-editor__main {
  display: flex;
  flex-direction: column;
  gap: var(--gap-1);
  min-width: 0;
}
.vx-editor__side {
  display: flex;
  flex-direction: column;
  gap: var(--gap-1);
  min-height: 0;
  overflow-y: auto;
}
.vx-tagpanel__group {
  margin-bottom: var(--gap-1);
}
.vx-tagpanel__label {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--c-line-dim);
  margin-bottom: calc(var(--px));
}
.vx-tagpanel__grid {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--px));
}
.vx-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--gap-2);
  max-height: 50vh;
  overflow-y: auto;
}
.vx-addbtn {
  position: sticky;
  bottom: 0;
}
```

- [ ] **Step 4: Write the failing test `frontend/src/features/chat/TagPanel.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVocabStore } from '@/state/vocabStore';
import { TagPanel } from './TagPanel';

const GROUPS = [
  {
    id: 'vocal',
    label: 'Vocal',
    tags: [
      { token: '[laughter]', label: 'Laugh', description: 'Audible laughter.', hotkey: '1' },
      { token: '[sigh]', label: 'Sigh', description: 'Audible exhaled sigh.', hotkey: '2' },
    ],
  },
  {
    id: 'surprise',
    label: 'Surprise',
    tags: [
      { token: '[surprise-ah]', label: 'Ah!', description: 'Surprised ah.', hotkey: 'A' },
    ],
  },
];

beforeEach(() => {
  useVocabStore.setState({
    tagGroups: GROUPS,
    vocab: {
      genders: [], ages: [], pitches: [], styles: [],
      accents: [], dialects: [], moods: [], intensities: [],
    },
    engine: null,
    loaded: true,
  });
});

describe('TagPanel', () => {
  it('renders every group heading', () => {
    render(<TagPanel onInsert={() => {}} />);
    expect(screen.getByText('Vocal')).toBeInTheDocument();
    expect(screen.getByText('Surprise')).toBeInTheDocument();
  });

  it('renders one button per tag showing its label', () => {
    render(<TagPanel onInsert={() => {}} />);
    expect(screen.getByRole('button', { name: /Laugh/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ah!/ })).toBeInTheDocument();
  });

  it('emits the token on click', async () => {
    const onInsert = vi.fn();
    render(<TagPanel onInsert={onInsert} />);
    await userEvent.click(screen.getByRole('button', { name: /Laugh/ }));
    expect(onInsert).toHaveBeenCalledWith('[laughter]');
  });

  it('exposes the hotkey and description as the title', () => {
    render(<TagPanel onInsert={() => {}} />);
    expect(screen.getByRole('button', { name: /Sigh/ })).toHaveAttribute(
      'title',
      'Audible exhaled sigh. (Alt+2)',
    );
  });

  it('inserts on Alt+hotkey', async () => {
    const onInsert = vi.fn();
    render(<TagPanel onInsert={onInsert} />);
    await userEvent.keyboard('{Alt>}2{/Alt}');
    expect(onInsert).toHaveBeenCalledWith('[sigh]');
  });

  it('ignores hotkeys when disabled', async () => {
    const onInsert = vi.fn();
    render(<TagPanel onInsert={onInsert} disabled />);
    await userEvent.keyboard('{Alt>}2{/Alt}');
    expect(onInsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/chat/TagPanel.test.tsx
```

Expected: FAIL — cannot resolve `./TagPanel`.

- [ ] **Step 6: Write `frontend/src/features/chat/TagPanel.tsx`**

```tsx
import { useEffect } from 'react';
import { useVocabStore } from '@/state/vocabStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import './chat.css';

export interface TagPanelProps {
  onInsert: (token: string) => void;
  disabled?: boolean;
}

export function TagPanel({ onInsert, disabled = false }: TagPanelProps) {
  const tagGroups = useVocabStore((state) => state.tagGroups);

  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const pressed = event.key.toUpperCase();
      for (const group of tagGroups) {
        for (const tag of group.tags) {
          if (tag.hotkey.toUpperCase() === pressed) {
            event.preventDefault();
            onInsert(tag.token);
            return;
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tagGroups, onInsert, disabled]);

  return (
    <PixelPanel title="Tags" variant="sunken">
      {tagGroups.map((group) => (
        <div key={group.id} className="vx-tagpanel__group">
          <div className="vx-tagpanel__label">{group.label}</div>
          <div className="vx-tagpanel__grid">
            {group.tags.map((tag) => (
              <PixelButton
                key={tag.token}
                size="sm"
                disabled={disabled}
                title={`${tag.description} (Alt+${tag.hotkey})`}
                onClick={() => onInsert(tag.token)}
              >
                {tag.label}
              </PixelButton>
            ))}
          </div>
        </div>
      ))}
    </PixelPanel>
  );
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/chat/TagPanel.test.tsx src/lib/tagText.test.ts
```

Expected: `14 passed`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/chat frontend/src/lib && git commit -m "feat(frontend): add tag insertion helpers and hotkey panel"
```

---

## Task 25: TurnEditor window

The editor from the second mockup: expanding text area, the fixed tag hotkey panel on the right, fine-tune sliders, an audio preview transport, and Render.

**Files:**
- Create: `frontend/src/features/chat/TurnEditor.tsx`
- Test: `frontend/src/features/chat/TurnEditor.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/features/chat/TurnEditor.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Profile, Turn } from '@/api/types';
import { useVocabStore } from '@/state/vocabStore';
import { TurnEditor } from './TurnEditor';

const PROFILE: Profile = {
  id: 'p1', name: 'Ivy', createdAt: 'x', updatedAt: 'x', portraitUrl: null,
  card: { shortName: 'Ivy', tagline: '', accentColor: '#f2c14e' },
  voiceMode: 'auto',
  voice: { gender: '', age: '', pitch: '', style: '', accent: '',
           dialect: '', mood: '', intensity: 2, extra: [] },
  params: { numStep: 32, speed: 1, duration: null },
  samples: [], activeSampleId: null,
  narrative: { description: '', background: '' },
  customTags: [], archive: [],
};

const TURN: Turn = {
  id: 't1', profileId: 'p1', text: '',
  params: { numStep: 32, speed: 1, duration: null },
  voiceOverride: null, status: 'draft', audio: null,
  createdAt: 'x', updatedAt: 'x',
};

beforeEach(() => {
  vi.restoreAllMocks();
  useVocabStore.setState({
    tagGroups: [
      { id: 'vocal', label: 'Vocal',
        tags: [{ token: '[sigh]', label: 'Sigh', description: 'Sigh.', hotkey: '2' }] },
    ],
    vocab: {
      genders: [], ages: [], pitches: [], styles: [],
      accents: [], dialects: [], moods: [], intensities: [],
    },
    engine: null,
    loaded: true,
  });
});

function renderEditor(overrides: Partial<Parameters<typeof TurnEditor>[0]> = {}) {
  const props = {
    open: true,
    turn: TURN,
    profile: PROFILE,
    rendering: false,
    onSave: vi.fn().mockResolvedValue(undefined),
    onRender: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<TurnEditor {...props} />);
  return props;
}

describe('TurnEditor', () => {
  it('shows the character name in the title bar', () => {
    renderEditor();
    expect(screen.getByText(/Ivy/)).toBeInTheDocument();
  });

  it('types into the expanding text area', async () => {
    renderEditor();
    const area = screen.getByLabelText('Turn text');
    await userEvent.type(area, 'Hello');
    expect(area).toHaveValue('Hello');
  });

  it('inserts a tag at the caret from the tag panel', async () => {
    renderEditor();
    const area = screen.getByLabelText('Turn text') as HTMLTextAreaElement;
    await userEvent.type(area, 'Hello');
    await userEvent.click(screen.getByRole('button', { name: /Sigh/ }));
    expect(area).toHaveValue('Hello [sigh] ');
  });

  it('disables Preview and Render while the text is blank', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Render' })).toBeDisabled();
  });

  it('requests a preview with the current text and params', async () => {
    const spy = vi
      .spyOn(api, 'createPreview')
      .mockResolvedValue({ url: '/api/preview/abc', durationSec: 1.5 });
    renderEditor();
    await userEvent.type(screen.getByLabelText('Turn text'), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        profileId: 'p1',
        text: 'Hi',
        params: { numStep: 32, speed: 1, duration: null },
      }),
    );
  });

  it('loads the preview into the transport', async () => {
    vi.spyOn(api, 'createPreview').mockResolvedValue({
      url: '/api/preview/abc',
      durationSec: 1.5,
    });
    renderEditor();
    await userEvent.type(screen.getByLabelText('Turn text'), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() =>
      expect(document.querySelector('audio')).toHaveAttribute('src', '/api/preview/abc'),
    );
  });

  it('surfaces a preview error', async () => {
    vi.spyOn(api, 'createPreview').mockRejectedValue(new Error('unknown tags: [wobble]'));
    renderEditor();
    await userEvent.type(screen.getByLabelText('Turn text'), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('unknown tags: [wobble]')).toBeInTheDocument();
  });

  it('saves then renders when Render is pressed', async () => {
    const props = renderEditor();
    await userEvent.type(screen.getByLabelText('Turn text'), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Render' }));
    await waitFor(() =>
      expect(props.onSave).toHaveBeenCalledWith({
        text: 'Hi',
        params: { numStep: 32, speed: 1, duration: null },
      }),
    );
    await waitFor(() => expect(props.onRender).toHaveBeenCalled());
  });

  it('marks Render busy while a render is in flight', () => {
    renderEditor({ rendering: true, turn: { ...TURN, text: 'Hi' } });
    expect(screen.getByRole('button', { name: 'Render' })).toBeDisabled();
  });

  it('changes speed with the slider and includes it in the preview request', async () => {
    const spy = vi
      .spyOn(api, 'createPreview')
      .mockResolvedValue({ url: '/api/preview/abc', durationSec: 1 });
    renderEditor({ turn: { ...TURN, text: 'Hi' } });
    const sliders = screen.getAllByRole('slider');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(sliders.length).toBeGreaterThan(0);
    await waitFor(() => expect(spy).toHaveBeenCalled());
  });

  it('saves and closes on Save & close', async () => {
    const props = renderEditor({ turn: { ...TURN, text: 'Hi' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save & close' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/chat/TurnEditor.test.tsx
```

Expected: FAIL — cannot resolve `./TurnEditor`.

- [ ] **Step 3: Write `frontend/src/features/chat/TurnEditor.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import type { GenerationParams, Profile, Turn } from '@/api/types';
import { insertAt } from '@/lib/tagText';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelSlider } from '@/ui/primitives/PixelSlider';
import { PixelTextArea } from '@/ui/primitives/PixelTextArea';
import { PixelTransport } from '@/ui/primitives/PixelTransport';
import { PixelWindow } from '@/ui/primitives/PixelWindow';
import { TagPanel } from './TagPanel';
import './chat.css';

export interface TurnEditorProps {
  open: boolean;
  turn: Turn;
  profile: Profile;
  rendering: boolean;
  onSave: (patch: { text: string; params: GenerationParams }) => Promise<void>;
  onRender: () => Promise<void>;
  onClose: () => void;
}

export function TurnEditor({
  open,
  turn,
  profile,
  rendering,
  onSave,
  onRender,
  onClose,
}: TurnEditorProps) {
  const [text, setText] = useState(turn.text);
  const [params, setParams] = useState<GenerationParams>(turn.params);
  const [preview, setPreview] = useState<{ url: string; durationSec: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setText(turn.text);
    setParams(turn.params);
    setPreview(null);
    setError(null);
  }, [turn.id]);

  const blank = text.trim().length === 0;

  const insertToken = (token: string) => {
    const area = areaRef.current;
    const caret = area ? area.selectionStart : text.length;
    const next = insertAt(text, caret, token);
    setText(next.text);
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(next.caret, next.caret);
    });
  };

  const runPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(
        await api.createPreview({ profileId: profile.id, text: text.trim(), params }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    await onSave({ text, params });
  };

  const render = async () => {
    setError(null);
    await save();
    await onRender();
  };

  const label = profile.card.shortName || profile.name;

  return (
    <PixelWindow
      open={open}
      title={`Editing turn — ${label}`}
      onClose={onClose}
      footer={
        <>
          {error && <span className="vx-field__label">{error}</span>}
          <PixelButton
            onClick={() => {
              void save().then(onClose);
            }}
          >
            Save &amp; close
          </PixelButton>
          <PixelButton
            variant="primary"
            disabled={blank}
            busy={rendering}
            onClick={() => void render()}
          >
            Render
          </PixelButton>
        </>
      }
    >
      <div className="vx-editor">
        <div className="vx-editor__main">
          <PixelTextArea
            ref={areaRef}
            aria-label="Turn text"
            placeholder="Type what this character says..."
            value={text}
            onChange={setText}
            minRows={5}
            maxRows={20}
          />

          <PixelSlider
            label="Speed"
            min={0.5}
            max={2}
            step={0.05}
            value={params.speed}
            onChange={(speed) => setParams({ ...params, speed })}
            format={(value) => `${value.toFixed(2)}x`}
          />
          <PixelSlider
            label="Diffusion steps"
            min={16}
            max={32}
            step={1}
            value={params.numStep}
            onChange={(numStep) => setParams({ ...params, numStep })}
          />
          <PixelSlider
            label="Fixed duration"
            min={0}
            max={60}
            step={0.5}
            value={params.duration ?? 0}
            onChange={(value) =>
              setParams({ ...params, duration: value === 0 ? null : value })
            }
            format={(value) => (value === 0 ? 'auto' : `${value.toFixed(1)}s`)}
          />

          <PixelPanel title="Audio preview" variant="sunken">
            <div className="vx-chips">
              <PixelTransport
                className="vx-editor__preview"
                src={preview?.url ?? null}
                name={preview ? 'preview.wav' : 'no preview yet'}
                durationSec={preview?.durationSec ?? 0}
              />
              <PixelButton disabled={blank} busy={busy} onClick={() => void runPreview()}>
                Preview
              </PixelButton>
            </div>
          </PixelPanel>
        </div>

        <div className="vx-editor__side">
          <TagPanel onInsert={insertToken} disabled={!open} />
        </div>
      </div>
    </PixelWindow>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/chat/TurnEditor.test.tsx
```

Expected: `11 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat && git commit -m "feat(frontend): add turn editor window with preview and render"
```

---

## Task 26: RenderedTurn panel and ProfilePicker window

**Files:**
- Create: `frontend/src/features/chat/RenderedTurn.tsx`
- Create: `frontend/src/features/chat/ProfilePicker.tsx`
- Test: `frontend/src/features/chat/RenderedTurn.test.tsx`
- Test: `frontend/src/features/chat/ProfilePicker.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/features/chat/RenderedTurn.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Profile, Turn } from '@/api/types';
import { RenderedTurn } from './RenderedTurn';

const PROFILE: Profile = {
  id: 'p1', name: 'Ivy Thorn', createdAt: 'x', updatedAt: 'x', portraitUrl: null,
  card: { shortName: 'Ivy', tagline: '', accentColor: '#f2c14e' },
  voiceMode: 'auto',
  voice: { gender: '', age: '', pitch: '', style: '', accent: '',
           dialect: '', mood: '', intensity: 2, extra: [] },
  params: { numStep: 32, speed: 1, duration: null },
  samples: [], activeSampleId: null,
  narrative: { description: '', background: '' },
  customTags: [], archive: [],
};

const RENDERED: Turn = {
  id: 't1', profileId: 'p1', text: 'Hello [laughter] world',
  params: { numStep: 32, speed: 1, duration: null },
  voiceOverride: null, status: 'rendered',
  audio: { url: '/media/renders/proj1/t1.wav', filename: 't1.wav',
           durationSec: 1.5, sampleRate: 24000, renderedAt: 'x' },
  createdAt: 'x', updatedAt: 'x',
};

const DRAFT: Turn = { ...RENDERED, id: 't2', status: 'draft', audio: null };

describe('RenderedTurn', () => {
  it('shows the typed text including tags', () => {
    render(<RenderedTurn turn={RENDERED} profile={PROFILE} />);
    expect(screen.getByTestId('turn-text')).toHaveTextContent('Hello [laughter] world');
  });

  it('highlights tags in their own element', () => {
    render(<RenderedTurn turn={RENDERED} profile={PROFILE} />);
    expect(screen.getByText('[laughter]')).toHaveClass('vx-turn__tag');
  });

  it('shows the speaker name', () => {
    render(<RenderedTurn turn={RENDERED} profile={PROFILE} />);
    expect(screen.getByText('Ivy')).toBeInTheDocument();
  });

  it('renders a transport bound to the audio url', () => {
    const { container } = render(<RenderedTurn turn={RENDERED} profile={PROFILE} />);
    expect(container.querySelector('audio')).toHaveAttribute(
      'src',
      '/media/renders/proj1/t1.wav',
    );
  });

  it('labels a draft turn as not yet rendered', () => {
    render(<RenderedTurn turn={DRAFT} profile={PROFILE} />);
    expect(screen.getByText('not rendered')).toBeInTheDocument();
  });

  it('fires onEdit and onDelete', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <RenderedTurn turn={RENDERED} profile={PROFILE} onEdit={onEdit} onDelete={onDelete} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onEdit).toHaveBeenCalledWith('t1');
    expect(onDelete).toHaveBeenCalledWith('t1');
  });

  it('marks itself active for the sequencer', () => {
    render(<RenderedTurn turn={RENDERED} profile={PROFILE} active />);
    expect(screen.getByTestId('turn')).toHaveAttribute('data-active', 'true');
  });

  it('renders without a profile', () => {
    render(<RenderedTurn turn={RENDERED} profile={undefined} />);
    expect(screen.getByText('unknown speaker')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write the failing test `frontend/src/features/chat/ProfilePicker.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/api/types';
import { ProfilePicker } from './ProfilePicker';

function makeProfile(id: string, name: string): Profile {
  return {
    id, name, createdAt: 'x', updatedAt: 'x', portraitUrl: null,
    card: { shortName: name, tagline: '', accentColor: '#f2c14e' },
    voiceMode: 'auto',
    voice: { gender: '', age: '', pitch: '', style: '', accent: '',
             dialect: '', mood: '', intensity: 2, extra: [] },
    params: { numStep: 32, speed: 1, duration: null },
    samples: [], activeSampleId: null,
    narrative: { description: '', background: '' },
    customTags: [], archive: [],
  };
}

const PROFILES = [makeProfile('p1', 'Ivy'), makeProfile('p2', 'Rook')];

describe('ProfilePicker', () => {
  it('renders nothing when closed', () => {
    render(
      <ProfilePicker open={false} profiles={PROFILES} onPick={() => {}} onClose={() => {}} />,
    );
    expect(screen.queryByText('Ivy')).not.toBeInTheDocument();
  });

  it('renders one card per profile in a grid', () => {
    render(
      <ProfilePicker open profiles={PROFILES} onPick={() => {}} onClose={() => {}} />,
    );
    expect(screen.getAllByTestId('profile-card')).toHaveLength(2);
  });

  it('calls onPick with the chosen profile id', async () => {
    const onPick = vi.fn();
    render(<ProfilePicker open profiles={PROFILES} onPick={onPick} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Rook/ }));
    expect(onPick).toHaveBeenCalledWith('p2');
  });

  it('prompts when there are no profiles', () => {
    render(<ProfilePicker open profiles={[]} onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/create a character first/i)).toBeInTheDocument();
  });

  it('closes from the title bar', async () => {
    const onClose = vi.fn();
    render(<ProfilePicker open profiles={PROFILES} onPick={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /^Close/ }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/chat/RenderedTurn.test.tsx src/features/chat/ProfilePicker.test.tsx
```

Expected: FAIL — two unresolved imports.

- [ ] **Step 4: Write `frontend/src/features/chat/RenderedTurn.tsx`**

```tsx
import type { Profile, Turn } from '@/api/types';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelTransport } from '@/ui/primitives/PixelTransport';
import './chat.css';

const TAG_PATTERN = /(\[[a-z0-9]+(?:-[a-z0-9]+)*\])/g;

function highlight(text: string) {
  return text.split(TAG_PATTERN).map((part, index) =>
    TAG_PATTERN.test(part) ? (
      <span key={index} className="vx-turn__tag">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export interface RenderedTurnProps {
  turn: Turn;
  profile?: Profile;
  active?: boolean;
  volume?: number;
  onEdit?: (turnId: string) => void;
  onDelete?: (turnId: string) => void;
}

export function RenderedTurn({
  turn,
  profile,
  active = false,
  volume = 1,
  onEdit,
  onDelete,
}: RenderedTurnProps) {
  const label = profile ? profile.card.shortName || profile.name : 'unknown speaker';

  return (
    <PixelFrame
      variant="raised"
      className="vx-turn vx-anim-slide-in"
      data-testid="turn"
      data-active={active ? 'true' : 'false'}
    >
      <div className="vx-turn__head">
        <span style={{ color: profile?.card.accentColor }}>{label}</span>
        <span>
          {turn.audio ? `${turn.audio.durationSec.toFixed(2)}s` : 'not rendered'}
          {onEdit && (
            <PixelButton size="sm" variant="ghost" onClick={() => onEdit(turn.id)}>
              Edit
            </PixelButton>
          )}
          {onDelete && (
            <PixelButton size="sm" variant="danger" onClick={() => onDelete(turn.id)}>
              Delete
            </PixelButton>
          )}
        </span>
      </div>

      <div className="vx-turn__text" data-testid="turn-text">
        {highlight(turn.text)}
      </div>

      <PixelTransport
        src={turn.audio?.url ?? null}
        name={turn.audio?.filename ?? 'no audio yet'}
        durationSec={turn.audio?.durationSec ?? 0}
        volume={volume}
        downloadable={Boolean(turn.audio)}
      />
    </PixelFrame>
  );
}
```

Note: `TAG_PATTERN` carries the `g` flag, so `.test()` advances `lastIndex`. Reset it before each use — add `TAG_PATTERN.lastIndex = 0;` as the first line inside the `.map` callback body:

```tsx
  return text.split(TAG_PATTERN).map((part, index) => {
    TAG_PATTERN.lastIndex = 0;
    return TAG_PATTERN.test(part) ? (
      <span key={index} className="vx-turn__tag">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    );
  });
```

Use this second form in the file.

- [ ] **Step 5: Write `frontend/src/features/chat/ProfilePicker.tsx`**

```tsx
import type { Profile } from '@/api/types';
import { ProfileCard } from '@/features/profiles/ProfileCard';
import { PixelWindow } from '@/ui/primitives/PixelWindow';
import './chat.css';

export interface ProfilePickerProps {
  open: boolean;
  profiles: Profile[];
  onPick: (profileId: string) => void;
  onClose: () => void;
}

export function ProfilePicker({ open, profiles, onPick, onClose }: ProfilePickerProps) {
  return (
    <PixelWindow open={open} title="Choose a character" modal onClose={onClose}>
      {profiles.length === 0 ? (
        <div className="vx-empty">create a character first on the Profiles screen</div>
      ) : (
        <div className="vx-picker__grid">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              size="lg"
              onSelect={onPick}
            />
          ))}
        </div>
      )}
    </PixelWindow>
  );
}
```

- [ ] **Step 6: Run both tests to verify they pass**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/chat/RenderedTurn.test.tsx src/features/chat/ProfilePicker.test.tsx
```

Expected: `13 passed` (8 + 5).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/chat && git commit -m "feat(frontend): add rendered turn panel and profile picker"
```

---

## Task 27: Chat screen

**Files:**
- Create: `frontend/src/screens/ChatScreen.tsx`
- Test: `frontend/src/screens/ChatScreen.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/screens/ChatScreen.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Profile, Project, Turn } from '@/api/types';
import { useProfileStore } from '@/state/profileStore';
import { useProjectStore } from '@/state/projectStore';
import { useVocabStore } from '@/state/vocabStore';
import { ChatScreen } from './ChatScreen';

function makeProfile(id = 'p1', name = 'Ivy'): Profile {
  return {
    id, name, createdAt: 'x', updatedAt: 'x', portraitUrl: null,
    card: { shortName: name, tagline: '', accentColor: '#f2c14e' },
    voiceMode: 'auto',
    voice: { gender: '', age: '', pitch: '', style: '', accent: '',
             dialect: '', mood: '', intensity: 2, extra: [] },
    params: { numStep: 32, speed: 1, duration: null },
    samples: [], activeSampleId: null,
    narrative: { description: '', background: '' },
    customTags: [], archive: [],
  };
}

const TURN: Turn = {
  id: 't1', profileId: 'p1', text: 'Hello there',
  params: { numStep: 32, speed: 1, duration: null },
  voiceOverride: null, status: 'rendered',
  audio: { url: '/media/renders/proj1/t1.wav', filename: 't1.wav',
           durationSec: 1.5, sampleRate: 24000, renderedAt: 'x' },
  createdAt: 'x', updatedAt: 'x',
};

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj1', name: 'Scene 1', createdAt: 'x', updatedAt: 'x',
    participantIds: [], turns: [],
    sequencer: { mode: 'sequential', delayMs: 300, staggerMs: 0, loop: false, volume: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useVocabStore.setState({
    tagGroups: [], loaded: true, engine: null,
    vocab: { genders: [], ages: [], pitches: [], styles: [],
             accents: [], dialects: [], moods: [], intensities: [] },
  });
  useProfileStore.setState({
    profiles: [makeProfile()], selectedId: null, loading: false, error: null,
  });
  useProjectStore.setState({
    summaries: [], current: null, loading: false, error: null, renderingTurnId: null,
  });
});

describe('ChatScreen', () => {
  it('prompts to create a project when none is open', () => {
    render(<ChatScreen />);
    expect(screen.getByLabelText('New project name')).toBeInTheDocument();
  });

  it('creates a project', async () => {
    const spy = vi.spyOn(api, 'createProject').mockResolvedValue(makeProject());
    vi.spyOn(api, 'listProjects').mockResolvedValue([]);
    render(<ChatScreen />);
    await userEvent.type(screen.getByLabelText('New project name'), 'Scene 1');
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(spy).toHaveBeenCalledWith('Scene 1');
  });

  it('starts blank with an Add button in the corner', () => {
    useProjectStore.setState({ current: makeProject() });
    render(<ChatScreen />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByText(/no turns yet/i)).toBeInTheDocument();
  });

  it('opens the profile picker from Add', async () => {
    useProjectStore.setState({ current: makeProject() });
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('dialog', { name: 'Choose a character' })).toBeInTheDocument();
  });

  it('adds a turn for the picked profile and opens the editor', async () => {
    useProjectStore.setState({ current: makeProject() });
    vi.spyOn(api, 'addTurn').mockResolvedValue(
      makeProject({ participantIds: ['p1'], turns: [{ ...TURN, status: 'draft', audio: null, text: '' }] }),
    );
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('button', { name: /Ivy/ }));
    expect(await screen.findByLabelText('Turn text')).toBeInTheDocument();
  });

  it('shows participant cards in the left rail', () => {
    useProjectStore.setState({
      current: makeProject({ participantIds: ['p1'], turns: [TURN] }),
    });
    render(<ChatScreen />);
    expect(screen.getAllByTestId('profile-card').length).toBeGreaterThan(0);
  });

  it('shows rendered turns in the log with their audio', () => {
    useProjectStore.setState({
      current: makeProject({ participantIds: ['p1'], turns: [TURN] }),
    });
    const { container } = render(<ChatScreen />);
    expect(screen.getByTestId('turn-text')).toHaveTextContent('Hello there');
    expect(container.querySelector('audio')).toHaveAttribute(
      'src',
      '/media/renders/proj1/t1.wav',
    );
  });

  it('deletes a turn', async () => {
    useProjectStore.setState({
      current: makeProject({ participantIds: ['p1'], turns: [TURN] }),
    });
    const spy = vi.spyOn(api, 'deleteTurn').mockResolvedValue(makeProject());
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(spy).toHaveBeenCalledWith('proj1', 't1');
  });

  it('reopens the editor from a turn Edit button', async () => {
    useProjectStore.setState({
      current: makeProject({ participantIds: ['p1'], turns: [TURN] }),
    });
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByLabelText('Turn text')).toHaveValue('Hello there');
  });

  it('shows a store error banner', () => {
    useProjectStore.setState({ current: makeProject(), error: 'synthesis failed' });
    render(<ChatScreen />);
    expect(screen.getByText('synthesis failed')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/screens/ChatScreen.test.tsx
```

Expected: FAIL — cannot resolve `./ChatScreen`.

- [ ] **Step 3: Write `frontend/src/screens/ChatScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { GenerationParams } from '@/api/types';
import { ProfilePicker } from '@/features/chat/ProfilePicker';
import { RenderedTurn } from '@/features/chat/RenderedTurn';
import { TurnEditor } from '@/features/chat/TurnEditor';
import { ProfileCard } from '@/features/profiles/ProfileCard';
import { useProfileStore } from '@/state/profileStore';
import { useProjectStore } from '@/state/projectStore';
import { useSequencerStore } from '@/state/sequencerStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelScrollArea } from '@/ui/primitives/PixelScrollArea';
import '@/features/chat/chat.css';

export function ChatScreen() {
  const profiles = useProfileStore((state) => state.profiles);
  const byId = useProfileStore((state) => state.byId);
  const {
    current, summaries, error, renderingTurnId,
    loadSummaries, open, create, addTurn, updateTurn, deleteTurn, renderTurn, clearError,
  } = useProjectStore();
  const activeTurnIds = useSequencerStore((state) => state.activeTurnIds);

  const [projectName, setProjectName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  const editingTurn = current?.turns.find((turn) => turn.id === editingTurnId) ?? null;
  const editingProfile = editingTurn ? byId(editingTurn.profileId) : undefined;

  const pick = async (profileId: string) => {
    setPickerOpen(false);
    const turnId = await addTurn(profileId);
    if (turnId) setEditingTurnId(turnId);
  };

  if (!current) {
    return (
      <PixelFrame variant="dashed" style={{ height: '100%' }}>
        <PixelPanel title="Projects">
          <div className="vx-chips">
            <input
              className="vx-input"
              style={{ flex: 1 }}
              aria-label="New project name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
            />
            <PixelButton
              variant="primary"
              disabled={!projectName.trim()}
              onClick={() => {
                void create(projectName.trim());
                setProjectName('');
              }}
            >
              Create project
            </PixelButton>
          </div>
          <div style={{ marginTop: 'var(--gap-2)' }}>
            {summaries.length === 0 && <div className="vx-empty">no projects yet</div>}
            {summaries.map((summary) => (
              <PixelButton
                key={summary.id}
                className="vx-card"
                onClick={() => void open(summary.id)}
              >
                {summary.name} — {summary.renderedCount}/{summary.turnCount} rendered
              </PixelButton>
            ))}
          </div>
        </PixelPanel>
      </PixelFrame>
    );
  }

  return (
    <div className="vx-chat">
      <PixelFrame variant="dashed" className="vx-chat__rail">
        <PixelPanel title={current.name} variant="solid" className="vx-chat__cards">
          <PixelScrollArea style={{ flex: 1 }}>
            {current.participantIds.length === 0 && (
              <div className="vx-empty">no characters yet</div>
            )}
            <div className="vx-chat__cards">
              {current.participantIds.map((profileId) => {
                const profile = byId(profileId);
                if (!profile) return null;
                return <ProfileCard key={profileId} profile={profile} />;
              })}
            </div>
          </PixelScrollArea>
        </PixelPanel>
        <PixelButton
          className="vx-addbtn"
          variant="primary"
          size="lg"
          onClick={() => setPickerOpen(true)}
        >
          Add
        </PixelButton>
      </PixelFrame>

      <PixelFrame variant="dashed" style={{ minHeight: 0, display: 'flex' }}>
        <div className="vx-chat__log">
          {error && (
            <PixelFrame variant="accent">
              <span>{error}</span>
              <PixelButton size="sm" onClick={clearError}>
                Dismiss
              </PixelButton>
            </PixelFrame>
          )}
          {current.turns.length === 0 && (
            <div className="vx-empty">no turns yet — press Add to begin</div>
          )}
          {current.turns.map((turn) => (
            <RenderedTurn
              key={turn.id}
              turn={turn}
              profile={byId(turn.profileId)}
              active={activeTurnIds.includes(turn.id)}
              volume={current.sequencer.volume}
              onEdit={setEditingTurnId}
              onDelete={(turnId) => void deleteTurn(turnId)}
            />
          ))}
        </div>
      </PixelFrame>

      <ProfilePicker
        open={pickerOpen}
        profiles={profiles}
        onPick={(profileId) => void pick(profileId)}
        onClose={() => setPickerOpen(false)}
      />

      {editingTurn && editingProfile && (
        <TurnEditor
          open
          turn={editingTurn}
          profile={editingProfile}
          rendering={renderingTurnId === editingTurn.id}
          onSave={async (patch: { text: string; params: GenerationParams }) => {
            await updateTurn(editingTurn.id, patch);
          }}
          onRender={async () => {
            await renderTurn(editingTurn.id);
          }}
          onClose={() => setEditingTurnId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/state/sequencerStore.ts`**

`ChatScreen` reads `activeTurnIds` from it; the bar in Task 28 drives it.

```ts
import { create } from 'zustand';
import type { SequencerItem } from '@/features/sequencer/SequencerEngine';
import { SequencerEngine } from '@/features/sequencer/SequencerEngine';
import type { SequencerSettings } from '@/api/types';

interface SequencerState {
  engine: SequencerEngine;
  playing: boolean;
  index: number;
  activeTurnIds: string[];
  setItems: (items: SequencerItem[]) => void;
  applySettings: (settings: SequencerSettings) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}

export const useSequencerStore = create<SequencerState>((set, get) => {
  const engine = new SequencerEngine();
  engine.subscribe((state) =>
    set({
      playing: state.playing,
      index: state.index,
      activeTurnIds: state.activeTurnIds,
    }),
  );
  return {
    engine,
    playing: false,
    index: 0,
    activeTurnIds: [],
    setItems: (items) => get().engine.setItems(items),
    applySettings: (settings) => get().engine.setSettings(settings),
    play: () => get().engine.play(),
    pause: () => get().engine.pause(),
    stop: () => get().engine.stop(),
  };
});
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/screens/ChatScreen.test.tsx
```

Expected: `10 passed`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/screens/ChatScreen.tsx frontend/src/state/sequencerStore.ts && git commit -m "feat(frontend): add Chat screen with picker, log and editor"
```

---

## Task 28: Chat Sequencer bar

Sits directly under the main menu. Drives the `SequencerEngine` from the rendered turns of the open project and persists its settings on the project.

**Files:**
- Create: `frontend/src/features/sequencer/sequencer.css`
- Create: `frontend/src/features/sequencer/SequencerBar.tsx`
- Test: `frontend/src/features/sequencer/SequencerBar.test.tsx`

- [ ] **Step 1: Write `frontend/src/features/sequencer/sequencer.css`**

```css
.vx-seqbar {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
  flex-wrap: wrap;
  padding: var(--gap-1) var(--gap-2);
  background: var(--c-ink);
  border-bottom: var(--px) solid var(--c-line-dim);
}
.vx-seqbar[data-disabled='true'] {
  opacity: 0.45;
}
.vx-seqbar__title {
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--c-accent);
}
.vx-seqbar__group {
  display: flex;
  align-items: center;
  gap: var(--gap-1);
}
.vx-seqbar__slider {
  width: 140px;
}
.vx-seqbar__status {
  margin-left: auto;
  font-size: var(--fs-xs);
  color: var(--c-line-dim);
}
```

- [ ] **Step 2: Write the failing test `frontend/src/features/sequencer/SequencerBar.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Project, Turn } from '@/api/types';
import { useProjectStore } from '@/state/projectStore';
import { useSequencerStore } from '@/state/sequencerStore';
import { SequencerBar } from './SequencerBar';

const RENDERED: Turn = {
  id: 't1', profileId: 'p1', text: 'Hi',
  params: { numStep: 32, speed: 1, duration: null },
  voiceOverride: null, status: 'rendered',
  audio: { url: '/media/renders/proj1/t1.wav', filename: 't1.wav',
           durationSec: 1.5, sampleRate: 24000, renderedAt: 'x' },
  createdAt: 'x', updatedAt: 'x',
};

const DRAFT: Turn = { ...RENDERED, id: 't2', status: 'draft', audio: null };

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj1', name: 'Scene 1', createdAt: 'x', updatedAt: 'x',
    participantIds: ['p1'], turns: [RENDERED, DRAFT],
    sequencer: { mode: 'sequential', delayMs: 300, staggerMs: 0, loop: false, volume: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useProjectStore.setState({
    summaries: [], current: makeProject(), loading: false, error: null, renderingTurnId: null,
  });
  useSequencerStore.setState({ playing: false, index: 0, activeTurnIds: [] });
});

describe('SequencerBar', () => {
  it('renders the transport controls', () => {
    render(<SequencerBar />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('feeds only rendered turns into the engine', () => {
    const spy = vi.spyOn(useSequencerStore.getState().engine, 'setItems');
    render(<SequencerBar />);
    expect(spy).toHaveBeenCalledWith([
      { turnId: 't1', url: '/media/renders/proj1/t1.wav', durationSec: 1.5 },
    ]);
  });

  it('reports how many clips are queued', () => {
    render(<SequencerBar />);
    expect(screen.getByText('1 clip queued')).toBeInTheDocument();
  });

  it('starts playback', async () => {
    const spy = vi.spyOn(useSequencerStore.getState().engine, 'play');
    render(<SequencerBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(spy).toHaveBeenCalled();
  });

  it('swaps Play for Pause while playing', () => {
    useSequencerStore.setState({ playing: true });
    render(<SequencerBar />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('stops playback', async () => {
    const spy = vi.spyOn(useSequencerStore.getState().engine, 'stop');
    render(<SequencerBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(spy).toHaveBeenCalled();
  });

  it('switches to simultaneous mode and persists it', async () => {
    const spy = vi.spyOn(api, 'updateProject').mockResolvedValue(makeProject());
    render(<SequencerBar />);
    await userEvent.click(screen.getByRole('button', { name: 'simultaneous' }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('proj1', {
        sequencer: { mode: 'simultaneous' },
      }),
    );
  });

  it('changes the gap delay', async () => {
    const spy = vi.spyOn(api, 'updateProject').mockResolvedValue(makeProject());
    render(<SequencerBar />);
    fireEvent.change(screen.getByLabelText('Gap'), { target: { value: '900' } });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('proj1', { sequencer: { delayMs: 900 } }),
    );
  });

  it('changes the stagger', async () => {
    const spy = vi.spyOn(api, 'updateProject').mockResolvedValue(makeProject());
    render(<SequencerBar />);
    fireEvent.change(screen.getByLabelText('Stagger'), { target: { value: '250' } });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('proj1', { sequencer: { staggerMs: 250 } }),
    );
  });

  it('changes the volume', async () => {
    const spy = vi.spyOn(api, 'updateProject').mockResolvedValue(makeProject());
    render(<SequencerBar />);
    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '0.5' } });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('proj1', { sequencer: { volume: 0.5 } }),
    );
  });

  it('toggles loop', async () => {
    const spy = vi.spyOn(api, 'updateProject').mockResolvedValue(makeProject());
    render(<SequencerBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Loop' }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('proj1', { sequencer: { loop: true } }),
    );
  });

  it('disables the transport when nothing is rendered', () => {
    useProjectStore.setState({ current: makeProject({ turns: [DRAFT] }) });
    render(<SequencerBar />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('dims itself and disables Play when no project is open', () => {
    useProjectStore.setState({ current: null });
    render(<SequencerBar />);
    expect(screen.getByTestId('sequencer-bar')).toHaveAttribute('data-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/sequencer/SequencerBar.test.tsx
```

Expected: FAIL — cannot resolve `./SequencerBar`.

- [ ] **Step 4: Write `frontend/src/features/sequencer/SequencerBar.tsx`**

```tsx
import { useEffect, useMemo } from 'react';
import type { SequencerMode } from '@/api/types';
import { useProjectStore } from '@/state/projectStore';
import { useSequencerStore } from '@/state/sequencerStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelSlider } from '@/ui/primitives/PixelSlider';
import type { SequencerItem } from './SequencerEngine';
import './sequencer.css';

const MODES: SequencerMode[] = ['sequential', 'simultaneous'];

export function SequencerBar() {
  const current = useProjectStore((state) => state.current);
  const setSequencer = useProjectStore((state) => state.setSequencer);
  const { engine, playing, index, activeTurnIds } = useSequencerStore();

  const items = useMemo<SequencerItem[]>(
    () =>
      (current?.turns ?? [])
        .filter((turn) => turn.audio !== null)
        .map((turn) => ({
          turnId: turn.id,
          url: turn.audio!.url,
          durationSec: turn.audio!.durationSec,
        })),
    [current?.turns],
  );

  useEffect(() => {
    engine.setItems(items);
  }, [engine, items]);

  const settings = current?.sequencer;
  useEffect(() => {
    if (settings) engine.setSettings(settings);
  }, [engine, settings]);

  useEffect(() => () => engine.stop(), [engine]);

  const disabled = !current || items.length === 0;

  return (
    <div
      className="vx-seqbar"
      data-testid="sequencer-bar"
      data-disabled={current ? 'false' : 'true'}
    >
      <span className="vx-seqbar__title">Chat Sequencer</span>

      <div className="vx-seqbar__group">
        <PixelButton
          disabled={disabled}
          onClick={() => (playing ? engine.pause() : engine.play())}
        >
          {playing ? 'Pause' : 'Play'}
        </PixelButton>
        <PixelButton variant="ghost" disabled={disabled} onClick={() => engine.stop()}>
          Stop
        </PixelButton>
      </div>

      <div className="vx-seqbar__group">
        {MODES.map((mode) => (
          <PixelButton
            key={mode}
            size="sm"
            selected={settings?.mode === mode}
            disabled={!current}
            onClick={() => void setSequencer({ mode })}
          >
            {mode}
          </PixelButton>
        ))}
        <PixelButton
          size="sm"
          selected={settings?.loop === true}
          disabled={!current}
          onClick={() => void setSequencer({ loop: !settings?.loop })}
        >
          Loop
        </PixelButton>
      </div>

      <PixelSlider
        className="vx-seqbar__slider"
        label="Gap"
        min={0}
        max={5000}
        step={50}
        value={settings?.delayMs ?? 0}
        disabled={!current}
        onChange={(delayMs) => void setSequencer({ delayMs })}
        format={(value) => `${value}ms`}
      />
      <PixelSlider
        className="vx-seqbar__slider"
        label="Stagger"
        min={0}
        max={5000}
        step={50}
        value={settings?.staggerMs ?? 0}
        disabled={!current}
        onChange={(staggerMs) => void setSequencer({ staggerMs })}
        format={(value) => `${value}ms`}
      />
      <PixelSlider
        className="vx-seqbar__slider"
        label="Volume"
        min={0}
        max={1}
        step={0.05}
        value={settings?.volume ?? 1}
        disabled={!current}
        onChange={(volume) => void setSequencer({ volume })}
        format={(value) => `${Math.round(value * 100)}%`}
      />

      <span className="vx-seqbar__status">
        {items.length} clip{items.length === 1 ? '' : 's'} queued
        {playing && ` — playing ${index + 1}/${items.length}`}
        {activeTurnIds.length > 1 && ` (${activeTurnIds.length} at once)`}
      </span>
    </div>
  );
}
```

`PixelSlider` renders its `label` text inside a `<label htmlFor>` bound to the range input, so `getByLabelText('Gap')` resolves to the input. The label element also contains the formatted value; Testing Library matches on the accessible name, which for a `<label>`-associated input is the full label text — use `getByLabelText(/Gap/)` if an exact-match failure appears, and update the test accordingly.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/features/sequencer
```

Expected: `25 passed` (12 engine + 13 bar).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/sequencer && git commit -m "feat(frontend): add chat sequencer bar"
```

---

## Task 29: App shell, Settings and Script screens

**Files:**
- Create: `frontend/src/screens/SettingsScreen.tsx`
- Create: `frontend/src/screens/ScriptScreen.tsx`
- Modify: `frontend/src/App.tsx` (full replacement)
- Modify: `frontend/src/App.test.tsx` (full replacement)

- [ ] **Step 1: Write `frontend/src/screens/ScriptScreen.tsx`**

```tsx
import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelPanel } from '@/ui/primitives/PixelPanel';

export function ScriptScreen() {
  return (
    <PixelFrame variant="dashed" style={{ height: '100%' }}>
      <PixelPanel title="Script">
        <div className="vx-empty">
          Script import and multi-character auto-casting land in a later pass.
        </div>
      </PixelPanel>
    </PixelFrame>
  );
}
```

- [ ] **Step 2: Write `frontend/src/screens/SettingsScreen.tsx`**

```tsx
import { useEffect } from 'react';
import { useVocabStore } from '@/state/vocabStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelPanel } from '@/ui/primitives/PixelPanel';

export function SettingsScreen() {
  const { engine, refreshEngine, warmUp, tagGroups } = useVocabStore();

  useEffect(() => {
    void refreshEngine();
  }, [refreshEngine]);

  return (
    <PixelFrame variant="dashed" style={{ height: '100%', overflowY: 'auto' }}>
      <PixelPanel title="Engine">
        {engine ? (
          <div>
            <div className="vx-archive-row">
              <span>Model</span>
              <span>{engine.model}</span>
            </div>
            <div className="vx-archive-row">
              <span>Device</span>
              <span>{engine.device}</span>
            </div>
            <div className="vx-archive-row">
              <span>Precision</span>
              <span>{engine.dtype}</span>
            </div>
            <div className="vx-archive-row">
              <span>Loaded</span>
              <span data-testid="engine-loaded">{engine.loaded ? 'yes' : 'no'}</span>
            </div>
            {engine.error && (
              <div className="vx-archive-row">
                <span>Last error</span>
                <span style={{ color: 'var(--c-bad)' }}>{engine.error}</span>
              </div>
            )}
            <div className="vx-chips" style={{ marginTop: 'var(--gap-1)' }}>
              <PixelButton onClick={() => void warmUp()}>Load model now</PixelButton>
              <PixelButton variant="ghost" onClick={() => void refreshEngine()}>
                Refresh
              </PixelButton>
            </div>
          </div>
        ) : (
          <div className="vx-empty">engine status unavailable</div>
        )}
      </PixelPanel>

      <PixelPanel title="Tag vocabulary" variant="sunken">
        {tagGroups.map((group) => (
          <div key={group.id} className="vx-archive-row">
            <span>{group.label}</span>
            <span>{group.tags.map((tag) => tag.token).join(' ')}</span>
          </div>
        ))}
      </PixelPanel>

      <PixelPanel title="Pronunciation control" variant="sunken">
        <div className="vx-archive-row">
          <span>English</span>
          <span>CMU arpabet in uppercase brackets, e.g. [B EY1 S]</span>
        </div>
        <div className="vx-archive-row">
          <span>Chinese</span>
          <span>Pinyin with tone numbers, e.g. ZHE2</span>
        </div>
      </PixelPanel>
    </PixelFrame>
  );
}
```

- [ ] **Step 3: Replace `frontend/src/App.test.tsx` entirely**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import { useProfileStore } from '@/state/profileStore';
import { useProjectStore } from '@/state/projectStore';
import { useVocabStore } from '@/state/vocabStore';
import App from './App';

const VOCAB = {
  genders: [''], ages: [''], pitches: [''], styles: [''],
  accents: [''], dialects: [''], moods: [''], intensities: [''],
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, 'getTags').mockResolvedValue({ groups: [] });
  vi.spyOn(api, 'getVoiceVocab').mockResolvedValue(VOCAB);
  vi.spyOn(api, 'getEngineStatus').mockResolvedValue({
    model: 'k2-fsa/OmniVoice', device: 'cuda:0', dtype: 'float16',
    loaded: false, error: null, capabilities: ['auto', 'clone', 'design'],
  });
  vi.spyOn(api, 'listProfiles').mockResolvedValue([]);
  vi.spyOn(api, 'listProjects').mockResolvedValue([]);
  useVocabStore.setState({ tagGroups: [], vocab: VOCAB, engine: null, loaded: false });
  useProfileStore.setState({ profiles: [], selectedId: null, loading: false, error: null });
  useProjectStore.setState({
    summaries: [], current: null, loading: false, error: null, renderingTurnId: null,
  });
});

describe('App', () => {
  it('renders the four main menu entries', () => {
    render(<App />);
    for (const label of ['Profiles', 'Chat', 'Script', 'Settings']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('opens on the Profiles screen', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: 'Profiles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Characters')).toBeInTheDocument();
  });

  it('always shows the sequencer bar under the menu', () => {
    render(<App />);
    expect(screen.getByTestId('sequencer-bar')).toBeInTheDocument();
  });

  it('loads vocabulary and profiles on mount', async () => {
    render(<App />);
    await waitFor(() => expect(api.getTags).toHaveBeenCalled());
    await waitFor(() => expect(api.listProfiles).toHaveBeenCalled());
  });

  it('switches to the Chat screen', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(await screen.findByLabelText('New project name')).toBeInTheDocument();
  });

  it('switches to the Script placeholder', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Script' }));
    expect(screen.getByText(/later pass/i)).toBeInTheDocument();
  });

  it('switches to Settings and shows engine info', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(await screen.findByText('k2-fsa/OmniVoice')).toBeInTheDocument();
    expect(screen.getByTestId('engine-loaded')).toHaveTextContent('no');
  });

  it('applies the CRT overlay class to the app root', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.vx-app')).toHaveClass('vx-crt');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/App.test.tsx
```

Expected: FAIL — the placeholder `App.tsx` has no sequencer bar and no screens.

- [ ] **Step 5: Replace `frontend/src/App.tsx` entirely**

```tsx
import { useEffect, useState } from 'react';
import { SequencerBar } from '@/features/sequencer/SequencerBar';
import { ChatScreen } from '@/screens/ChatScreen';
import { ProfilesScreen } from '@/screens/ProfilesScreen';
import { ScriptScreen } from '@/screens/ScriptScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { useProfileStore } from '@/state/profileStore';
import { useVocabStore } from '@/state/vocabStore';
import { PixelTabs, type TabItem } from '@/ui/primitives/PixelTabs';

const TABS: TabItem[] = [
  { id: 'profiles', label: 'Profiles' },
  { id: 'chat', label: 'Chat' },
  { id: 'script', label: 'Script' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [screen, setScreen] = useState('profiles');
  const loadVocab = useVocabStore((state) => state.load);
  const loadProfiles = useProfileStore((state) => state.load);

  useEffect(() => {
    void loadVocab().catch(() => undefined);
    void loadProfiles();
  }, [loadVocab, loadProfiles]);

  return (
    <div className="vx-app vx-crt">
      <PixelTabs items={TABS} value={screen} onChange={setScreen} label="Main menu" />
      <SequencerBar />
      <main className="vx-screen">
        {screen === 'profiles' && <ProfilesScreen />}
        {screen === 'chat' && <ChatScreen />}
        {screen === 'script' && <ScriptScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd /c/GITHUB/VoxRox/frontend && npx vitest run src/App.test.tsx
```

Expected: `8 passed`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/screens && git commit -m "feat(frontend): wire app shell with sequencer bar and all four screens"
```

---

## Task 30: Run scripts, README and full verification

**Files:**
- Create: `run-backend.ps1`
- Create: `run-frontend.ps1`
- Create: `.claude/launch.json`
- Create: `README.md`

- [ ] **Step 1: Write `run-backend.ps1`**

```powershell
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$root\backend\.venv\Scripts\python.exe" -m uvicorn voxrox.app:app --host 127.0.0.1 --port 8000 --app-dir "$root\backend" --reload
```

- [ ] **Step 2: Write `run-frontend.ps1`**

```powershell
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$root\frontend"
npm run dev
```

- [ ] **Step 3: Write `.claude/launch.json`**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "voxrox-frontend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--prefix", "frontend"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 4: Write `README.md`**

````markdown
# VoxRox

Multi-voice TTS narration platform with a low-res pixel-RPG interface, built on
[k2-fsa/OmniVoice](https://github.com/k2-fsa/OmniVoice).

## Layout

- `backend/` — FastAPI service. Owns all state (JSON docs + media files) and the
  OmniVoice engine.
- `frontend/` — Vite + React + TypeScript UI.
- `data/` — runtime state (gitignored): profiles, projects, portraits, samples, renders.

## Setup

Backend (Python 3.11 — PyTorch has no 3.14 wheels):

```bash
py -3.11 -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -e "backend[dev]"
backend/.venv/Scripts/python -m pip install torch==2.8.0+cu128 torchaudio==2.8.0+cu128 --extra-index-url https://download.pytorch.org/whl/cu128
backend/.venv/Scripts/python -m pip install omnivoice
```

Frontend:

```bash
npm install --prefix frontend
```

## Run

Two terminals:

```bash
pwsh ./run-backend.ps1
```

```bash
pwsh ./run-frontend.ps1
```

Then open http://localhost:5173.

## Test

```bash
backend/.venv/Scripts/python -m pytest backend/tests
```

```bash
npm test --prefix frontend
```

The real-model test is opt-in and needs CUDA plus the downloaded weights:

```bash
backend/.venv/Scripts/python -m pytest backend/tests -m gpu
```

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `VOXROX_DATA_DIR` | `<repo>/data` | Where profiles, projects and media live |
| `VOXROX_DEVICE` | `cuda:0` | Torch device map for the model |
| `VOXROX_DTYPE` | `float16` | Model precision |
| `VOXROX_MODEL` | `k2-fsa/OmniVoice` | Hugging Face model id |

On a 6 GB GPU, drop **Diffusion steps** to 16 in the turn editor if you hit
out-of-memory during generation. Engine load errors surface on the Settings screen.

## Tags

The non-verbal tag vocabulary is defined once in `backend/voxrox/tags.py` and served at
`GET /api/tags`; the editor's hotkey panel is generated from it. Pronunciation control
uses CMU arpabet in uppercase brackets (`[B EY1 S]`) for English and pinyin with tone
numbers (`ZHE2`) for Chinese — these pass through untouched.
````

- [ ] **Step 5: Run the whole backend suite**

```bash
backend/.venv/Scripts/python -m pytest backend/tests -v
```

Expected: all pass, `1 deselected`.

- [ ] **Step 6: Run the whole frontend suite**

```bash
npm test --prefix frontend
```

Expected: all test files pass, 0 failures.

- [ ] **Step 7: Type-check the frontend**

```bash
npx tsc -b --pretty frontend
```

Expected: no output (success). Fix any errors before continuing — `noUnusedLocals` is on,
so remove unused imports rather than disabling the flag.

- [ ] **Step 8: Manual smoke test**

Start both servers, open http://localhost:5173, then walk this path and confirm each step:

1. **Profiles** — type a name, press **New**. The card appears in the left rail with a pop animation.
2. Select it. Upload a picture; the portrait replaces the empty square.
3. Set **Voice mode** to `design`, drag the **Gender**, **Age** and **Pitch** notched sliders. Reload the page — the values persist.
4. Upload a `.wav` in **Audio samples for cloning**. It appears in the expanding list, mode flips to `clone`, and the sample's own transport plays it back.
5. Fill in the description and background; blur each field and reload to confirm persistence.
6. **Chat** — create a project. The log is blank with **Add** in the lower corner.
7. Press **Add**. The picker window unfurls with a grid of profile cards. Pick one.
8. The card appears in the left rail and the turn editor window opens.
9. Type text. Click a tag button (and try `Alt`+its hotkey) — the token lands at the caret.
10. Press **Preview**. Audio generates and plays in the preview transport. (First generation loads the model — expect a delay of tens of seconds.)
11. Press **Render**. The editor's turn now shows in the log as a panel with only the typed text (tags highlighted) plus its own transport.
12. Go back to **Profiles** and confirm the render is listed in **Generated audio archive** with the project name.
13. Add a second turn for another character and render it.
14. In the **Chat Sequencer** bar, press **Play** — clips play in order, with the active turn pulsing. Raise **Gap** and replay to hear the delay.
15. Switch to **simultaneous**, set **Stagger** to ~400 ms, press **Play** — clips overlap.
16. Toggle **Loop**, confirm it wraps; press **Stop**.
17. **Settings** — confirm the engine reports `loaded: yes` after the first render.

- [ ] **Step 9: Commit**

```bash
git add README.md run-backend.ps1 run-frontend.ps1 .claude/launch.json && git commit -m "docs: add README and run scripts"
```

---

## Verification checklist

Every item must be confirmed by running the command and reading the output — not by
assumption.

- [ ] `backend/.venv/Scripts/python -m pytest backend/tests` — all pass
- [ ] `npm test --prefix frontend` — all pass
- [ ] `npx tsc -b frontend` — clean
- [ ] `backend/.venv/Scripts/python -m pytest backend/tests -m gpu` — passes on this GPU
- [ ] The 17-step manual smoke test above completes end to end
- [ ] `git status` is clean

---

## Deliberately out of scope for this pass

Named here so no one mistakes them for gaps:

- The **Script** screen is a placeholder (auto-casting a screenplay across profiles).
- No streaming/progressive audio — renders are whole-file.
- No batch render of a whole project in one click (per-turn only).
- No drag-to-reorder UI; the reorder API exists and is tested, but no handle is wired.
- No export of a project to a single mixed audio file.
- No undo/redo.
