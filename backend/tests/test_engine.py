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
