#!/usr/bin/env python3
"""
Simple HTTP server to serve the PixMob Web UI.
Run this script from the www directory.
"""

import http.server
import socketserver
import os
import sys

# Change to the www directory if not already there
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

PORT = 8000


class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow Web Serial API
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()


Handler = MyHTTPRequestHandler

print(f"Starting HTTP server on port {PORT}...")
print(f"Open your browser to: http://localhost:{PORT}")
print(f"Press Ctrl+C to stop the server")

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\n\nServer stopped.")
    sys.exit(0)
