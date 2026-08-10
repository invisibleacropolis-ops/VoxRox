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
