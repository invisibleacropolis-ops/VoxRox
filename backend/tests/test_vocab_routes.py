def test_tags_route_returns_groups(client):
    response = client.get("/api/tags")
    assert response.status_code == 200
    groups = response.json()["groups"]
    assert [g["id"] for g in groups] == [
        "vocal", "response", "question", "surprise", "dissatisfaction",
    ]
    assert groups[0]["tags"][0]["token"] == "[laughter]"
    assert groups[0]["tags"][0]["hotkey"] == "1"


def test_voice_vocab_route_returns_scales(client):
    payload = client.get("/api/voice-vocab").json()
    assert payload["genders"] == ["", "male", "female"]
    assert payload["ages"][1] == "child"
    assert payload["pitches"][-1] == "very high"
    assert payload["intensities"] == ["faintly", "slightly", "", "very", "extremely"]
    assert "whisper" in payload["styles"]


def test_engine_status_route_reports_unloaded_engine(client):
    payload = client.get("/api/engine/status").json()
    assert payload["loaded"] is False
    assert payload["model"] == "k2-fsa/OmniVoice"
    assert payload["capabilities"] == ["auto", "clone", "design"]
