"""Check the exact running local app URL without opening or automating a browser."""
import json
import os
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get('PORT', '8767'))
BASE = f'http://127.0.0.1:{PORT}'
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

def read(path):
    with opener.open(BASE + path, timeout=5) as response:
        assert response.status == 200
        return response.headers, response.read()

class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.files = []
        self.ids = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])
        for key in ('src', 'href'):
            value = a.get(key, '')
            if value.startswith(('/', './')):
                self.files.append(urljoin('/', value))

headers, content = read('/')
assert headers.get_content_type() == 'text/html'
assert b'Element Learn' in content
assert headers['X-Content-Type-Options'] == 'nosniff'
refs = References()
refs.feed(content.decode('utf-8'))
assert len(refs.ids) == len(set(refs.ids)), 'HTML IDs must be unique'
family_headers, family_html = read('/families.html')
assert family_headers.get_content_type() == 'text/html'
family_refs = References()
family_refs.feed(family_html.decode('utf-8'))
assert len(family_refs.ids) == len(set(family_refs.ids)), 'Family page IDs must be unique'
assert b'family-study-table' in family_html and b'family-start-missed' in family_html
metal_headers, metal_html = read('/metal.html')
assert metal_headers.get_content_type() == 'text/html'
metal_refs = References()
metal_refs.feed(metal_html.decode('utf-8'))
assert len(metal_refs.ids) == len(set(metal_refs.ids)), 'Metal page IDs must be unique'
for route in set(refs.files + family_refs.files + metal_refs.files) | {'/engine.mjs', '/family-engine.mjs', '/data/elements.json', '/health'}:
    headers, body = read(route)
    assert body
    if route.endswith('.mjs'):
        assert headers.get_content_type() == 'text/javascript'
    if route.endswith('.css'):
        assert headers.get_content_type() == 'text/css'
    if route.endswith('.json'):
        assert headers.get_content_type() == 'application/json'
        assert len(json.loads(body)['elements']) == 118
    if route == '/health':
        health = json.loads(body)
        assert health['app'] == 'element-learn' and 'families' in health['features']
for route in ('/server.py', '/README.md', '/data/../server.py', '/does-not-exist'):
    try:
        read(route)
        raise AssertionError('Unlisted route was exposed: ' + route)
    except urllib.error.HTTPError as error:
        assert error.code == 404
try:
    opener.open(urllib.request.Request(BASE, headers={'Host':'example.com'}), timeout=5)
    raise AssertionError('Unexpected Host header was accepted')
except urllib.error.HTTPError as error:
    assert error.code == 403
assert '8765' not in (ROOT / 'server.py').read_text()
assert '8766' not in (ROOT / 'server.py').read_text()
print('PASS: both games, local routes, bundled assets, MIME types, 118 elements, HTML IDs, and Host/file restrictions.')
