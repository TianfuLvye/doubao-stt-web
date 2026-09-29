# 录音转写

本地网页。把录音拖进去，经火山引擎豆包「录音文件识别模型 2.0」转成带时间戳和说话人的文字。

## 准备API

1. 打开 [豆包语音控制台](https://console.volcengine.com/speech/new/overview)，开通「豆包录音文件识别模型 2.0」。
2. 在 API Key 管理里复制 API Key。

模型 2.0 单文件不超过 512MB、5 小时。经测试，几十分钟的录音通常等几分钟即可。

## Quick Start

第一次准备项目时执行。会创建本机 Python 环境并安装依赖。

```bash
cd ./doubao_stt
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

看到「打开 [http://127.0.0.1:8765](http://127.0.0.1:8765) 」后，用浏览器打开这个地址，粘贴 API Key，把录音拖进选框。

## Run

日常使用，新开一个终端时，你需要先执行`source .venv/bin/activate`激活环境。

```bash
cd ./doubao_stt
source .venv/bin/activate
python server.py
```

终端窗口需要保持开启状态，关掉它，网页就停了。

你的 API Key 存在本机浏览器里。也可以把它写到 `.env` 的 `VOLCENGINE_API_KEY`。