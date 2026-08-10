import io

import numpy as np
import pytest
import soundfile as sf


def wav_bytes(seconds: float = 1.0) -> bytes:
    buffer = io.BytesIO()
    sf.write(buffer, np.zeros(int(24_000 * seconds), dtype=np.float32),
             24_000, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


@pytest.fixture()
def profile(engine_client):
    return engine_client.post("/api/profiles", json={"name": "Ivy"}).json()


@pytest.fixture()
def project(engine_client):
    return engine_client.post("/api/projects", json={"name": "Scene 1"}).json()


@pytest.fixture()
def turn(engine_client, project, profile):
    updated = engine_client.post(
        f"/api/projects/{project['id']}/turns",
        json={"profileId": profile["id"], "text": "Hello [laughter] world."},
    ).json()
    return updated["turns"][0]


def test_preview_returns_playable_url_and_duration(engine_client, profile):
    response = engine_client.post(
        "/api/preview",
        json={"profileId": profile["id"], "text": "Testing one two."},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["url"].startswith("/api/preview/")
    assert payload["durationSec"] == pytest.approx(1.5, abs=0.01)
    assert engine_client.get(payload["url"]).status_code == 200


def test_preview_rejects_blank_text(engine_client, profile):
    response = engine_client.post(
        "/api/preview", json={"profileId": profile["id"], "text": "   "}
    )
    assert response.status_code == 422


def test_preview_rejects_unknown_tags(engine_client, profile):
    response = engine_client.post(
        "/api/preview", json={"profileId": profile["id"], "text": "hi [wobble]"}
    )
    assert response.status_code == 422


def test_auto_mode_sends_neither_instruct_nor_reference(engine_client, profile, stub_engine):
    engine_client.post("/api/preview", json={"profileId": profile["id"], "text": "Hi"})
    request = stub_engine.requests[-1]
    assert request.instruct is None
    assert request.ref_audio is None


def test_design_mode_sends_composed_instruct(engine_client, profile, stub_engine):
    engine_client.patch(
        f"/api/profiles/{profile['id']}",
        json={"voiceMode": "design",
              "voice": {"gender": "female", "pitch": "low", "accent": "british"}},
    )
    engine_client.post("/api/preview", json={"profileId": profile["id"], "text": "Hi"})
    assert stub_engine.requests[-1].instruct == "female, low pitch, british accent"


def test_clone_mode_sends_active_sample_path_and_transcript(
    engine_client, profile, stub_engine, data_dir
):
    engine_client.post(
        f"/api/profiles/{profile['id']}/samples",
        files={"file": ("ref.wav", wav_bytes(), "audio/wav")},
        data={"transcript": "reference line"},
    )
    engine_client.post("/api/preview", json={"profileId": profile["id"], "text": "Hi"})
    request = stub_engine.requests[-1]
    assert request.ref_audio.endswith(".wav")
    assert (data_dir / "media" / "samples" / profile["id"]).exists()
    assert request.ref_text == "reference line"


def test_preview_overrides_beat_profile_params(engine_client, profile, stub_engine):
    engine_client.post(
        "/api/preview",
        json={"profileId": profile["id"], "text": "Hi",
              "params": {"numStep": 16, "speed": 1.5, "duration": 3.0}},
    )
    request = stub_engine.requests[-1]
    assert (request.num_step, request.speed, request.duration) == (16, 1.5, 3.0)


def test_render_attaches_audio_to_the_turn(engine_client, project, turn):
    response = engine_client.post(
        f"/api/projects/{project['id']}/turns/{turn['id']}/render"
    )
    assert response.status_code == 200
    updated = response.json()["turns"][0]
    assert updated["status"] == "rendered"
    assert updated["audio"]["url"] == f"/media/renders/{project['id']}/{turn['id']}.wav"
    assert updated["audio"]["sampleRate"] == 24_000
    assert updated["audio"]["durationSec"] == pytest.approx(1.5, abs=0.01)


def test_render_writes_the_file(engine_client, project, turn, data_dir):
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    path = data_dir / "media" / "renders" / project["id"] / f"{turn['id']}.wav"
    assert path.is_file()


def test_render_appends_an_archive_entry_to_the_profile(
    engine_client, project, turn, profile
):
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    archive = engine_client.get(f"/api/profiles/{profile['id']}").json()["archive"]
    assert len(archive) == 1
    assert archive[0]["projectId"] == project["id"]
    assert archive[0]["projectName"] == "Scene 1"
    assert archive[0]["turnId"] == turn["id"]
    assert archive[0]["text"] == "Hello [laughter] world."


def test_re_rendering_replaces_the_archive_entry(engine_client, project, turn, profile):
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    archive = engine_client.get(f"/api/profiles/{profile['id']}").json()["archive"]
    assert len(archive) == 1


def test_render_refuses_empty_turn_text(engine_client, project, profile):
    created = engine_client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile["id"]}
    ).json()
    turn_id = created["turns"][0]["id"]
    response = engine_client.post(
        f"/api/projects/{project['id']}/turns/{turn_id}/render"
    )
    assert response.status_code == 422


def test_render_uses_the_turn_params_not_the_profile(
    engine_client, project, turn, stub_engine
):
    engine_client.patch(
        f"/api/projects/{project['id']}/turns/{turn['id']}",
        json={"params": {"numStep": 16, "speed": 0.75}},
    )
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    request = stub_engine.requests[-1]
    assert (request.num_step, request.speed) == (16, 0.75)


def test_render_of_missing_turn_returns_404(engine_client, project):
    assert engine_client.post(
        f"/api/projects/{project['id']}/turns/ghost/render"
    ).status_code == 404


def test_turn_voice_override_wins_over_profile_voice(
    engine_client, project, turn, profile, stub_engine
):
    engine_client.patch(f"/api/profiles/{profile['id']}", json={"voiceMode": "design"})
    engine_client.patch(
        f"/api/projects/{project['id']}/turns/{turn['id']}",
        json={"voiceOverride": {"gender": "male", "mood": "angry", "intensity": 4}},
    )
    engine_client.post(f"/api/projects/{project['id']}/turns/{turn['id']}/render")
    assert stub_engine.requests[-1].instruct == "male, extremely angry"
