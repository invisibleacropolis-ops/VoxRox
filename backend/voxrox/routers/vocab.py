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
