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
