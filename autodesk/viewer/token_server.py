"""Tiny local server for the Autodesk Viewer demo.
  /api/token -> 2-legged viewer token (data:read)
  /urn       -> the URN from the last run_aps.py
  /meta      -> out/scene_meta.json (street + score per object)
  /          -> index.html  (and static files)
Run:  python viewer/token_server.py   then open http://localhost:8080
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from aps_client import get_token  # noqa: E402
from config import VIEWER_SCOPES  # noqa: E402

OUT = HERE.parent / "out"

class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        self.path = self.path.split("?")[0]  # strip query string (cache-busters etc.)
        if self.path.startswith("/api/token"):
            try:
                tok = get_token(VIEWER_SCOPES)
                self._send(200, json.dumps({"access_token": tok, "expires_in": 3600}))
            except Exception as e:
                self._send(500, json.dumps({"error": str(e)}))
        elif self.path.startswith("/urn"):
            urn = (HERE / "urn.txt")
            self._send(200, urn.read_text().strip() if urn.exists() else "", "text/plain")
        elif self.path.startswith("/meta"):
            m = OUT / "scene_meta.json"
            self._send(200, m.read_text() if m.exists() else "{}")
        else:
            f = HERE / ("index.html" if self.path in ("/", "") else self.path.lstrip("/"))
            if f.exists() and f.is_file():
                ctype = "text/html" if f.suffix == ".html" else "application/javascript" if f.suffix == ".js" else "text/plain"
                self._send(200, f.read_bytes(), ctype)
            else:
                self._send(404, "not found", "text/plain")

    def log_message(self, *a):
        pass

if __name__ == "__main__":
    print("Sewershed × Autodesk viewer → http://localhost:8080")
    HTTPServer(("0.0.0.0", 8080), H).serve_forever()
