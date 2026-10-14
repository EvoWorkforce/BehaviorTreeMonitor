"""Tree file access: listing, path guard, read, and atomic write."""

from __future__ import annotations

import hashlib
import os
import shutil
import tempfile
from dataclasses import dataclass
from typing import Iterable, Optional


@dataclass(frozen=True)
class TreeFile:
    id: str
    path: str
    folder: str
    editable: bool


class Conflict(Exception):
    def __init__(self, current_sha: str):
        super().__init__("file changed on disk")
        self.current_sha = current_sha


def _inside(path: str, root: str) -> bool:
    return path == root or path.startswith(root.rstrip(os.sep) + os.sep)


def _file_id(real: str) -> str:
    return hashlib.sha256(real.encode()).hexdigest()[:16]


def list_tree_files(
    tree_dirs: Iterable[str], edit_dirs: Iterable[str]
) -> list[TreeFile]:
    roots = [os.path.realpath(d) for d in tree_dirs]
    edits = [os.path.realpath(d) for d in edit_dirs]
    found: dict[str, TreeFile] = {}
    for root in roots:
        for dirpath, _dirs, names in os.walk(root):
            for name in names:
                if not name.endswith(".xml"):
                    continue
                real = os.path.realpath(os.path.join(dirpath, name))
                if real in found or not os.path.isfile(real):
                    continue
                if not any(_inside(real, r) for r in roots):
                    continue
                found[real] = TreeFile(
                    id=_file_id(real),
                    path=real,
                    folder=os.path.dirname(real),
                    editable=any(_inside(real, e) for e in edits),
                )
    return sorted(found.values(), key=lambda f: f.path)


def resolve_tree_path(
    tree_dirs: Iterable[str], edit_dirs: Iterable[str], file_id: str
) -> Optional[TreeFile]:
    for f in list_tree_files(tree_dirs, edit_dirs):
        if f.id == file_id:
            return f
    return None


def read_tree(path: str) -> tuple[str, str]:
    with open(path, "rb") as fh:
        data = fh.read()
    return data.decode("utf-8"), hashlib.sha256(data).hexdigest()


def write_tree(path: str, text: str, base_sha256: str) -> str:
    with open(path, "rb") as fh:
        current = hashlib.sha256(fh.read()).hexdigest()
    if current != base_sha256:
        raise Conflict(current)
    data = text.encode("utf-8")
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as out:
            out.write(data)
        shutil.copymode(path, tmp)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    return hashlib.sha256(data).hexdigest()
