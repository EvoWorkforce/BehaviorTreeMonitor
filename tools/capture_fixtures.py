"""Capture Groot2 replies from a live BehaviorTree.CPP publisher as test fixtures.

Read-only: sends only T, S, B, r and t requests.

Usage:
    python tools/capture_fixtures.py --host 127.0.0.1 --port 1667 --out tests/fixtures
"""

import argparse
import random
import struct
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import zmq

PROTOCOL_ID = 2
HEADER_LEN = 22


def header(request_type: str) -> bytes:
    return struct.pack("<BBL", PROTOCOL_ID, ord(request_type), random.randint(0, 0xFFFFFFFF))


def request(sock: zmq.Socket, request_type: str, payload: bytes = b"") -> list:
    parts = [header(request_type)]
    if payload:
        parts.append(payload)
    sock.send_multipart(parts)
    reply = sock.recv_multipart()
    if reply and reply[0] == b"error":
        raise RuntimeError(f"{request_type!r} failed: {reply[1:]!r}")
    if not reply or len(reply[0]) < HEADER_LEN:
        raise RuntimeError(f"{request_type!r}: bad reply header: {reply!r}")
    return reply


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=1667)
    ap.add_argument("--out", default="tests/fixtures")
    ap.add_argument("--record-seconds", type=float, default=3.0)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    ctx = zmq.Context()
    sock = ctx.socket(zmq.REQ)
    sock.setsockopt(zmq.LINGER, 0)
    sock.setsockopt(zmq.RCVTIMEO, 6000)
    sock.setsockopt(zmq.SNDTIMEO, 3000)
    sock.connect(f"tcp://{args.host}:{args.port}")

    tree = request(sock, "T")[1]
    (out / "aom_fulltree.xml").write_bytes(tree)
    root = ET.fromstring(tree.decode("utf-8"))
    blocks = [bt.get("_fullpath") for bt in root.iter("BehaviorTree")]
    names = [n for n in blocks if n is not None]
    print(f"BehaviorTree blocks: {len(blocks)}, with _fullpath: {len(names)}")

    (out / "aom_status.bin").write_bytes(request(sock, "S")[1])

    bb = request(sock, "B", ";".join(names).encode("utf-8"))
    (out / "aom_blackboard.msgpack").write_bytes(bb[1])

    start = request(sock, "r", b"start")
    (out / "aom_recording_start.txt").write_bytes(start[1] if len(start) > 1 else b"")
    time.sleep(args.record_seconds)
    transitions = request(sock, "t")
    (out / "aom_transitions.bin").write_bytes(transitions[1] if len(transitions) > 1 else b"")
    request(sock, "r", b"stop")

    print(f"wrote fixtures to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
