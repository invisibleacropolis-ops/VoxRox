import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("VOXROX_DATA_DIR", str(tmp_path / "data"))
    from voxrox.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    yield settings.data_dir
    get_settings.cache_clear()


@pytest.fixture()
def client(data_dir):
    from voxrox.app import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


class StubEngine:
    """Test double injected at the engine dependency seam."""

    def __init__(self):
        self.requests = []
        self.seconds = 1.5

    def status(self):
        from voxrox.engine.base import EngineStatus

        return EngineStatus(model="stub", device="cpu", dtype="float32", loaded=True)

    def load(self):
        return None

    def synthesize(self, request):
        import numpy as np

        from voxrox.engine.base import SynthesisResult

        self.requests.append(request)
        count = int(24_000 * self.seconds)
        tone = np.sin(np.linspace(0, 220 * 2 * np.pi, count)).astype("float32") * 0.2
        return SynthesisResult(samples=tone, sample_rate=24_000)


@pytest.fixture()
def stub_engine():
    return StubEngine()


@pytest.fixture()
def engine_client(data_dir, stub_engine):
    from voxrox.app import create_app
    from voxrox.routers.vocab import engine_dependency

    app = create_app()
    app.dependency_overrides[engine_dependency] = lambda: stub_engine
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
