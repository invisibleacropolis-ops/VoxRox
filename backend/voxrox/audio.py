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
