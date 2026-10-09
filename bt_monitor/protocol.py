"""BehaviorTree.CPP Groot2 Monitor protocol definitions"""

import math
import struct
import random
from dataclasses import dataclass
from typing import Dict, Any, List, Optional, Union

import msgpack


PROTOCOL_ID = 2


class RequestType:
    """Matches BT::Monitor::RequestType"""
    FULLTREE = ord('T')
    STATUS = ord('S')
    BLACKBOARD = ord('B')
    HOOK_INSERT = ord('I')
    HOOK_REMOVE = ord('R')
    BREAKPOINT_REACHED = ord('N')
    BREAKPOINT_UNLOCK = ord('U')
    HOOKS_DUMP = ord('D')
    REMOVE_ALL_HOOKS = ord('A')
    DISABLE_ALL_HOOKS = ord('X')
    TOGGLE_RECORDING = ord('r')
    GET_TRANSITIONS = ord('t')
    UNDEFINED = 0


class NodeStatus:
    """Node status enum"""
    IDLE = 0
    RUNNING = 1
    SUCCESS = 2
    FAILURE = 3
    SKIPPED = 4

    IDLE_FROM_SUCCESS = 10 + SUCCESS  # 12
    IDLE_FROM_FAILURE = 10 + FAILURE  # 13
    IDLE_FROM_RUNNING = 10 + RUNNING  # 11

    @staticmethod
    def to_string(status: int) -> str:
        mapping = {
            NodeStatus.IDLE: "IDLE",
            NodeStatus.RUNNING: "RUNNING",
            NodeStatus.SUCCESS: "SUCCESS",
            NodeStatus.FAILURE: "FAILURE",
            NodeStatus.SKIPPED: "SKIPPED",
            NodeStatus.IDLE_FROM_SUCCESS: "IDLE_FROM_SUCCESS",
            NodeStatus.IDLE_FROM_FAILURE: "IDLE_FROM_FAILURE",
            NodeStatus.IDLE_FROM_RUNNING: "IDLE_FROM_RUNNING",
        }
        return mapping.get(status, "UNKNOWN")


def create_request_header(request_type: int) -> bytes:
    """Build the request header (6 bytes): protocol(1) + type(1) + unique_id(4)"""
    unique_id = random.randint(0, 0xFFFFFFFF)
    return struct.pack('<BBL', PROTOCOL_ID, request_type, unique_id)


def parse_reply_header(data: bytes) -> Optional[Dict[str, Any]]:
    """Parse the reply header (22 bytes): protocol(1) + type(1) + unique_id(4) + tree_uuid(16)"""
    if len(data) < 22:
        return None
    protocol, req_type, unique_id = struct.unpack('<BBL', data[:6])
    tree_uuid = data[6:22]
    return {
        'protocol': protocol,
        'type': chr(req_type),
        'unique_id': unique_id,
        'tree_uuid': tree_uuid.hex(),
    }


def parse_status_buffer(data: bytes) -> Dict[int, int]:
    """Parse the status buffer: per node uid (2 bytes LE) + status (1 byte)"""
    statuses = {}
    offset = 0
    while offset + 3 <= len(data):
        uid = struct.unpack('<H', data[offset:offset + 2])[0]
        status = data[offset + 2]
        statuses[uid] = status
        offset += 3
    return statuses


class Groot2Error(Exception):
    """The publisher answered with an error reply, or a request was refused locally."""


def check_reply(reply: List[bytes]) -> List[bytes]:
    """Raise Groot2Error for an ``[b"error", message]`` reply, else return it unchanged."""
    if reply and reply[0] == b"error":
        message = reply[1].decode("utf-8", errors="replace") if len(reply) > 1 else ""
        raise Groot2Error(message)
    return reply


_MAX_SAFE_INT = 2**53


def _sanitise(value: Any) -> Any:
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, (bytes, bytearray)):
        return {"__bytes": bytes(value).hex()}
    if isinstance(value, int):
        return str(value) if abs(value) > _MAX_SAFE_INT else value
    if isinstance(value, float):
        if math.isnan(value):
            return "NaN"
        if math.isinf(value):
            return "Infinity" if value > 0 else "-Infinity"
        return value
    if isinstance(value, dict):
        return {str(k): _sanitise(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_sanitise(v) for v in value]
    return str(value)


def decode_blackboard(payload: bytes) -> Dict[str, Dict[str, Any]]:
    """Decode a BLACKBOARD reply payload into a JSON-safe dict keyed by instance name."""
    return _sanitise(msgpack.unpackb(payload, raw=False))


@dataclass(frozen=True)
class Transition:
    timestamp_us: int
    uid: int
    status: str


_TRANSITION_SIZE = 9


def parse_transitions(buf: bytes, start_epoch_us: int) -> List[Transition]:
    """Parse GET_TRANSITIONS records: 6-byte LE microseconds, u16 LE uid, u8 status."""
    result = []
    for offset in range(0, len(buf) - _TRANSITION_SIZE + 1, _TRANSITION_SIZE):
        rel = int.from_bytes(buf[offset:offset + 6], "little")
        uid, status = struct.unpack_from("<HB", buf, offset + 6)
        result.append(Transition(start_epoch_us + rel, uid, NodeStatus.to_string(status)))
    return result


def parse_recording_start(reply: List[bytes]) -> Optional[int]:
    """Return the start epoch (microseconds) from a ``r start`` reply, None for a ``stop`` reply."""
    if len(reply) < 2 or not reply[1]:
        return None
    return int(reply[1].decode("ascii"))


READ_ONLY_REQUESTS = frozenset({
    RequestType.FULLTREE,
    RequestType.STATUS,
    RequestType.BLACKBOARD,
    RequestType.TOGGLE_RECORDING,
    RequestType.GET_TRANSITIONS,
})


def assert_read_only(request_type: Union[int, str]) -> None:
    """Raise Groot2Error unless the request type is in the read-only allow-list."""
    code = ord(request_type) if isinstance(request_type, str) else request_type
    if code not in READ_ONLY_REQUESTS:
        raise Groot2Error(f"request type {chr(code)!r} is not allowed (read-only monitor)")
