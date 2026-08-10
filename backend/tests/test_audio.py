import numpy as np
import pytest

from voxrox.audio import probe_duration, write_wav


def test_write_wav_creates_file_and_returns_duration(tmp_path):
    samples = np.zeros(24_000, dtype=np.float32)
    path = tmp_path / "out.wav"
    duration = write_wav(path, samples, 24_000)
    assert path.is_file()
    assert duration == pytest.approx(1.0, abs=0.01)


def test_write_wav_creates_missing_parent_directories(tmp_path):
    path = tmp_path / "deep" / "nested" / "out.wav"
    write_wav(path, np.zeros(2400, dtype=np.float32), 24_000)
    assert path.is_file()


def test_probe_duration_matches_written_length(tmp_path):
    path = tmp_path / "out.wav"
    write_wav(path, np.zeros(12_000, dtype=np.float32), 24_000)
    assert probe_duration(path) == pytest.approx(0.5, abs=0.01)


def test_write_wav_rejects_empty_audio(tmp_path):
    with pytest.raises(ValueError):
        write_wav(tmp_path / "out.wav", np.zeros(0, dtype=np.float32), 24_000)
