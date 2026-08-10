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
