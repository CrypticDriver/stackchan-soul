#!/usr/bin/env python3
"""
StackChan body adapter — bridges stackchan-soul's generic body endpoints
(status / look / speak) to the goudan stack on the same host:

  status → is the device's WS session registered with xiaozhi-server?
  look   → trigger the device to capture + describe via the voice
           device camera; the soul sees the raw image itself (multimodal)
  speak  → goudan_push /goudan/say (existing push channel)

Any other device can replace this file: implement the same three routes
and point soul.config.json at them.

Run: SOUL_ADAPTER_PORT=9201 python3 adapter.py   (loopback only)
"""
import json
import os
import urllib.request

from aiohttp import web

PORT = int(os.environ.get("SOUL_ADAPTER_PORT", "9201"))
PUSH_URL = os.environ.get("PUSH_URL", "http://127.0.0.1:9101/goudan/say")
BODY_TOKEN = os.environ.get("BODY_TOKEN", "")
# Photo: goudan_push hook that triggers the device camera and returns
# base64 JPEG. The soul sees the raw image itself (it is multimodal).
PHOTO_URL = os.environ.get("PHOTO_URL", "http://127.0.0.1:9101/goudan/photo")
# Device presence: goudan_push exposes the real WS connection list
DEVICES_URL = os.environ.get("DEVICES_URL", "http://127.0.0.1:9101/goudan/devices")


def _post_json(url: str, payload: dict, headers: dict, timeout: int = 60) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", **headers}
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


async def status(_req: web.Request) -> web.Response:
    """Online = device WS actually registered in goudan_push's connection list.
    (Probing /goudan/say status codes lies: a 400 "device not connected" used
    to read as online. Ask /goudan/devices for the truth instead.)"""
    online = False
    try:
        req = urllib.request.Request(DEVICES_URL, headers={"X-Body-Token": BODY_TOKEN})
        with urllib.request.urlopen(req, timeout=5) as r:
            online = bool(json.load(r).get("connected"))
    except Exception:
        online = False
    return web.json_response({"online": online})


async def look(req: web.Request) -> web.Response:
    """Grab the freshest camera frame from the device and hand the RAW image
    back to the soul. The soul IS a multimodal model — it sees the picture
    with its own eyes; no external describer. Returns {image, mimeType} or
    {text} on failure.

    Photo capture goes through goudan_push's /goudan/photo hook, which
    triggers the device's take_photo MCP tool and returns base64 JPEG.
    """
    try:
        body = await req.json() if req.can_read_body else {}
        question = (body or {}).get("question") or "看看眼前有什么"
        r = _post_json(PHOTO_URL, {"question": question}, {"X-Body-Token": BODY_TOKEN}, timeout=30)
        if r.get("image"):
            return web.json_response({"image": r["image"], "mimeType": r.get("mimeType", "image/jpeg")})
        return web.json_response({"text": "（没拍成——身体大概不在线或摄像头没准备好）"})
    except Exception as e:
        return web.json_response({"text": f"（睁眼失败: {e}）"}, status=200)


async def speak(req: web.Request) -> web.Response:
    body = await req.json()
    try:
        # Timeout MUST exceed push's anti-echo hold (30s): if we give up first
        # the push still speaks after its hold, the soul sees an error and
        # retries — the human hears the same answer 3-4 times.
        _post_json(PUSH_URL, {"text": body.get("text", "")}, {"X-Body-Token": BODY_TOKEN}, timeout=55)
        return web.json_response({"ok": True})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=502)


app = web.Application()
app.router.add_post("/status", status)
app.router.add_post("/look", look)
app.router.add_post("/speak", speak)

if __name__ == "__main__":
    web.run_app(app, host="127.0.0.1", port=PORT, print=None)
