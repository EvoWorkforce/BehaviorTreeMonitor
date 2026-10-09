"""Qt WebEngine application"""

import os
import sys
import signal
import logging
import threading
from typing import Optional

from aiohttp import web
import asyncio

from PySide6.QtWidgets import QApplication, QMainWindow
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import QWebEngineProfile
from PySide6.QtCore import QUrl, QTimer
from PySide6.QtGui import QIcon

from .server import create_app

logger = logging.getLogger(__name__)


def _get_dist_dir() -> str:
    """Get the path of the built frontend directory (supports PyInstaller)"""
    if getattr(sys, 'frozen', False):
        # After PyInstaller bundling
        base = sys._MEIPASS  # type: ignore[attr-defined]
    else:
        # Development mode
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, 'dist')


def _get_resource_dir() -> str:
    """Get the resource directory path (supports PyInstaller)"""
    if getattr(sys, 'frozen', False):
        base = sys._MEIPASS  # type: ignore[attr-defined]
    else:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, 'resources')


class _ServerThread(threading.Thread):
    """Run the aiohttp server in a background thread"""

    def __init__(self, static_dir: str, host: str, port: int):
        super().__init__(daemon=True)
        self.static_dir = static_dir
        self.host = host
        self.port = port
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
        app = create_app(self.static_dir)
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


class MonitorWindow(QMainWindow):
    def __init__(self, url: str):
        super().__init__()
        self.setWindowTitle("BehaviorTree Monitor")
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


def run(host: str = "127.0.0.1", port: int = 18080):
    """Start the application: background aiohttp service + Qt window"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    dist_dir = _get_dist_dir()
    if not os.path.isdir(dist_dir):
        logger.error(f"Frontend directory does not exist: {dist_dir}")
        logger.error("Run this first: cd frontend && pnpm install && pnpm build")
        sys.exit(1)

    # Start the background server
    server = _ServerThread(dist_dir, host, port)
    server.start()
    server.wait_ready()

    # Qt application
    qt_app = QApplication(sys.argv)
    qt_app.setApplicationName("BehaviorTree Monitor")

    # Allow Ctrl+C to exit
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    # A timer drives Python signal handling
    timer = QTimer()
    timer.timeout.connect(lambda: None)
    timer.start(200)

    window = MonitorWindow(f"http://{host}:{port}")
    window.show()

    exit_code = qt_app.exec()
    server.stop()
    sys.exit(exit_code)
