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
