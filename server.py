"""Serve ClassKit and proxy lesson-generation requests to local Ollama."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import json
import os

HOST = "127.0.0.1"
PORT = 8000
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MAX_BODY = 256_000


class ClassKitHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/generate":
            self.send_error(404, "Not found")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                self._json(413, {"error": "Request must be between 1 byte and 256 KB."})
                return
            payload = json.loads(self.rfile.read(length))
            request = Request(
                OLLAMA_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(request, timeout=120) as response:
                body = response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except HTTPError as error:
            detail = error.read().decode("utf-8", "replace")
            try:
                message = json.loads(detail).get("error", "Ollama returned an error.")
            except (json.JSONDecodeError, AttributeError):
                message = "Ollama returned an error."
            self._json(error.code, {"error": message})
        except (URLError, TimeoutError, ConnectionError):
            self._json(502, {"error": "Can't reach Ollama. Open Ollama and run `ollama pull qwen2.5:3b`, then try again."})
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._json(400, {"error": "Invalid JSON request."})

    def _json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)
    server = ThreadingHTTPServer((HOST, PORT), ClassKitHandler)
    print(f"ClassKit is ready at http://localhost:{PORT} (press Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nClassKit server stopped.")
        server.server_close()
