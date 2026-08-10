import pytest

from voxrox.storage import JsonStore, NotFoundError


@pytest.fixture()
def store(tmp_path):
    return JsonStore(tmp_path / "things")


def test_write_then_read_roundtrips(store):
    store.write("abc", {"name": "Ivy", "n": 3})
    assert store.read("abc") == {"name": "Ivy", "n": 3}


def test_read_missing_raises(store):
    with pytest.raises(NotFoundError):
        store.read("nope")


def test_exists_reflects_writes_and_deletes(store):
    assert store.exists("abc") is False
    store.write("abc", {"a": 1})
    assert store.exists("abc") is True
    store.delete("abc")
    assert store.exists("abc") is False


def test_list_ids_is_sorted(store):
    store.write("b", {})
    store.write("a", {})
    assert store.list_ids() == ["a", "b"]


def test_read_all_returns_documents(store):
    store.write("a", {"v": 1})
    store.write("b", {"v": 2})
    assert store.read_all() == [{"v": 1}, {"v": 2}]


def test_delete_missing_raises(store):
    with pytest.raises(NotFoundError):
        store.delete("ghost")


def test_write_rejects_unsafe_ids(store):
    with pytest.raises(ValueError):
        store.write("../escape", {})


def test_write_leaves_no_temp_files(store):
    store.write("a", {"v": 1})
    assert [p.name for p in store.root.iterdir()] == ["a.json"]
