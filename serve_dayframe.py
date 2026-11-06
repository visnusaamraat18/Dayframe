"""Serve DAYFRAME locally with Python's standard library.

Build the React website with `npm run build`, then run `python serve_dayframe.py`.
Python serves the UI and owns local SQLite storage, validation and business rules.
"""
from __future__ import annotations
import argparse
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit
from backend.store import Store
from backend.domain import analytics, habit_stats
from datetime import date
from io import BytesIO
PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_PORT = 5173
APP_ROUTES = {'/', '/tasks', '/habits', '/notes', '/insights', '/settings'}

class DayframeHandler(SimpleHTTPRequestHandler):
    """Serve compiled files and support React Router's direct page links."""
    server_version = 'DAYFRAME-Python/1.0'

    def __init__(self, *args, build_dir: Path, **kwargs):
        self.build_dir = build_dir.resolve()
        super().__init__(*args, directory=str(self.build_dir), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def json_response(self, payload, status=200):
        content = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(content)

    def valid_host(self):
        port = self.server.server_address[1]
        return self.headers.get('Host') in (f'127.0.0.1:{port}', f'localhost:{port}')

    def do_POST(self):
        if not self.valid_host():
            self.json_response({'error': 'Invalid local host.'}, 403)
            return
        origin = self.headers.get('Origin')
        allowed_origins = {'http://' + self.headers.get('Host', '')}
        if self.server.server_address[1] == 5174:
            allowed_origins.add('http://127.0.0.1:5173')
        if origin and origin not in allowed_origins:
            self.json_response({'error': 'Cross-origin writes are not allowed.'}, 403)
            return
        if self.path != '/api/command':
            self.json_response({'error': 'Unknown endpoint.'}, 404)
            return
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            self.json_response({'error': 'Expected JSON.'}, 415)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 20 * 1024 * 1024:
                raise ValueError('Request must be between 1 byte and 20 MB.')
            payload = json.loads(self.rfile.read(length))
            result = self.server.store.execute(payload['action'], payload.get('args', {}))
            self.json_response({'result': result})
        except (ValueError, KeyError, TypeError, AttributeError, OverflowError) as error:
            self.json_response({'error': str(error) or 'Invalid DAYFRAME record.'}, 400)
        except Exception:
            self.log_error('Database operation failed')
            self.json_response({'error': 'Local database operation failed. Check the Python terminal and disk access.'}, 500)

    def send_head(self):
        """Handle both GET and HEAD without exposing source files or listings."""
        try:
            path = unquote(urlsplit(self.path).path, errors='strict')
        except (UnicodeError, ValueError):
            self.send_error(HTTPStatus.BAD_REQUEST, 'Invalid URL')
            return None
        if not self.valid_host():
            self.json_response({'error': 'Invalid local host.'}, 403)
            return None
        if path == '/api/state':
            data = self.server.store.snapshot()
            current = date.today().isoformat()
            self.json_response({'data': data, 'reports': {str(n): analytics(data, n, current) for n in (7, 30, 90)}, 'streaks': {h['id']: habit_stats(h, data['habitLogs'], current) for h in data['habits']}})
            return None
        if path.startswith('/api/'):
            self.json_response({'error': 'Unknown endpoint.'}, 404)
            return None
        parts = path.strip('/').split('/')
        if '\\' in path or ':' in path or '\x00' in path or any((part.startswith('.') for part in parts if part)):
            self.send_error(HTTPStatus.FORBIDDEN, 'This path is not available')
            return None
        if path == '/__dayframe__/health':
            from io import BytesIO
            content = json.dumps({'app': 'DAYFRAME', 'server': 'Python', 'ready': True}).encode('utf-8')
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            return BytesIO(content)
        candidate = (self.build_dir / path.lstrip('/')).resolve()
        if not candidate.is_relative_to(self.build_dir):
            self.send_error(HTTPStatus.FORBIDDEN, 'This path is not available')
            return None
        if path.rstrip('/') in APP_ROUTES or path == '/':
            candidate = self.build_dir / 'index.html'
        if not candidate.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, 'Page or asset not found')
            return None
        try:
            file = candidate.open('rb')
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, 'File unavailable')
            return None
        try:
            self.send_response(HTTPStatus.OK)
            content_type = self.guess_type(str(candidate))
            content_type = {'.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml'}.get(candidate.suffix, content_type)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(candidate.stat().st_size))
            self.end_headers()
            return file
        except BaseException:
            file.close()
            raise

def create_server(port: int=DEFAULT_PORT, build_dir: Path | None=None, data_path: Path | None=None):
    """Create a loopback-only server; port zero is reserved for automated tests."""
    directory = (build_dir or PROJECT_ROOT / 'dist').resolve()
    if not (directory / 'index.html').is_file():
        raise FileNotFoundError('DAYFRAME has no production build. Run npm install and npm run build first.')
    store = Store(data_path or (directory / '.test-data.sqlite3' if build_dir is not None else PROJECT_ROOT / 'data' / 'dayframe.sqlite3'))
    server = ThreadingHTTPServer(('127.0.0.1', port), partial(DayframeHandler, build_dir=directory))
    server.store = store
    return server

def main(argv: list[str] | None=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='Local port (default: 5173)')
    args = parser.parse_args(argv)
    if not 1 <= args.port <= 65535:
        parser.error('port must be between 1 and 65535')
    try:
        server = create_server(args.port)
    except (OSError, ValueError) as error:
        print(f'Could not start DAYFRAME: {error}', file=sys.stderr)
        print('If the port is occupied, stop the running Vite or Python server first.', file=sys.stderr)
        return 1
    print(f'DAYFRAME is running with Python at http://127.0.0.1:{args.port}/', flush=True)
    print('Keep this terminal open. Press Ctrl+C to stop.', flush=True)
    print('Your workspace is stored in data/dayframe.sqlite3 beside this project.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nDAYFRAME stopped.')
    finally:
        server.server_close()
    return 0
if __name__ == '__main__':
    raise SystemExit(main())
