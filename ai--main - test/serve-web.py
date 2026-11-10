#!/usr/bin/env python3
"""Publish the NEXUS AI site to the local network.

Everything that belongs to the website (HTML pages, styles, scripts and
image assets) is served from the site root; repository files such as the
README, the preview images and these server scripts are answered with 404,
and directory listings are disabled.

Usage:
    python serve-web.py [port]        # default 8000
"""

import mimetypes
import os
import socket
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

# Site assets that may be published, by extension.
PUBLIC_EXTENSIONS = {".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".ico"}

# Repository-only files that must never be reachable from the LAN.
DENY_NAMES = {"readme.md", "serve-web.py", "serve-lan.bat"}
DENY_PREFIXES = ("preview-",)


class SiteHandler(BaseHTTPRequestHandler):
    server_version = "NexusSite/1.0"

    def do_GET(self):
        name = self.resolve()
        if name is None:
            return self.not_found()
        self.send_file(name, body=True)

    def do_HEAD(self):
        name = self.resolve()
        if name is None:
            return self.not_found()
        self.send_file(name, body=False)

    def resolve(self):
        path = unquote(urlparse(self.path).path)
        if path in ("/", "/index.html"):
            return "index.html"

        name = path.lstrip("/")
        if not name or "/" in name or "\\" in name or name.startswith("."):
            return None

        lower = name.lower()
        if lower in DENY_NAMES or lower.startswith(DENY_PREFIXES):
            return None
        if os.path.splitext(lower)[1] not in PUBLIC_EXTENSIONS:
            return None
        return name

    def send_file(self, name, body):
        full = os.path.join(ROOT, name)
        try:
            with open(full, "rb") as handle:
                data = handle.read()
        except OSError:
            return self.not_found()

        content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type.endswith("javascript"):
            content_type += "; charset=utf-8"

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if body:
            self.wfile.write(data)

    def not_found(self):
        message = b"404 Not Found\n"
        self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(message)))
        self.end_headers()
        self.wfile.write(message)

    def list_directory(self, path):
        self.send_error(404)
        return None

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def lan_addresses():
    """Best-effort list of addresses other devices can use."""
    found = []

    # Address of the interface that carries the default route.
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            probe.connect(("223.5.5.5", 80))
            primary = probe.getsockname()[0]
        finally:
            probe.close()
        if primary and not primary.startswith("127."):
            found.append(primary)
    except OSError:
        pass

    # Any other local IPv4 address, as a fallback for multi-homed machines.
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            address = info[4][0]
            if address.startswith(("127.", "169.254.")) or address in found:
                continue
            found.append(address)
    except OSError:
        pass

    return found


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), SiteHandler)
    print("NEXUS AI site is published on the local network")
    print("  this computer : http://127.0.0.1:%d/" % PORT)
    for address in lan_addresses():
        print("  local network : http://%s:%d/" % (address, PORT))
    print("  press Ctrl+C to stop")
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
