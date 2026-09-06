"""本機目錄編輯器：python serve.py，然後開啟 http://127.0.0.1:8766/?sort=1。"""

import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import re
import tempfile


ROOT = Path(__file__).resolve().parent
API = "/api/catalogue-order"


class CatalogueHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == API:
            self.reply(200, {"writable": True})
        else:
            super().do_GET()

    def do_POST(self):
        if self.path != API:
            self.reply(404, {"error": "找不到此功能。"})
            return
        # 只接受本機編輯頁；拒絕其他網站發起的寫入及 DNS rebinding。
        host = f"127.0.0.1:{self.server.server_port}"
        if self.headers.get("Host") != host or self.headers.get("Origin") != f"http://{host}":
            self.reply(403, {"error": "請從本機編輯頁儲存。"})
            return
        if self.headers.get_content_type() != "application/json":
            self.reply(415, {"error": "需要 JSON 格式。"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 65536:
                raise ValueError()
            order = json.loads(self.rfile.read(size))
            known = re.findall(r'\bhref:\s*"([^"]+)"', (ROOT / "simulations.js").read_text(encoding="utf-8"))
            if (not isinstance(order, list) or not all(isinstance(item, str) for item in order)
                    or len(order) != len(known) or set(order) != set(known)):
                raise ValueError()
        except (ValueError, UnicodeError):
            self.reply(400, {"error": "排序必須包含每個現有模擬器一次。"})
            return
        except OSError:
            self.reply(500, {"error": "無法讀取模擬器目錄。"})
            return

        temporary = None
        try:
            source = "// 由本機排序編輯器儲存；重新發布網站後套用。\nwindow.catalogueOrder = "
            source += json.dumps(order, ensure_ascii=False, indent=2) + ";\n"
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=ROOT, delete=False) as output:
                temporary = Path(output.name)
                output.write(source)
            temporary.replace(ROOT / "catalogue-order.js")
        except OSError:
            self.reply(500, {"error": "無法寫入排序檔案。"})
            return
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
        self.reply(200, {"saved": True})


if __name__ == "__main__":
    ThreadingHTTPServer.allow_reuse_address = False
    with ThreadingHTTPServer(("127.0.0.1", 8766), CatalogueHandler) as server:
        print("排序編輯器：http://127.0.0.1:8766/?sort=1（Ctrl+C 停止）", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
