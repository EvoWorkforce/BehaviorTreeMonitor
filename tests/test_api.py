"""HTTP routes for tree files, driven through the aiohttp test client."""

import hashlib

import pytest
import pytest_asyncio
from aiohttp.test_utils import TestClient, TestServer

from bt_monitor.server import create_app

TEXT = "<root BTCPP_format=\"4\"/>\n"


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


@pytest.fixture
def dirs(tmp_path):
    view = tmp_path / "view"
    edit = tmp_path / "edit"
    view.mkdir()
    edit.mkdir()
    (view / "ro.xml").write_text(TEXT)
    (edit / "rw.xml").write_text(TEXT)
    return view, edit


async def _client(tmp_path, tree_dirs, edit_dirs):
    app = create_app(
        static_dir=str(tmp_path), tree_dirs=tree_dirs, edit_dirs=edit_dirs
    )
    client = TestClient(TestServer(app))
    await client.start_server()
    return client


@pytest_asyncio.fixture
async def client(tmp_path, dirs):
    view, edit = dirs
    c = await _client(tmp_path, [str(view), str(edit)], [str(edit)])
    yield c
    await c.close()


async def _ids(client):
    resp = await client.get("/api/trees")
    return {f["path"].rsplit("/", 1)[1]: f for f in await resp.json()}


@pytest.mark.asyncio
async def test_list(client):
    files = await _ids(client)
    assert set(files) == {"ro.xml", "rw.xml"}
    assert files["ro.xml"]["editable"] is False
    assert files["rw.xml"]["editable"] is True


@pytest.mark.asyncio
async def test_list_empty_without_dirs(tmp_path):
    c = await _client(tmp_path, [], [])
    try:
        resp = await c.get("/api/trees")
        assert resp.status == 200
        assert await resp.json() == []
    finally:
        await c.close()


@pytest.mark.asyncio
async def test_read(client):
    f = (await _ids(client))["rw.xml"]
    resp = await client.get(f"/api/trees/{f['id']}")
    assert resp.status == 200
    body = await resp.json()
    assert body["text"] == TEXT
    assert body["sha256"] == _sha(TEXT)


@pytest.mark.asyncio
async def test_read_unknown_404(client):
    resp = await client.get("/api/trees/nope")
    assert resp.status == 404


@pytest.mark.asyncio
async def test_put_not_editable_403(client, dirs):
    f = (await _ids(client))["ro.xml"]
    resp = await client.put(
        f"/api/trees/{f['id']}", json={"text": "x", "base_sha256": _sha(TEXT)}
    )
    assert resp.status == 403
    assert (dirs[0] / "ro.xml").read_text() == TEXT


@pytest.mark.asyncio
async def test_put_conflict_409(client, dirs):
    f = (await _ids(client))["rw.xml"]
    resp = await client.put(
        f"/api/trees/{f['id']}", json={"text": "x", "base_sha256": "stale"}
    )
    assert resp.status == 409
    assert (await resp.json())["sha256"] == _sha(TEXT)
    assert (dirs[1] / "rw.xml").read_text() == TEXT


@pytest.mark.asyncio
async def test_put_ok(client, dirs):
    f = (await _ids(client))["rw.xml"]
    new = "<root>new</root>\n"
    resp = await client.put(
        f"/api/trees/{f['id']}", json={"text": new, "base_sha256": _sha(TEXT)}
    )
    assert resp.status == 200
    assert (await resp.json())["sha256"] == _sha(new)
    assert (dirs[1] / "rw.xml").read_text() == new
