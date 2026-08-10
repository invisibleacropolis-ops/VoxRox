import io

import numpy as np
import soundfile as sf

PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c6300010000050001"
    "0d0a2db40000000049454e44ae426082"
)


def wav_bytes(seconds: float = 1.0) -> bytes:
    buffer = io.BytesIO()
    sf.write(buffer, np.zeros(int(24_000 * seconds), dtype=np.float32),
             24_000, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


def make_profile(client):
    return client.post("/api/profiles", json={"name": "Ivy"}).json()


def test_portrait_upload_sets_url_and_writes_file(client, data_dir):
    profile = make_profile(client)
    response = client.post(
        f"/api/profiles/{profile['id']}/portrait",
        files={"file": ("face.png", PNG_1X1, "image/png")},
    )
    assert response.status_code == 200
    url = response.json()["portraitUrl"]
    assert url.startswith("/media/portraits/")
    assert (data_dir / "media" / "portraits").glob("*.png")
    assert client.get(url).status_code == 200


def test_portrait_upload_rejects_non_image(client):
    profile = make_profile(client)
    response = client.post(
        f"/api/profiles/{profile['id']}/portrait",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 415


def test_sample_upload_appends_and_measures_duration(client):
    profile = make_profile(client)
    response = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("ref.wav", wav_bytes(2.0), "audio/wav")},
        data={"transcript": "A reference line."},
    )
    assert response.status_code == 201
    updated = response.json()
    assert len(updated["samples"]) == 1
    sample = updated["samples"][0]
    assert sample["transcript"] == "A reference line."
    assert 1.9 < sample["durationSec"] < 2.1
    assert sample["url"].startswith(f"/media/samples/{profile['id']}/")


def test_first_sample_becomes_active_and_switches_mode_to_clone(client):
    profile = make_profile(client)
    updated = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("ref.wav", wav_bytes(), "audio/wav")},
    ).json()
    assert updated["activeSampleId"] == updated["samples"][0]["id"]
    assert updated["voiceMode"] == "clone"


def test_second_sample_does_not_steal_active(client):
    profile = make_profile(client)
    first = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("a.wav", wav_bytes(), "audio/wav")},
    ).json()
    second = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("b.wav", wav_bytes(), "audio/wav")},
    ).json()
    assert second["activeSampleId"] == first["activeSampleId"]
    assert len(second["samples"]) == 2


def test_sample_upload_rejects_non_audio(client):
    profile = make_profile(client)
    response = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("x.png", PNG_1X1, "image/png")},
    )
    assert response.status_code == 415


def test_delete_sample_clears_active_when_it_was_active(client):
    profile = make_profile(client)
    uploaded = client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("a.wav", wav_bytes(), "audio/wav")},
    ).json()
    sample_id = uploaded["samples"][0]["id"]
    response = client.delete(f"/api/profiles/{profile['id']}/samples/{sample_id}")
    assert response.status_code == 200
    assert response.json()["samples"] == []
    assert response.json()["activeSampleId"] is None


def test_delete_missing_sample_returns_404(client):
    profile = make_profile(client)
    assert client.delete(f"/api/profiles/{profile['id']}/samples/nope").status_code == 404


def test_set_active_sample(client):
    profile = make_profile(client)
    client.post(f"/api/profiles/{profile['id']}/samples",
                files={"file": ("a.wav", wav_bytes(), "audio/wav")})
    second = client.post(f"/api/profiles/{profile['id']}/samples",
                         files={"file": ("b.wav", wav_bytes(), "audio/wav")}).json()
    target = second["samples"][1]["id"]
    updated = client.post(
        f"/api/profiles/{profile['id']}/samples/{target}/activate"
    ).json()
    assert updated["activeSampleId"] == target
