"""Serve Element Learn locally with no third-party dependencies."""
import json
import os
import socket
import threading
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent / 'dist'
HOST = '127.0.0.1'
PORT = int(os.environ.get('PORT', '8767'))
FILES = {'/': 'index.html', '/index.html': 'index.html', '/styles.css': 'styles.css',
         '/app.mjs': 'app.mjs', '/engine.mjs': 'engine.mjs', '/data/elements.json': 'data/elements.json',
         '/families.html': 'families.html', '/family-app.mjs': 'family-app.mjs', '/family-engine.mjs': 'family-engine.mjs', '/metal.html': 'metal.html',
         '/ions.html': 'ions.html', '/ions-app.mjs': 'ions-app.mjs', '/ions-engine.mjs': 'ions-engine.mjs', '/icon.svg': 'icon.svg'}
MIME = {'.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml'}

class LocalServer(ThreadingHTTPServer):
    # Windows SO_REUSEADDR otherwise permits two launchers to bind the same address.
    allow_reuse_address = os.name != 'nt'

    def server_bind(self):
        if os.name == 'nt' and hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get('Host') not in (f'{HOST}:{PORT}', f'localhost:{PORT}'):
            self.send_error(403, 'Local requests only')
            return
        route = urlparse(self.path).path
        if route == '/health':
            content = json.dumps({'app': 'element-learn', 'version': 2, 'features': ['families']}).encode()
            content_type = 'application/json'
        elif route in FILES and (ROOT / FILES[route]).is_file():
            path = ROOT / FILES[route]
            content = path.read_bytes()
            content_type = MIME[path.suffix]
        else:
            self.send_error(404, 'Not found')
            return
        self.send_response(200)
        self.send_header('Content-Type', content_type + '; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.end_headers()
        try:
            self.wfile.write(content)
        except (ConnectionResetError, BrokenPipeError):
            pass

def main():
    address = f'http://{HOST}:{PORT}'
    try:
        server = LocalServer((HOST, PORT), Handler)
    except OSError as error:
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(address + '/health', timeout=2) as response:
                existing = json.load(response)
            if existing.get('app') == 'element-learn':
                print(f'Element Learn is already running: {address}', flush=True)
                if os.environ.get('OPEN_BROWSER', '1') != '0':
                    webbrowser.open(address)
                return
        except Exception:
            pass
        raise SystemExit(f'Could not open {address}: {error}. Set PORT to another port and retry.')
    print(f'Element Learn: {address}', flush=True)
    print('Keep this window open while studying. Press Ctrl+C to stop.', flush=True)
    if os.environ.get('OPEN_BROWSER', '1') != '0':
        threading.Timer(0.5, lambda: webbrowser.open(address)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
