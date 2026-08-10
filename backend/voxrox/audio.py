from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf


def write_wav(path: Path | str, samples: np.ndarray, sample_rate: int) -> float:
    """Write mono float audio as 16-bit PCM WAV. Returns duration in seconds."""
    array = np.asarray(samples, dtype=np.float32).reshape(-1)
    if array.size == 0:
        raise ValueError("refusing to write empty audio")
    peak = float(np.max(np.abs(array)))
    if peak > 1.0:
        array = array / peak
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(destination), array, sample_rate, subtype="PCM_16")
    return array.size / float(sample_rate)


def probe_duration(path: Path | str) -> float:
    info = sf.info(str(path))
    return info.frames / float(info.samplerate)


def compute_peaks(samples: np.ndarray, buckets: int = 160) -> list[float]:
    """Downsample audio to `buckets` peak magnitudes normalised to 0..1.

    Drives the waveform display. Peak (not RMS) so plosives and transients stay
    visible at small widths, which is what makes a waveform readable as speech.
    """
    array = np.asarray(samples, dtype=np.float32).reshape(-1)
    if array.size == 0:
        return []
    magnitude = np.abs(array)
    # Pad to a whole number of buckets so every bar covers the same span.
    per_bucket = int(np.ceil(magnitude.size / buckets))
    padded = np.pad(magnitude, (0, per_bucket * buckets - magnitude.size))
    peaks = padded.reshape(buckets, per_bucket).max(axis=1)
    ceiling = float(peaks.max())
    if ceiling > 0:
        peaks = peaks / ceiling
    return [round(float(value), 4) for value in peaks]
