import socket
import sys

import pytest

from bt_monitor import cli


def test_defaults():
    o = cli.parse_args([], {})
    assert (o.bind, o.port, o.window) == ("127.0.0.1", 18080, False)


def test_env_port():
    assert cli.parse_args([], {"EVO_BTM_PORT": "19000"}).port == 19000
    assert cli.parse_args(["--port", "19001"], {"EVO_BTM_PORT": "19000"}).port == 19001


def test_window_flag():
    assert cli.parse_args(["--window"], {}).window is True


def test_port_busy_message():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    s.listen()
    port = s.getsockname()[1]
    try:
        msg = cli.check_port_free("127.0.0.1", port)
    finally:
        s.close()
    assert msg is not None
    assert "--port" in msg and str(port) in msg
    assert cli.check_port_free("127.0.0.1", port) is None


def test_window_without_qt(monkeypatch):
    from bt_monitor import app

    monkeypatch.setitem(sys.modules, "PySide6", None)
    monkeypatch.delitem(sys.modules, "PySide6.QtWidgets", raising=False)
    with pytest.raises(SystemExit) as e:
        app.run_window("127.0.0.1", 18080, "/nonexistent")
    assert "pip install .[qt]" in str(e.value)


def test_dirs_default_empty():
    o = cli.parse_args([], {})
    assert (o.tree_dirs, o.edit_dirs) == ((), ())


def test_dirs_from_env():
    env = {"EVO_BTM_TREE_DIRS": "/a:/b", "EVO_BTM_EDIT_DIRS": "/a::/b:"}
    o = cli.parse_args([], env)
    assert o.tree_dirs == ("/a", "/b")
    assert o.edit_dirs == ("/a", "/b")


def test_dirs_flags_replace_env():
    env = {"EVO_BTM_TREE_DIRS": "/a:/b", "EVO_BTM_EDIT_DIRS": "/a"}
    o = cli.parse_args(["--tree-dir", "/c", "--edit-dir", "/c/x"], env)
    assert o.tree_dirs == ("/c",)
    assert o.edit_dirs == ("/c/x",)


def test_edit_dir_outside_tree_dir():
    msg = cli.validate_dirs(("/a",), ("/b",))
    assert msg is not None and "/b" in msg


def test_edit_dir_inside_tree_dir():
    assert cli.validate_dirs(("/a",), ("/a/x",)) is None
