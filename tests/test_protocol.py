"""Tests for Groot2 protocol decoding (pure functions, no sockets)."""

import json
import struct
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from bt_monitor.protocol import (
    READ_ONLY_REQUESTS,
    Groot2Error,
    RequestType,
    assert_read_only,
    check_reply,
    decode_blackboard,
    parse_recording_start,
    parse_status_buffer,
    parse_transitions,
)

FIXTURES = Path(__file__).parent / "fixtures"


def test_status_fixture():
    statuses = parse_status_buffer((FIXTURES / "aom_status.bin").read_bytes())
    root = ET.fromstring((FIXTURES / "aom_fulltree.xml").read_text(encoding="utf-8"))
    uids = {int(el.get("_uid")) for el in root.iter() if el.get("_uid") is not None}
    assert uids
    assert set(statuses) == uids


def test_error_reply():
    with pytest.raises(Groot2Error, match="msg"):
        check_reply([b"error", b"msg"])


def test_decode_blackboard_fixture():
    maps = decode_blackboard((FIXTURES / "aom_blackboard.msgpack").read_bytes())
    assert "main_bt" in maps
    assert isinstance(maps["main_bt"]["battery_soc"], float)
    json.dumps(maps, allow_nan=False)


def test_decode_blackboard_sanitises():
    import msgpack

    raw = msgpack.packb(
        {
            "inst": {
                "b": b"\x01\xab",
                "nan": float("nan"),
                "inf": float("inf"),
                "ninf": float("-inf"),
                "big": 2**60,
                "small": 5,
                "nested": [b"\xff", {"x": float("nan")}],
            }
        }
    )
    out = decode_blackboard(raw)["inst"]
    assert out["b"] == {"__bytes": "01ab"}
    assert out["nan"] == "NaN"
    assert out["inf"] == "Infinity"
    assert out["ninf"] == "-Infinity"
    assert out["big"] == str(2**60)
    assert out["small"] == 5
    assert out["nested"] == [{"__bytes": "ff"}, {"x": "NaN"}]
    json.dumps(out, allow_nan=False)


def _record(t_us: int, uid: int, status: int) -> bytes:
    return t_us.to_bytes(6, "little") + struct.pack("<HB", uid, status)


def test_parse_transitions():
    buf = _record(1000, 7, 1) + _record(2500, 9, 2) + b"\x01\x02\x03"
    start = 1_760_000_000_000_000
    result = parse_transitions(buf, start)
    assert len(result) == 2
    assert result[0].timestamp_us == start + 1000
    assert result[0].uid == 7
    assert result[0].status == "RUNNING"
    assert result[1].timestamp_us == start + 2500
    assert result[1].uid == 9
    assert result[1].status == "SUCCESS"


def test_parse_transitions_empty():
    assert parse_transitions(b"", 123) == []


def test_recording_start():
    assert parse_recording_start([b"\x00" * 22, b"1760000000000000"]) == 1760000000000000
    assert parse_recording_start([b"\x00" * 22]) is None


def test_read_only_allow_list():
    assert READ_ONLY_REQUESTS == {
        RequestType.FULLTREE,
        RequestType.STATUS,
        RequestType.BLACKBOARD,
        RequestType.TOGGLE_RECORDING,
        RequestType.GET_TRANSITIONS,
    }
    for ch in "TSBrt":
        assert_read_only(ord(ch))
    for ch in "IRNUDAX":
        with pytest.raises(Groot2Error):
            assert_read_only(ord(ch))
    with pytest.raises(Groot2Error):
        assert_read_only("I")
