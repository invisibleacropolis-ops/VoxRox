from __future__ import annotations

import os
from dataclasses import asdict

from fastapi import APIRouter, Depends

from voxrox import tags, voicevocab
from voxrox.config import SAMPLE_RATE, get_settings
from voxrox.engine.base import TTSEngine
from voxrox.engine.omnivoice import get_engine
from voxrox.services.render import WAVEFORM_BUCKETS

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


@router.get("/settings")
def read_settings() -> dict:
    """Everything the Settings screen needs that only the server knows:
    where files actually land, and the fixed audio contract."""
    settings = get_settings()
    return {
        "paths": {
            "dataDir": str(settings.data_dir),
            "profiles": str(settings.profiles_dir),
            "projects": str(settings.projects_dir),
            "portraits": str(settings.portraits_dir),
            "samples": str(settings.samples_dir),
            "renders": str(settings.renders_dir),
            "previewTmp": str(settings.preview_dir),
        },
        "audio": {
            "sampleRate": SAMPLE_RATE,
            "channels": 1,
            "format": "WAV",
            "encoding": "PCM 16-bit",
            "waveformBuckets": WAVEFORM_BUCKETS,
        },
        "generation": {
            "numStepMin": 16,
            "numStepMax": 32,
            "numStepDefault": 32,
            "speedMin": 0.5,
            "speedMax": 2.0,
            "speedDefault": 1.0,
            "durationMaxSec": 120.0,
        },
        "env": {
            "VOXROX_DATA_DIR": os.environ.get("VOXROX_DATA_DIR", "(unset — repo default)"),
            "VOXROX_DEVICE": os.environ.get("VOXROX_DEVICE", "(unset — cuda:0)"),
            "VOXROX_DTYPE": os.environ.get("VOXROX_DTYPE", "(unset — float16)"),
            "VOXROX_MODEL": os.environ.get("VOXROX_MODEL", "(unset — k2-fsa/OmniVoice)"),
        },
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
