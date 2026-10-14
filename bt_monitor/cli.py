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
TREE_DIRS_ENV = "EVO_BTM_TREE_DIRS"
EDIT_DIRS_ENV = "EVO_BTM_EDIT_DIRS"


@dataclass
class Options:
    bind: str
    port: int
    window: bool
    tree_dirs: tuple[str, ...] = ()
    edit_dirs: tuple[str, ...] = ()


def _split_dirs(value: str) -> tuple[str, ...]:
    return tuple(p for p in value.split(":") if p)


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
    parser.add_argument("--tree-dir", action="append",
                        help=f"folder of behaviour tree files to browse; repeatable (env {TREE_DIRS_ENV}, ':' separated)")
    parser.add_argument("--edit-dir", action="append",
                        help=f"folder inside a tree dir whose files may be edited; repeatable (env {EDIT_DIRS_ENV}, ':' separated)")
    ns = parser.parse_args(argv)
    tree_dirs = tuple(p for p in ns.tree_dir if p) if ns.tree_dir else _split_dirs(env.get(TREE_DIRS_ENV, ""))
    edit_dirs = tuple(p for p in ns.edit_dir if p) if ns.edit_dir else _split_dirs(env.get(EDIT_DIRS_ENV, ""))
    return Options(bind=ns.bind, port=ns.port, window=ns.window,
                   tree_dirs=tree_dirs, edit_dirs=edit_dirs)


def validate_dirs(tree_dirs: Sequence[str], edit_dirs: Sequence[str]) -> Optional[str]:
    """Return an error message when an edit dir is not inside a tree dir, else None."""
    roots = [os.path.realpath(t) for t in tree_dirs]
    for e in edit_dirs:
        real = os.path.realpath(e)
        if not any(real == r or real.startswith(r.rstrip(os.sep) + os.sep) for r in roots):
            return f"Edit dir {e} is not inside any tree dir (--tree-dir / {TREE_DIRS_ENV})."
    return None

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
    err = validate_dirs(opts.tree_dirs, opts.edit_dirs)
    if err:
        print(err, file=sys.stderr)
        raise SystemExit(2)
    print(f"Evo Behavior Tree Monitor: http://{opts.bind}:{opts.port}", flush=True)
    from . import app
    if opts.window:
        app.run_window(opts.bind, opts.port, tree_dirs=opts.tree_dirs, edit_dirs=opts.edit_dirs)
    else:
        app.serve(opts.bind, opts.port, tree_dirs=opts.tree_dirs, edit_dirs=opts.edit_dirs)
