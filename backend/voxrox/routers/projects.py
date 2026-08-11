from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, field_validator

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


# Drafts intentionally accept any text, including tag-shaped tokens the engine
# does not know. Autosave writes on every keystroke pause, so a draft is often
# mid-word; render is the gate that validates (see services/render.py).


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
