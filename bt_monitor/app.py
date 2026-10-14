"""Page server and optional Qt WebEngine window"""

import os
import sys
import signal
import logging
import threading
from typing import Optional, Sequence

from aiohttp import web
import asyncio

from .server import create_app

logger = logging.getLogger(__name__)


def _get_dist_dir() -> str:
    """Get the path of the built frontend directory (supports PyInstaller)"""
    if getattr(sys, 'frozen', False):
        # After PyInstaller bundling: sys._MEIPASS/bt_monitor/static
        base = sys._MEIPASS  # type: ignore[attr-defined]
    else:
        # Installed package or source checkout: bt_monitor/static
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
    return os.path.join(base, 'bt_monitor', 'static')


def _get_resource_dir() -> str:
    """Get the resource directory path (supports PyInstaller)"""
    if getattr(sys, 'frozen', False):
        base = sys._MEIPASS  # type: ignore[attr-defined]
    else:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, 'resources')


class _ServerThread(threading.Thread):
    """Run the aiohttp server in a background thread"""

    def __init__(self, static_dir: str, host: str, port: int,
                 tree_dirs: Sequence[str] = (), edit_dirs: Sequence[str] = ()):
        super().__init__(daemon=True)
        self.static_dir = static_dir
        self.host = host
        self.port = port
        self.tree_dirs = tuple(tree_dirs)
        self.edit_dirs = tuple(edit_dirs)
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._runner: Optional[web.AppRunner] = None
        self._ready = threading.Event()

    def run(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.loop.run_until_complete(self._start())
        self._ready.set()
        self.loop.run_forever()

    async def _start(self):
        app = create_app(self.static_dir, self.tree_dirs, self.edit_dirs)
        self._runner = web.AppRunner(app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, self.host, self.port)
        await site.start()
        logger.info(f"Server started: http://{self.host}:{self.port}")

    def wait_ready(self, timeout: float = 10.0):
        self._ready.wait(timeout)

    def stop(self):
        if self.loop and self._runner:
            asyncio.run_coroutine_threadsafe(self._runner.cleanup(), self.loop)
            self.loop.call_soon_threadsafe(self.loop.stop)


def _check_static(static_dir: str) -> None:
    if not os.path.isdir(static_dir):
        logger.error(f"Frontend directory does not exist: {static_dir}")
        logger.error("Run this first: cd frontend && pnpm install && pnpm build")
        sys.exit(1)


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )


def serve(bind: str, port: int, static_dir: Optional[str] = None,
          tree_dirs: Sequence[str] = (), edit_dirs: Sequence[str] = ()) -> None:
    """Serve the page and the WebSocket bridge until interrupted. Needs no Qt."""
    _setup_logging()
    static_dir = static_dir or _get_dist_dir()
    _check_static(static_dir)

    async def _main() -> None:
        runner = web.AppRunner(create_app(static_dir, tree_dirs, edit_dirs))
        await runner.setup()
        await web.TCPSite(runner, bind, port).start()
        try:
            await asyncio.Event().wait()
        finally:
            await runner.cleanup()

    try:
        asyncio.run(_main())
    except KeyboardInterrupt:
        pass


def run_window(bind: str, port: int, static_dir: Optional[str] = None,
               tree_dirs: Sequence[str] = (), edit_dirs: Sequence[str] = ()) -> None:
    """Start the page server in a thread and show it in a Qt window."""
    try:
        from PySide6.QtWidgets import QApplication, QMainWindow
        from PySide6.QtWebEngineWidgets import QWebEngineView
        from PySide6.QtWebEngineCore import QWebEngineProfile
        from PySide6.QtCore import QUrl, QTimer
        from PySide6.QtGui import QIcon
    except ImportError:
        raise SystemExit(
            "The --window option needs Qt. Install it with: pip install .[qt]"
        )

    _setup_logging()
    static_dir = static_dir or _get_dist_dir()
    _check_static(static_dir)

    class MonitorWindow(QMainWindow):
        def __init__(self, url: str):
            super().__init__()
            self.setWindowTitle("Evo Behavior Tree Monitor")
            self.resize(1400, 900)

            resource_dir = _get_resource_dir()
            icon_ico = os.path.join(resource_dir, 'icon.ico')
            icon_png = os.path.join(resource_dir, 'icon.png')
            if os.path.exists(icon_ico):
                self.setWindowIcon(QIcon(icon_ico))
            elif os.path.exists(icon_png):
                self.setWindowIcon(QIcon(icon_png))

            self._view = QWebEngineView()
            # Disable the disk cache so every load gets the latest resources
            profile = self._view.page().profile()
            profile.setHttpCacheType(QWebEngineProfile.HttpCacheType.NoCache)
            self._view.setUrl(QUrl(url))
            self.setCentralWidget(self._view)

    server = _ServerThread(static_dir, bind, port, tree_dirs, edit_dirs)
    server.start()
    server.wait_ready()

    qt_app = QApplication(sys.argv)
    qt_app.setApplicationName("Evo Behavior Tree Monitor")

    # Allow Ctrl+C to exit
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    # A timer drives Python signal handling
    timer = QTimer()
    timer.timeout.connect(lambda: None)
    timer.start(200)

    window = MonitorWindow(f"http://{bind}:{port}")
    window.show()

    exit_code = qt_app.exec()
    server.stop()
    sys.exit(exit_code)
