"""Command line entry point: headless by default, Qt window with --window"""

import argparse
import os
import socket
import sys
from dataclasses import dataclass
from typing import Mapping, Optional, Sequence

DEFAULT_BIND = "127.0.0.1"
DEFAULT_PORT = 18080
PORT_ENV = "EVO_BTM_PORT"


@dataclass
class Options:
    bind: str
    port: int
    window: bool


def parse_args(
    argv: Optional[Sequence[str]] = None,
    env: Optional[Mapping[str, str]] = None,
) -> Options:
    env = os.environ if env is None else env
    parser = argparse.ArgumentParser(
        prog="evo-behavior-tree-monitor",
        description="Live monitor for BehaviorTree.CPP trees through the Groot2 protocol.",
    )
    parser.add_argument("--bind", default=DEFAULT_BIND,
                        help=f"address to listen on (default {DEFAULT_BIND})")
    parser.add_argument("--port", type=int, default=int(env.get(PORT_ENV, DEFAULT_PORT)),
                        help=f"port to listen on (default {DEFAULT_PORT}, env {PORT_ENV})")
    parser.add_argument("--window", action="store_true",
                        help="open a Qt window (needs the qt extra: pip install .[qt])")
    ns = parser.parse_args(argv)
    return Options(bind=ns.bind, port=ns.port, window=ns.window)


def check_port_free(bind: str, port: int) -> Optional[str]:
    """Return an error message when bind:port cannot be listened on, else None."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((bind, port))
        except OSError as e:
            return (f"Cannot listen on {bind}:{port} ({e.strerror}). "
                    f"Another monitor may be running. Choose another port with --port "
                    f"(for example --port {port + 1}).")
    return None


def main(argv: Optional[Sequence[str]] = None) -> None:
    opts = parse_args(argv)
    msg = check_port_free(opts.bind, opts.port)
    if msg:
        print(msg, file=sys.stderr)
        raise SystemExit(1)
    print(f"Evo Behavior Tree Monitor: http://{opts.bind}:{opts.port}", flush=True)
    from . import app
    if opts.window:
        app.run_window(opts.bind, opts.port)
    else:
        app.serve(opts.bind, opts.port)
