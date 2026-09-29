#!/usr/bin/env python3
"""本地网页：拖入录音，调用豆包录音文件识别模型 2.0 做语音转写。"""

from __future__ import annotations

import base64
import json
import os
import time
import uuid
import urllib.error
import urllib.request
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"

SUBMIT_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit"
QUERY_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/query"
RESOURCE_ID = "volc.seedasr.auc"
MAX_BYTES = 512 * 1024 * 1024
SUBMIT_TIMEOUT = 180
QUERY_TIMEOUT = 30
POLL_INTERVAL = 3
POLL_DEADLINE = 30 * 60
PENDING = {"20000001", "20000002"}
SUCCESS = "20000000"

FORMATS = {
    ".wav": "wav",
    ".mp3": "mp3",
    ".mpeg": "mp3",
    ".ogg": "ogg",
    ".opus": "ogg",
    ".spx": "spx",
    ".amr": "amr",
    ".aac": "aac",
    ".m4a": "m4a",
    ".mp4": "mp4",
}

STATUS_HINTS = {
    "20000000": "识别成功",
    "20000003": "音频里几乎没有人声",
    "45000001": "请求参数无效。请确认开通的是豆包录音文件识别模型 2.0，并且文件是 wav、mp3、m4a 等支持的格式。",
    "45000010": "API Key 无效。请到豆包语音控制台的 API Key 管理里重新复制。",
    "45000002": "音频是空的",
    "45000132": "文件超过模型 2.0 的大小限制（512MB）。",
    "45000151": "音频格式无法解码。请另存为 mp3 或 m4a 后再试。",
    "55000031": "火山引擎这会儿繁忙，过一两分钟再试。",
}

app = Flask(__name__, static_folder=str(STATIC), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = MAX_BYTES
app.json.ensure_ascii = False


def load_env_file() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def detect_format(filename: str, data: bytes) -> str | None:
    ext = Path(filename).suffix.lower()
    if ext in FORMATS:
        return FORMATS[ext]
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "wav"
    if data[:3] == b"ID3" or (len(data) >= 2 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0):
        return "mp3"
    if len(data) >= 8 and data[4:8] == b"ftyp":
        return "m4a"
    if data[:4] == b"OggS":
        return "ogg"
    if data[:6] == b"#!AMR\n":
        return "amr"
    return None


def flag(name: str, default: bool = False) -> bool:
    raw = request.form.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "on", "yes"}


def parse_hotwords(raw: str) -> list[str]:
    words: list[str] = []
    for chunk in raw.replace("，", "\n").replace(",", "\n").replace("；", "\n").replace(";", "\n").splitlines():
        word = chunk.strip()
        if word and word not in words:
            words.append(word)
    return words[:200]


def slim_utterances(result: dict) -> list[dict]:
    utterances = []
    for item in result.get("utterances") or []:
        if not isinstance(item, dict):
            continue
        additions = item.get("additions") if isinstance(item.get("additions"), dict) else {}
        speaker = additions.get("speaker")
        utterances.append(
            {
                "text": item.get("text") or "",
                "start_time": item.get("start_time") or 0,
                "end_time": item.get("end_time") or 0,
                "speaker": "" if speaker is None else str(speaker),
            }
        )
    return utterances


def post_json(url: str, api_key: str, request_id: str, payload: dict, timeout: int) -> tuple[dict, dict]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Api-Key": api_key,
            "X-Api-Resource-Id": RESOURCE_ID,
            "X-Api-Request-Id": request_id,
            "X-Api-Sequence": "-1",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            headers = resp.headers
            http_status = resp.status
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        headers = exc.headers
        http_status = exc.code
    except TimeoutError as exc:
        raise TimeoutError("等待火山引擎超时。") from exc
    except urllib.error.URLError as exc:
        if isinstance(exc.reason, TimeoutError):
            raise TimeoutError("等待火山引擎超时。") from exc
        raise UpstreamError(f"连不上火山引擎：{exc.reason}") from exc

    meta = {
        "http_status": http_status,
        "status_code": headers.get("X-Api-Status-Code", ""),
        "message": headers.get("X-Api-Message", ""),
        "logid": headers.get("X-Tt-Logid", ""),
        "request_id": request_id,
    }
    try:
        body = json.loads(raw.decode("utf-8")) if raw else {}
    except json.JSONDecodeError:
        body = {"raw": raw[:500].decode("utf-8", errors="replace")}
    if not isinstance(body, dict):
        body = {"raw": body}
    return meta, body


def call_model(api_key: str, audio_format: str, audio_bytes: bytes, options: dict) -> tuple[dict, dict]:
    audio: dict = {
        "data": base64.b64encode(audio_bytes).decode("ascii"),
        "format": audio_format,
    }
    if audio_format == "ogg":
        audio["codec"] = "opus"

    request_body: dict = {
        "model_name": "bigmodel",
        "enable_itn": options["enable_itn"],
        "enable_punc": options["enable_punc"],
        "enable_ddc": options["enable_ddc"],
        "enable_speaker_info": options["enable_speaker_info"],
        "enable_channel_split": options["enable_channel_split"],
        "show_utterances": True,
    }
    if options["hotwords"]:
        request_body["corpus"] = {
            "context": json.dumps(
                {"hotwords": [{"word": word} for word in options["hotwords"]]},
                ensure_ascii=False,
            )
        }

    request_id = str(uuid.uuid4())
    meta, body = post_json(
        SUBMIT_URL,
        api_key,
        request_id,
        {
            "user": {"uid": "doubao-stt-local"},
            "audio": audio,
            "request": request_body,
        },
        SUBMIT_TIMEOUT,
    )
    print(
        f"submit request_id={request_id} bytes={len(audio_bytes)} format={audio_format} "
        f"status={meta['status_code']} logid={meta['logid']}",
        flush=True,
    )
    if meta["status_code"] not in {SUCCESS, *PENDING}:
        return meta, body

    deadline = time.monotonic() + POLL_DEADLINE
    while time.monotonic() < deadline:
        time.sleep(POLL_INTERVAL)
        try:
            meta, body = post_json(QUERY_URL, api_key, request_id, {}, QUERY_TIMEOUT)
        except TimeoutError:
            print(f"query timeout request_id={request_id}", flush=True)
            continue
        print(f"query request_id={request_id} status={meta['status_code']} logid={meta['logid']}", flush=True)
        if meta["status_code"] in PENDING:
            continue
        return meta, body

    raise UpstreamError("任务已提交，但 30 分钟内还没有结果。可以过一会儿再试一次。")


class UpstreamError(Exception):
    pass


@app.get("/")
def index():
    return send_from_directory(STATIC, "index.html")


@app.errorhandler(413)
def too_large(_exc):
    return jsonify(ok=False, message="文件超过 512MB。模型 2.0 单文件上限是 512MB、5 小时。"), 413


@app.post("/api/transcribe")
def transcribe():
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify(ok=False, message="请先选择录音文件。"), 400

    api_key = (request.form.get("api_key") or os.environ.get("VOLCENGINE_API_KEY") or "").strip()
    if not api_key:
        return jsonify(ok=False, message="请填写火山引擎 API Key。"), 400

    data = upload.read()
    if not data:
        return jsonify(ok=False, message="这个文件是空的。"), 400
    if len(data) > MAX_BYTES:
        return jsonify(ok=False, message="文件超过 512MB。模型 2.0 单文件上限是 512MB、5 小时。"), 400

    audio_format = detect_format(upload.filename, data)
    if audio_format is None:
        return jsonify(
            ok=False,
            message="不支持这个格式。请使用 wav、mp3、m4a、aac、ogg、amr。",
        ), 400

    options = {
        "enable_itn": flag("enable_itn", True),
        "enable_punc": flag("enable_punc", True),
        "enable_ddc": flag("enable_ddc", False),
        "enable_speaker_info": flag("enable_speaker_info", True),
        "enable_channel_split": flag("enable_channel_split", False),
        "hotwords": parse_hotwords(request.form.get("hotwords") or ""),
    }

    try:
        meta, body = call_model(api_key, audio_format, data, options)
    except UpstreamError as exc:
        return jsonify(ok=False, message=str(exc)), 502
    except TimeoutError:
        return jsonify(ok=False, message="等待火山引擎超时。文件很大时可以再试一次。"), 504

    print(
        f"transcribe file={upload.filename!r} bytes={len(data)} format={audio_format} "
        f"http={meta['http_status']} status={meta['status_code']} logid={meta['logid']}"
    )

    if meta["status_code"] != "20000000":
        hint = STATUS_HINTS.get(meta["status_code"])
        detail = meta["message"] or (body.get("message") if isinstance(body.get("message"), str) else "")
        if hint and detail and detail not in hint:
            message = f"{hint}（{detail}）"
        else:
            message = hint or detail or "火山引擎没有返回识别结果。"
        if not meta["status_code"] and meta["http_status"] and meta["http_status"] != 200:
            message = f"火山引擎返回 HTTP {meta['http_status']}。{message}".strip()
        return jsonify(
            ok=False,
            message=message.strip(),
            status_code=meta["status_code"],
            logid=meta["logid"],
        ), 502

    result = body.get("result")
    if isinstance(result, list):
        result = result[0] if result and isinstance(result[0], dict) else {}
    if not isinstance(result, dict):
        result = {}
    audio_info = body.get("audio_info") if isinstance(body.get("audio_info"), dict) else {}
    text = result.get("text") or ""
    return jsonify(
        ok=True,
        filename=upload.filename,
        text=text,
        duration_ms=audio_info.get("duration") or 0,
        utterances=slim_utterances(result),
        logid=meta["logid"],
    )


if __name__ == "__main__":
    load_env_file()
    print("打开 http://127.0.0.1:8765")
    app.run(host="127.0.0.1", port=8765, debug=False)
