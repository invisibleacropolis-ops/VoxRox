import numpy as np
import pytest

from voxrox.audio import compute_peaks, probe_duration, write_wav


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


def test_compute_peaks_returns_the_requested_bucket_count():
    samples = np.sin(np.linspace(0, 100, 48_000)).astype(np.float32)
    assert len(compute_peaks(samples, buckets=64)) == 64


def test_compute_peaks_are_normalised_to_unit_range():
    samples = (np.random.default_rng(0).random(24_000) * 0.2 - 0.1).astype(np.float32)
    peaks = compute_peaks(samples, buckets=32)
    assert max(peaks) == pytest.approx(1.0, abs=1e-6)
    assert all(0.0 <= p <= 1.0 for p in peaks)


def test_compute_peaks_tracks_loudness_shape():
    quiet = np.full(12_000, 0.05, dtype=np.float32)
    loud = np.full(12_000, 0.9, dtype=np.float32)
    peaks = compute_peaks(np.concatenate([quiet, loud]), buckets=4)
    assert peaks[0] < 0.2
    assert peaks[-1] == pytest.approx(1.0, abs=1e-6)


def test_compute_peaks_of_silence_is_all_zero():
    assert compute_peaks(np.zeros(4_800, dtype=np.float32), buckets=8) == [0.0] * 8


def test_compute_peaks_handles_fewer_samples_than_buckets():
    peaks = compute_peaks(np.array([0.5, -1.0, 0.25], dtype=np.float32), buckets=8)
    assert len(peaks) == 8
    assert max(peaks) == pytest.approx(1.0, abs=1e-6)


def test_compute_peaks_of_empty_audio_is_empty():
    assert compute_peaks(np.zeros(0, dtype=np.float32), buckets=8) == []


def test_compute_peaks_values_are_rounded_floats():
    peaks = compute_peaks(np.sin(np.linspace(0, 50, 9_600)).astype(np.float32), buckets=16)
    assert all(isinstance(p, float) for p in peaks)
    assert all(p == round(p, 4) for p in peaks)
