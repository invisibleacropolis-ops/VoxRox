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
