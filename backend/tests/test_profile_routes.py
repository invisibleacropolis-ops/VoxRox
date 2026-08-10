def create_profile(client, **overrides):
    payload = {"name": "Ivy Thorn"}
    payload.update(overrides)
    response = client.post("/api/profiles", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_list_is_empty_initially(client):
    assert client.get("/api/profiles").json() == []


def test_create_returns_profile_with_defaults(client):
    profile = create_profile(client)
    assert profile["name"] == "Ivy Thorn"
    assert profile["voiceMode"] == "auto"
    assert profile["card"]["shortName"] == "Ivy Thorn"
    assert profile["params"]["numStep"] == 32
    assert profile["samples"] == []


def test_create_rejects_blank_name(client):
    assert client.post("/api/profiles", json={"name": "  "}).status_code == 422


def test_created_profile_appears_in_list(client):
    profile = create_profile(client)
    listed = client.get("/api/profiles").json()
    assert [p["id"] for p in listed] == [profile["id"]]


def test_get_returns_the_profile(client):
    profile = create_profile(client)
    assert client.get(f"/api/profiles/{profile['id']}").json() == profile


def test_get_missing_returns_404(client):
    assert client.get("/api/profiles/deadbeef").status_code == 404


def test_patch_merges_nested_fields_only(client):
    profile = create_profile(client)
    response = client.patch(
        f"/api/profiles/{profile['id']}",
        json={"voiceMode": "design", "voice": {"gender": "female", "pitch": "low"}},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["voiceMode"] == "design"
    assert updated["voice"]["gender"] == "female"
    assert updated["voice"]["pitch"] == "low"
    assert updated["name"] == "Ivy Thorn"
    assert updated["params"]["numStep"] == 32


def test_patch_bumps_updated_at(client):
    profile = create_profile(client)
    updated = client.patch(
        f"/api/profiles/{profile['id']}", json={"narrative": {"description": "A ranger."}}
    ).json()
    assert updated["narrative"]["description"] == "A ranger."
    assert updated["updatedAt"] >= profile["updatedAt"]


def test_patch_rejects_invalid_params(client):
    profile = create_profile(client)
    response = client.patch(f"/api/profiles/{profile['id']}", json={"params": {"speed": 9}})
    assert response.status_code == 422


def test_delete_removes_the_profile(client):
    profile = create_profile(client)
    assert client.delete(f"/api/profiles/{profile['id']}").status_code == 204
    assert client.get(f"/api/profiles/{profile['id']}").status_code == 404


def test_delete_missing_returns_404(client):
    assert client.delete("/api/profiles/deadbeef").status_code == 404


def test_instruct_preview_is_computed_from_voice(client):
    profile = create_profile(client)
    client.patch(
        f"/api/profiles/{profile['id']}",
        json={"voice": {"gender": "female", "age": "elderly", "mood": "weary", "intensity": 3}},
    )
    payload = client.get(f"/api/profiles/{profile['id']}/instruct").json()
    assert payload["instruct"] == "female, elderly, very weary"
