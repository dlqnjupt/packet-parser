import os
from wsgiref.simple_server import make_server
from wsgiref.util import request_uri
import mimetypes
import urllib.parse

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')

MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
}

def get_content_type(path):
    ext = os.path.splitext(path)[1].lower()
    return MIME_TYPES.get(ext, 'application/octet-stream')

def application(environ, start_response):
    path = urllib.parse.unquote(environ.get('PATH_INFO', '/'))
    if path == '/':
        path = '/index.html'
    
    file_path = os.path.normpath(STATIC_DIR + path)
    if not file_path.startswith(STATIC_DIR):
        start_response('403 Forbidden', [('Content-Type', 'text/plain')])
        return [b'Forbidden']
    
    if not os.path.isfile(file_path):
        file_path = os.path.join(STATIC_DIR, 'index.html')
        if not os.path.isfile(file_path):
            start_response('404 Not Found', [('Content-Type', 'text/plain')])
            return [b'Not Found']
    
    content_type = get_content_type(file_path)
    try:
        with open(file_path, 'rb') as f:
            body = f.read()
        headers = [
            ('Content-Type', content_type),
            ('Content-Length', str(len(body))),
            ('Cache-Control', 'public, max-age=3600'),
        ]
        start_response('200 OK', headers)
        return [body]
    except Exception as e:
        start_response('500 Internal Server Error', [('Content-Type', 'text/plain')])
        return [str(e).encode()]

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    host = os.environ.get('HOST', '0.0.0.0')
    print(f'Starting server at http://{host}:{port}')
    httpd = make_server(host, port, application)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
        httpd.shutdown()
