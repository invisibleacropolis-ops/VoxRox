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
