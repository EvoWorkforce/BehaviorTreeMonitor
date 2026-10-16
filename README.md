# Evo Behavior Tree Monitor

A live, read-only behavior tree monitor built on the
[BehaviorTree.CPP](https://github.com/BehaviorTree/BehaviorTree.CPP) Groot2 protocol. It shows node
status, the live blackboard of each subtree instance, and a recorded timeline of status transitions.

The monitor only sends read requests (tree, status, blackboard, recording, transitions). It never
inserts hooks or changes the tree.

## Architecture

```
Python (aiohttp, optional PySide6)    Vue 3 + TypeScript
┌─────────────────────┐             ┌────────────────────────┐
│  aiohttp server     │──HTTP────►  │  Page (bt_monitor/static) │
│  WebSocket bridge   │◄─WS──────►  │  WebSocket client       │
│  ZMQ client         │             └────────────────────────┘
│  Qt window (opt.)   │
└─────────────────────┘
          ▲
          │ ZMQ REQ/REP
          ▼
    BT.CPP executor
    (Groot2Publisher, port 1667)
```

## Preview

![](./sample1.png)

![](./sample2.png)

## Features

- Instance rail: every subtree instance, with a status dot; open one alone, with a breadcrumb.
- Blackboard rail: live values for the selected instance (4 Hz), with change flash and pinned keys.
  Values on `{key}` ports show beside the node.
- Transition timeline: record, swim lanes per node, a log, JSON export. Recording clears the
  publisher's transition buffer for every client; do not record with Groot2 at the same time.
- Search (`/`), follow the deepest running node, light and dark themes, `[` and `]` toggle the rails.

## Run

Headless (default): serve the page and open it in a browser.

```bash
pip install .
evo-behavior-tree-monitor            # http://127.0.0.1:18080
evo-behavior-tree-monitor --bind 0.0.0.0 --port 19000
python -m bt_monitor --help
```

The port can also come from `EVO_BTM_PORT`; `--port` wins. If the port is busy, the monitor exits
with a message that names `--port`.

Desktop window (needs Qt):

```bash
pip install ".[qt]"
evo-behavior-tree-monitor --window
```

## File view

Browse and edit behaviour tree files from the server's folders:

```bash
evo-behavior-tree-monitor --tree-dir path/to/config --edit-dir path/to/config
```

`--tree-dir` lists the files in the Open menu. `--edit-dir` (a folder inside a tree dir) marks the
files that may be edited. Both are repeatable (env `EVO_BTM_TREE_DIRS`, `EVO_BTM_EDIT_DIRS`).

A tree split over several files opens from its main file. Each `<include path="...">` is resolved
against the folder of the including file, and the included files must be in a tree dir. An include
with `ros_pkg`, a cycle, or a `<BehaviorTree ID>` defined twice is refused, with a notice that names
the file. When a `<SubTree>` has no definition, the monitor looks in the main file's folder and then
its parent, and adds the notice "Resolved <ID> from <file>".

An edit is saved to the file that defines the node, not to the main file. After a save, the main
file is read again.

## Project layout

```
BehaviorTreeMonitor/
├── main.py                 # entry point (calls bt_monitor.cli)
├── bt_monitor/
│   ├── cli.py              # arguments, port check, headless or window
│   ├── protocol.py         # Groot2 protocol encoding and decoding
│   ├── server.py           # aiohttp WebSocket/ZMQ bridge
│   ├── app.py              # HTTP server and optional Qt window
│   └── static/             # built page (generated, not tracked)
├── frontend/               # Vue 3 + TypeScript; pure logic in src/lib/
├── tests/                  # pytest, fake Groot2 publisher, aom fixtures
├── tools/capture_fixtures.py
└── bt_monitor.spec         # PyInstaller config
```

## Development

### Requirements

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Node.js 20 and pnpm 10 (pinned through `packageManager`; `corepack enable` picks it)

### Install dependencies

```bash
uv sync --group dev --extra qt
cd frontend && pnpm install
```

### Build the page and run

```bash
cd frontend && pnpm build          # writes bt_monitor/static/
uv run python -m bt_monitor
```

### Test

```bash
cd frontend && pnpm test           # Vitest
uv run pytest                      # pytest
```

`tools/capture_fixtures.py` records the fixtures in `tests/fixtures/` from a running publisher.

### Build a release

```bash
cd frontend && pnpm install && pnpm build
uv run --group dev pyinstaller --clean --noconfirm bt_monitor.spec
```

Output file: `dist/BehaviorTreeMonitor`

## Origin

This is the Evo fork of
[riyuexingchennnn/BehaviorTreeMonitor](https://github.com/riyuexingchennnn/BehaviorTreeMonitor).
