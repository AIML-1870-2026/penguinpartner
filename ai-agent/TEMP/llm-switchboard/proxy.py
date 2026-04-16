#!/usr/bin/env python3
"""
Minimal CORS proxy for LLM Switchboard.
Forwards browser requests to Anthropic (and any other API that blocks CORS).

Usage:  python3 proxy.py
Then set the Proxy URL in the app to: http://localhost:8080
Requests arrive as:  POST http://localhost:8080/https://api.anthropic.com/v1/messages
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error

PORT = 8080

class ProxyHandler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        target = self.path.lstrip('/')          # "https://api.anthropic.com/v1/messages"
        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length)

        fwd = {k: v for k, v in self.headers.items()
               if k.lower() not in ('host', 'origin', 'referer', 'content-length')}

        try:
            req = urllib.request.Request(target, data=body, headers=fwd, method='POST')
            with urllib.request.urlopen(req) as r:
                payload = r.read()
                self.send_response(r.status)
                self._cors()
                # Skip headers that conflict with our explicit payload size
                skip = ('transfer-encoding', 'content-encoding', 'content-length')
                for k, v in r.headers.items():
                    if k.lower() not in skip:
                        self.send_header(k, v)
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as e:
            payload = e.read()
            print(f"[proxy] upstream {e.code}: {payload.decode(errors='replace')}")
            self.send_response(e.code)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:
            payload = str(e).encode()
            self.send_response(502)
            self._cors()
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')

    def log_message(self, fmt, *args):
        print(f"[proxy] {fmt % args}")

if __name__ == '__main__':
    server = HTTPServer(('localhost', PORT), ProxyHandler)
    print(f"✓ CORS proxy listening on http://localhost:{PORT}")
    print("  Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nProxy stopped.")
