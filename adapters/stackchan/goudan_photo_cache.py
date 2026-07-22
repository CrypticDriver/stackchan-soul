"""goudan_photo_cache — 最新原始帧缓存 (stackchan-soul 缸中脑之眼)。

vision_handler 收到设备上传的 JPEG 时先在这里存一份原图;
goudan_push 的 /goudan/photo 读它, 把原始 JPEG 交给 soul 自己看
(soul 是多模态 Sonnet, 要的是原图不是文字转述)。
"""
import time

_frames = {}  # device_id -> (jpeg_bytes, ts)


def put(device_id: str, data: bytes) -> None:
    if device_id and data:
        _frames[device_id] = (data, time.time())


def get(device_id=None, max_age: float = 20.0):
    now = time.time()
    if device_id and device_id in _frames:
        data, ts = _frames[device_id]
        return data if now - ts <= max_age else None
    if not device_id and _frames:
        data, ts = max(_frames.values(), key=lambda x: x[1])
        return data if now - ts <= max_age else None
    return None
