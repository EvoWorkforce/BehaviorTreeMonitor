"""Bridge wiring against the in-process fake Groot2 publisher."""

import asyncio
import json
from pathlib import Path

import pytest
import pytest_asyncio

from bt_monitor.server import Groot2WebBridge
from fake_groot2 import FakeGroot2

pytestmark = pytest.mark.asyncio

ROOT = "main_bt"


class FakeWs:
    def __init__(self):
        self.messages = []

    async def send_str(self, data: str) -> None:
        self.messages.append(json.loads(data))

    def of_type(self, kind: str):
        return [m for m in self.messages if m["type"] == kind]


@pytest_asyncio.fixture
async def fake():
    server = FakeGroot2()
    await server.start()
    yield server
    await server.stop()


@pytest_asyncio.fixture
async def bridge(fake):
    b = Groot2WebBridge()
    b.ws = FakeWs()
    b.websockets.add(b.ws)
    assert await b.connect_zmq("127.0.0.1", fake.port)
    yield b
    await b.cleanup()


async def wait_for(predicate, timeout=2.0):
    loop = asyncio.get_running_loop()
    end = loop.time() + timeout
    while loop.time() < end:
        if predicate():
            return True
        await asyncio.sleep(0.02)
    return predicate()


async def test_connect_gets_tree(bridge, fake):
    expected = (Path(__file__).parent / "fixtures" / "aom_fulltree.xml").read_text()
    assert bridge.tree_xml == expected


async def test_bb_poll_selected_instance(bridge, fake):
    bridge.start_polling()
    await bridge.set_blackboard_target("main_patrol_route")
    assert await wait_for(lambda: bridge.ws.of_type("blackboard"), 1.0)
    bb_requests = [p for t, p in fake.requests if t == "B"]
    assert bb_requests and bb_requests[0] == b"main_patrol_route"
    message = bridge.ws.of_type("blackboard")[0]
    assert isinstance(message["data"], dict)
    assert ROOT in message["data"]


async def test_bb_poll_rate(bridge, fake):
    bridge.start_polling()
    await bridge.set_blackboard_target(ROOT)
    await asyncio.sleep(2.0)
    assert 6 <= fake.count("B") <= 10
    assert fake.count("S") >= 30


async def test_no_bb_request_without_target(bridge, fake):
    bridge.start_polling()
    await asyncio.sleep(0.6)
    assert fake.count("B") == 0
    await bridge.set_blackboard_target("")
    await asyncio.sleep(0.6)
    assert fake.count("B") == 0


async def test_record_start_stop(bridge, fake):
    bridge.start_polling()
    await bridge.record_start()
    assert ("r", b"start") in fake.requests
    recording = bridge.ws.of_type("recording")
    assert recording[-1]["active"] is True
    assert recording[-1]["start_epoch_us"] == fake.start_epoch_us
    assert await wait_for(lambda: bridge.ws.of_type("transitions"), 1.0)
    first = bridge.ws.of_type("transitions")[0]["data"]
    assert first[0] == {
        "timestamp_us": fake.start_epoch_us + 1000,
        "uid": 5,
        "status": "RUNNING",
    }
    await asyncio.sleep(0.5)
    assert fake.count("t") >= 3
    await bridge.record_stop()
    assert ("r", b"stop") in fake.requests
    assert bridge.ws.of_type("recording")[-1]["active"] is False
    count = fake.count("t")
    await asyncio.sleep(0.4)
    assert fake.count("t") == count


async def test_stop_on_disconnect(bridge, fake):
    bridge.start_polling()
    await bridge.record_start()
    await bridge.disconnect_zmq()
    assert ("r", b"stop") in fake.requests


async def test_never_sends_hooks(bridge, fake):
    bridge.start_polling()
    await bridge.set_blackboard_target(ROOT)
    await bridge.record_start()
    await asyncio.sleep(0.6)
    await bridge.record_stop()
    await bridge.disconnect_zmq()
    assert fake.types() <= {"T", "S", "B", "r", "t"}


async def test_error_reply_not_disconnect(bridge, fake):
    fake.error_on.add("B")
    bridge.start_polling()
    await bridge.set_blackboard_target(ROOT)
    assert await wait_for(lambda: bridge.ws.of_type("error"), 1.0)
    await asyncio.sleep(0.8)
    assert len(bridge.ws.of_type("error")) == 1
    assert bridge.connected
    assert not bridge.ws.of_type("disconnected")


async def _start_recording_with_slow_transitions(bridge, fake):
    fake.delay_s["t"] = 0.3
    await bridge.record_start()
    assert bridge.recording
    assert await wait_for(lambda: fake.count("t") >= 1)


async def test_record_stop_while_transitions_in_flight(bridge, fake):
    await _start_recording_with_slow_transitions(bridge, fake)
    await bridge.record_stop()
    assert await wait_for(lambda: b"stop" in [p for t, p in fake.requests if t == "r"])
    before = fake.count("S")
    assert await bridge._request_status() is not None
    assert fake.count("S") == before + 1
    assert bridge.connected
    assert not bridge.ws.of_type("disconnected")


async def test_cleanup_sends_record_stop_while_in_flight(bridge, fake):
    await _start_recording_with_slow_transitions(bridge, fake)
    await bridge.cleanup()
    assert b"stop" in [p for t, p in fake.requests if t == "r"]
