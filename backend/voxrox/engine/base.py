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
