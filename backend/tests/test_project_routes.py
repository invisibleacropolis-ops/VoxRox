import pytest


@pytest.fixture()
def profile_id(client):
    return client.post("/api/profiles", json={"name": "Ivy"}).json()["id"]


@pytest.fixture()
def project(client):
    response = client.post("/api/projects", json={"name": "Scene 1"})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_project_has_defaults(client, project):
    assert project["name"] == "Scene 1"
    assert project["turns"] == []
    assert project["participantIds"] == []
    assert project["sequencer"] == {
        "mode": "sequential", "delayMs": 300, "staggerMs": 0,
        "loop": False, "volume": 1.0,
    }


def test_create_rejects_blank_name(client):
    assert client.post("/api/projects", json={"name": " "}).status_code == 422


def test_list_projects_returns_summaries_without_turns(client, project):
    listed = client.get("/api/projects").json()
    assert listed == [{
        "id": project["id"], "name": "Scene 1",
        "createdAt": project["createdAt"], "updatedAt": project["updatedAt"],
        "turnCount": 0, "renderedCount": 0,
        "participantIds": [],
    }]


def test_add_turn_registers_participant(client, project, profile_id):
    response = client.post(
        f"/api/projects/{project['id']}/turns",
        json={"profileId": profile_id, "text": "Hello there."},
    )
    assert response.status_code == 201
    updated = response.json()
    assert len(updated["turns"]) == 1
    assert updated["turns"][0]["status"] == "draft"
    assert updated["turns"][0]["audio"] is None
    assert updated["participantIds"] == [profile_id]


def test_add_turn_with_unknown_profile_returns_404(client, project):
    response = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": "ghost", "text": "hi"}
    )
    assert response.status_code == 404


def test_adding_second_turn_for_same_profile_keeps_one_participant(client, project, profile_id):
    client.post(f"/api/projects/{project['id']}/turns", json={"profileId": profile_id})
    updated = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()
    assert updated["participantIds"] == [profile_id]
    assert len(updated["turns"]) == 2


def test_patch_turn_updates_text_and_params(client, project, profile_id):
    created = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()
    turn_id = created["turns"][0]["id"]
    updated = client.patch(
        f"/api/projects/{project['id']}/turns/{turn_id}",
        json={"text": "Line [sigh] two", "params": {"speed": 1.2}},
    ).json()
    turn = updated["turns"][0]
    assert turn["text"] == "Line [sigh] two"
    assert turn["params"]["speed"] == 1.2
    assert turn["params"]["numStep"] == 32


def test_patch_turn_rejects_unknown_tags(client, project, profile_id):
    created = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()
    turn_id = created["turns"][0]["id"]
    response = client.patch(
        f"/api/projects/{project['id']}/turns/{turn_id}", json={"text": "hi [wobble]"}
    )
    assert response.status_code == 422
    assert "[wobble]" in response.json()["detail"]


def test_delete_turn_removes_it_and_drops_orphan_participant(client, project, profile_id):
    created = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()
    turn_id = created["turns"][0]["id"]
    updated = client.delete(f"/api/projects/{project['id']}/turns/{turn_id}").json()
    assert updated["turns"] == []
    assert updated["participantIds"] == []


def test_reorder_turns(client, project, profile_id):
    first = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()["turns"][0]["id"]
    second = client.post(
        f"/api/projects/{project['id']}/turns", json={"profileId": profile_id}
    ).json()["turns"][1]["id"]
    updated = client.post(
        f"/api/projects/{project['id']}/reorder", json={"turnIds": [second, first]}
    ).json()
    assert [t["id"] for t in updated["turns"]] == [second, first]


def test_reorder_rejects_mismatched_id_set(client, project, profile_id):
    client.post(f"/api/projects/{project['id']}/turns", json={"profileId": profile_id})
    response = client.post(
        f"/api/projects/{project['id']}/reorder", json={"turnIds": ["bogus"]}
    )
    assert response.status_code == 422


def test_patch_project_updates_sequencer_settings(client, project):
    updated = client.patch(
        f"/api/projects/{project['id']}",
        json={"sequencer": {"mode": "simultaneous", "delayMs": 750, "loop": True}},
    ).json()
    assert updated["sequencer"]["mode"] == "simultaneous"
    assert updated["sequencer"]["delayMs"] == 750
    assert updated["sequencer"]["loop"] is True
    assert updated["sequencer"]["volume"] == 1.0


def test_delete_project(client, project):
    assert client.delete(f"/api/projects/{project['id']}").status_code == 204
    assert client.get(f"/api/projects/{project['id']}").status_code == 404
