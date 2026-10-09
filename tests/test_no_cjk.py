import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", "node_modules", "dist", "build", ".pnpm-store", "__pycache__", ".venv"}
SKIP_PREFIXES = (("bt_monitor", "static"),)
CJK = re.compile("[\\u4e00-\\u9fff]")


def _is_binary(path: Path) -> bool:
    with path.open("rb") as f:
        return b"\0" in f.read(8192)


def _text_files():
    for path in ROOT.rglob("*"):
        rel = path.relative_to(ROOT).parts
        if not path.is_file() or any(p in SKIP_DIRS for p in rel):
            continue
        if any(rel[: len(p)] == p for p in SKIP_PREFIXES):
            continue
        if _is_binary(path):
            continue
        yield path


def test_no_cjk_in_text_sources():
    hits = []
    for path in _text_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for n, line in enumerate(text.splitlines(), 1):
            if CJK.search(line):
                hits.append(f"{path.relative_to(ROOT)}:{n}")
    assert not hits, "CJK characters found:\n" + "\n".join(hits)
