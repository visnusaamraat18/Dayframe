"""Real HTTP integration tests for DAYFRAME's optional Python server."""
from http.client import HTTPConnection
import json
from pathlib import Path
import tempfile
import threading
import unittest
from serve_dayframe import create_server

class ServerTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        (cls.root / 'index.html').write_text('<html>DAYFRAME test</html>', encoding='utf-8')
        (cls.root / 'assets').mkdir()
        (cls.root / 'assets' / 'app.js').write_text("console.log('DAYFRAME')", encoding='utf-8')
        (cls.root / '.private').write_text('private', encoding='utf-8')
        cls.server = create_server(0, cls.root)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def request(self, path, method='GET'):
        connection = HTTPConnection(*self.server.server_address, timeout=5)
        try:
            connection.request(method, path)
            response = connection.getresponse()
            return (response.status, dict(response.getheaders()), response.read())
        finally:
            connection.close()

    def test_home_and_direct_router_pages(self):
        for path in ['/', '/tasks', '/habits/', '/notes?search=test', '/insights', '/settings']:
            with self.subTest(path=path):
                status, _, body = self.request(path)
                self.assertEqual(status, 200)
                self.assertIn(b'DAYFRAME test', body)

    def test_assets_have_correct_type_and_length(self):
        status, headers, body = self.request('/assets/app.js')
        self.assertEqual(status, 200)
        self.assertEqual(headers['Content-Type'], 'text/javascript')
        self.assertEqual(int(headers['Content-Length']), len(body))
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')

    def test_missing_asset_is_not_html(self):
        self.assertEqual(self.request('/assets/missing.js')[0], 404)
        self.assertEqual(self.request('/assets/')[0], 404)

    def test_private_and_traversal_paths_are_blocked(self):
        for path in ['/../package.json', '/%2e%2e/package.json', '/.private', '/assets/%5c..%5csecret']:
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 403)

    def test_health_reports_python(self):
        status, _, body = self.request('/__dayframe__/health')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {'app': 'DAYFRAME', 'server': 'Python', 'ready': True})

    def test_head_has_headers_without_body(self):
        status, headers, body = self.request('/tasks', 'HEAD')
        self.assertEqual(status, 200)
        self.assertGreater(int(headers['Content-Length']), 0)
        self.assertEqual(body, b'')

    def test_missing_build_has_actionable_message(self):
        with self.assertRaisesRegex(FileNotFoundError, 'npm run build'):
            create_server(0, self.root / 'missing')

    def post(self, payload, **headers):
        connection = HTTPConnection(*self.server.server_address, timeout=5)
        try:
            connection.request('POST', '/api/command', json.dumps(payload), headers={'Content-Type': 'application/json', **headers})
            response = connection.getresponse()
            return (response.status, json.loads(response.read()))
        finally:
            connection.close()

    def test_api_round_trip_and_python_reports(self):
        status, payload = self.post(dict(action='task.save', args=dict(input=dict(title='HTTP test', description='', category='', priority='high', dueDate='', dueTime='', recurrence='none'))))
        self.assertEqual(status, 200)
        key = payload['result']['id']
        status, _, body = self.request('/api/state')
        self.assertEqual(status, 200)
        data = json.loads(body)
        self.assertIn(key, [r['id'] for r in data['data']['tasks']])
        self.assertIn('30', data['reports'])
        self.assertEqual(self.post(dict(action='task.delete', args=dict(id=key)))[0], 200)

    def test_api_rejects_bad_records_and_unknown_actions(self):
        self.assertEqual(self.post(dict(action='task.save', args=dict(input={})))[0], 400)
        self.assertEqual(self.post(dict(action='not-a-command', args={}))[0], 400)

    def test_cross_origin_and_non_json_writes_are_blocked(self):
        payload = dict(action='data.reset', args={})
        self.assertEqual(self.post(payload, Origin='https://unrelated.example')[0], 403)
        self.assertEqual(self.post(payload, **{'Content-Type': 'text/plain'})[0], 415)

    def test_state_request_with_rebinding_host_is_blocked(self):
        connection = HTTPConnection(*self.server.server_address, timeout=5)
        try:
            connection.request('GET', '/api/state', headers={'Host': 'unrelated.example'})
            response = connection.getresponse()
            response.read()
            self.assertEqual(response.status, 403)
        finally:
            connection.close()
if __name__ == '__main__':
    unittest.main()
