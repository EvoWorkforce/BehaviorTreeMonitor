"""In-process fake Groot2 publisher: asyncio ZMQ REP serving the aom fixtures.

Logs every request type it receives, so tests can assert what a client sent.
"""

import asyncio
import struct
from pathlib import Path
from typing import List, Optional, Set, Tuple

import zmq
import zmq.asyncio

FIXTURES = Path(__file__).parent / "fixtures"
UUID = bytes(range(16))


def _record(rel_us: int, uid: int, status: int) -> bytes:
    return rel_us.to_bytes(6, "little") + struct.pack("<HB", uid, status)


class FakeGroot2:
    def __init__(self) -> None:
        self.requests: List[Tuple[str, bytes]] = []
        self.error_on: Set[str] = set()
        self.start_epoch_us = 1760000000000000
        self._pending_transitions = _record(1000, 5, 1) + _record(2000, 5, 2)
        self._ctx = zmq.asyncio.Context()
        self._sock: Optional[zmq.asyncio.Socket] = None
        self._task: Optional[asyncio.Task] = None
        self.port = 0

    async def start(self) -> int:
        self._sock = self._ctx.socket(zmq.REP)
        self._sock.setsockopt(zmq.LINGER, 0)
        self.port = self._sock.bind_to_random_port("tcp://127.0.0.1")
        self._task = asyncio.create_task(self._serve())
        return self.port

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._sock:
            self._sock.close()
        self._ctx.term()

    def count(self, request_type: str) -> int:
        return sum(1 for t, _ in self.requests if t == request_type)

    def types(self) -> Set[str]:
        return {t for t, _ in self.requests}

    def _header(self, req_header: bytes) -> bytes:
        return req_header[:6] + UUID

    async def _serve(self) -> None:
        assert self._sock is not None
        while True:
            parts = await self._sock.recv_multipart()
            head = parts[0]
            rtype = chr(head[1])
            payload = parts[1] if len(parts) > 1 else b""
            self.requests.append((rtype, payload))
            if rtype in self.error_on:
                await self._sock.send_multipart([b"error", b"fake failure"])
                continue
            reply_head = self._header(head)
            if rtype == "T":
                body = [(FIXTURES / "aom_fulltree.xml").read_bytes()]
            elif rtype == "S":
                body = [(FIXTURES / "aom_status.bin").read_bytes()]
            elif rtype == "B":
                body = [(FIXTURES / "aom_blackboard.msgpack").read_bytes()]
            elif rtype == "r":
                if payload == b"start":
                    body = [str(self.start_epoch_us).encode("ascii")]
                else:
                    body = []
            elif rtype == "t":
                body = [self._pending_transitions]
                self._pending_transitions = b""
            else:
                body = []
            await self._sock.send_multipart([reply_head] + body)
