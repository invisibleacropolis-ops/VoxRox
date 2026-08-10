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
