"""goudan_push — xiaozhi-server 主动播报 + 拍照通道 (stackchan-embodied M2)。

- /goudan/say   {"text": "..."}            服务器→设备主动说话 (走 TTS 管线)
- /goudan/photo {}                          触发设备拍照, 返回原始 JPEG base64
                                            (soul 是多模态, 自己看原图)
- /goudan/devices                           已连接设备列表

安装: 由 run_with_push.py 导入。
"""

import asyncio
import base64
import json
import os
import uuid

from aiohttp import web

from core.connection import ConnectionHandler
from core.handle.intentHandler import speak_txt
from core.handle.sendAudioHandle import send_tts_message

_conns: dict[str, "ConnectionHandler"] = {}
_orig_handle = ConnectionHandler.handle_connection


async def _tracking_handle(self, ws):
    try:
        await _orig_handle(self, ws)
    finally:
        did = getattr(self, "device_id", None)
        if did and _conns.get(did) is self:
            _conns.pop(did, None)


_orig_setattr = ConnectionHandler.__setattr__


def _hook_setattr(self, name, value):
    _orig_setattr(self, name, value)
    if name == "device_id" and value:
        _conns[value] = self


ConnectionHandler.__setattr__ = _hook_setattr
ConnectionHandler.handle_connection = _tracking_handle


BODY_TOKEN = os.environ.get("BODY_TOKEN", "")


def _auth_ok(request: web.Request) -> bool:
    return not BODY_TOKEN or request.headers.get("X-Body-Token") == BODY_TOKEN


def _pick_conn(device_id):
    if device_id:
        return _conns.get(device_id)
    if _conns:
        return next(iter(_conns.values()))
    return None


async def _say(request: web.Request) -> web.Response:
    if not _auth_ok(request):
        return web.json_response({"error": "unauthorized"}, status=401)
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "bad json"}, status=400)
    text = (body.get("text") or "").strip()
    if not text:
        return web.json_response({"error": "text required"}, status=400)

    conn = _pick_conn(body.get("device_id"))
    if conn is None or getattr(conn, "websocket", None) is None:
        return web.json_response({"error": "device not connected", "known": list(_conns)}, status=404)

    try:
        # 防回音/插嘴: 设备正在说话或在听用户说话时, 等一会儿再播 (最多 30s)
        for _ in range(60):
            if not getattr(conn, "client_is_speaking", False):
                break
            await asyncio.sleep(0.5)
        await send_tts_message(conn, "start")
        conn.sentence_id = uuid.uuid4().hex
        speak_txt(conn, text)
        return web.json_response({"ok": True, "device": conn.device_id, "text": text})
    except Exception as e:  # noqa: BLE001
        return web.json_response({"error": str(e)}, status=500)


async def _photo(request: web.Request) -> web.Response:
    """触发设备摄像头拍照, 返回最新原始 JPEG 的 base64。

    设备的 take_photo 会把图片 POST 到 /mcp/vision, vision_handler 在调
    VLLM 之前先把原图存进 goudan_photo_cache。这里触发拍照后从缓存取原图,
    交给 soul 自己看 (VLLM 配没配都不影响拿图)。
    """
    if not _auth_ok(request):
        return web.json_response({"error": "unauthorized"}, status=401)
    device_id = None
    question = "看看眼前有什么"
    try:
        if request.can_read_body:
            body = await request.json()
            device_id = body.get("device_id")
            if body.get("question"):
                question = str(body["question"])
    except Exception:
        pass

    conn = _pick_conn(device_id)
    if conn is None or getattr(conn, "websocket", None) is None:
        return web.json_response({"error": "device not connected", "known": list(_conns)}, status=404)

    did = conn.device_id
    mcp_client = getattr(conn, "mcp_client", None)
    if not mcp_client:
        return web.json_response({"error": "device mcp not ready"}, status=503)

    try:
        from core.providers.tools.device_mcp.mcp_handler import call_mcp_tool
        import goudan_photo_cache

        # 触发拍照。question 是必填参数(设备据此把图 POST 到 /mcp/vision);
        # 缺了它设备不会拍。设备完成后此调用才返回;VLLM 缺席时设备侧可能
        # 报错, 但原图此时已被 vision_handler 缓存, 忽略即可。
        args = json.dumps({"question": question})
        try:
            await call_mcp_tool(conn, mcp_client, "self.camera.take_photo", args, timeout=25)
        except Exception:
            pass

        data = None
        for _ in range(24):
            data = goudan_photo_cache.get(did)
            if data:
                break
            await asyncio.sleep(0.25)

        if not data:
            return web.json_response({"error": "no frame captured"}, status=504)
        return web.json_response(
            {"image": base64.b64encode(data).decode("utf-8"), "mimeType": "image/jpeg"}
        )
    except Exception as e:  # noqa: BLE001
        return web.json_response({"error": str(e)}, status=500)


async def _devices(_: web.Request) -> web.Response:
    return web.json_response({
        "connected": [
            {"device_id": d, "client_ip": getattr(c, "client_ip", "?")}
            for d, c in _conns.items()
        ]
    })


async def start_push_api():
    app = web.Application()
    app.router.add_post("/goudan/say", _say)
    app.router.add_post("/goudan/photo", _photo)
    app.router.add_get("/goudan/devices", _devices)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 9101)
    await site.start()


def install():
    loop = asyncio.get_event_loop()
    loop.create_task(start_push_api())
