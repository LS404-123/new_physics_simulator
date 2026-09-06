"""執行 python test-serve.py，檢查直接儲存及拒絕無效／跨網站寫入。"""

from http.client import HTTPConnection
from socket import create_connection
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import serve


with TemporaryDirectory() as directory:
    serve.ROOT = Path(directory)
    (serve.ROOT / "simulations.js").write_text('const items = [{href: "./a"}, {href: "./b"}];')
    target = serve.ROOT / "catalogue-order.js"
    target.write_text("original")
    with serve.ThreadingHTTPServer(("127.0.0.1", 0), serve.CatalogueHandler) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        idle_connection = create_connection(server.server_address)  # 瀏覽器預先連線不可阻塞儲存。
        host = f"127.0.0.1:{server.server_port}"

        def request(order, origin=f"http://{host}", request_host=host):
            connection = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
            connection.request("POST", serve.API, json.dumps(order), {
                "Origin": origin, "Host": request_host, "Content-Type": "application/json"
            })
            response = connection.getresponse()
            status = response.status
            response.read()
            connection.close()
            return status

        try:
            assert request(["./b", "./a"]) == 200
            saved = target.read_text(encoding="utf-8")
            assert json.loads(saved.split(" = ", 1)[1].rstrip(";\n")) == ["./b", "./a"]
            for invalid in [["./a", "./a"], ["./a"], ["./a", "../secret"], {}, [None, "./a"]]:
                assert request(invalid) == 400
            assert request(["./a", "./b"], origin="https://example.com") == 403
            assert request(["./a", "./b"], request_host="example.com") == 403
            assert target.read_text(encoding="utf-8") == saved
            target.unlink()
            target.mkdir()  # 寫入失敗不可回報成功。
            assert request(["./a", "./b"]) == 500
        finally:
            idle_connection.close()
            server.shutdown()
            thread.join()

print("通過：直接寫入、排序完整性、跨網站／Host 檢查及寫入失敗處理。")
