# BehaviorTree Monitor

A live behavior tree monitor built on the [BehaviorTree.CPP](https://github.com/BehaviorTree/BehaviorTree.CPP) Groot2 protocol. It shows the status of 20 or more nodes, including nodes inside subtrees.

## Architecture

```
Python (PySide6 + aiohttp)          Vue 3 + TypeScript
┌─────────────────────┐           ┌──────────────────┐
│  Qt WebEngineView   │──HTTP──►  │  Frontend (dist/)  │
│  aiohttp Server     │◄─WS───►   │  WebSocket client │
│  ZMQ Bridge         │◄─ZMQ──►   │                  │
└─────────────────────┘           └──────────────────┘
                                        ▲
                                        │ ZMQ REQ/REP
                                        ▼
                                  BT.CPP executor
                                  (Groot2Publisher)
```

## Preview

![](./sample1.png)

![](./sample2.png)

## Project layout

```
BehaviorTreeMonitor/
├── main.py                 # entry point
├── bt_monitor/
│   ├── protocol.py         # BT.CPP Groot2 protocol
│   ├── server.py           # aiohttp WebSocket/ZMQ bridge
│   └── app.py              # Qt WebEngine window
├── frontend/               # Vue 3 + TypeScript
│   ├── src/
│   │   ├── App.vue
│   │   ├── components/
│   │   ├── composables/
│   │   ├── stores/
│   │   ├── types/
│   │   └── styles/
│   └── ...
└── bt_monitor.spec         # PyInstaller config
```

## Development

### Requirements

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Node.js 18+ & pnpm

### Install dependencies

```bash
# Python dependencies
uv sync

# Frontend dependencies
cd frontend && pnpm install
```

### Run in development

- Build the frontend

```bash
cd frontend
pnpm build
```

- Start the application

```bash
uv run python main.py
```

### Build a release

```bash
# 1. Build the frontend
cd frontend && pnpm install && pnpm build

# 2. Bundle with PyInstaller
uv run --group dev pyinstaller --clean --noconfirm bt_monitor.spec
```

Output file: `dist/BehaviorTreeMonitor`

## Download and run

To skip the build, download a compiled version from the [releases page](https://github.com/riyuexingchennnn/BehaviorTreeMonitor/releases).

Note: on Ubuntu, run `chmod +x` on the file before you start it.

