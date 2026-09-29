const form = document.querySelector("#form");
const fileInput = document.querySelector("#file");
const dropzone = document.querySelector("#dropzone");
const fileList = document.querySelector("#file-list");
const apiKeyInput = document.querySelector("#api-key");
const toggleKey = document.querySelector("#toggle-key");
const submitButton = document.querySelector("#submit");
const statusEl = document.querySelector("#status");
const progressEl = document.querySelector("#progress");
const resultsEl = document.querySelector("#results");
const hotwordsInput = document.querySelector("#hotwords");

const OPTION_IDS = [
  "enable-speaker",
  "enable-punc",
  "enable-itn",
  "enable-ddc",
  "enable-channel",
];

const STORAGE_KEY = "doubao_stt_api_key";
const STORAGE_OPTIONS = "doubao_stt_options";
const MAX_BYTES = 512 * 1024 * 1024;
const SUPPORTED = new Set(["wav", "mp3", "mpeg", "ogg", "opus", "spx", "amr", "aac", "m4a", "mp4"]);

let queue = [];
let busy = false;

restoreSettings();

toggleKey.addEventListener("click", () => {
  const show = apiKeyInput.type === "password";
  apiKeyInput.type = show ? "text" : "password";
  toggleKey.textContent = show ? "隐藏" : "显示";
  toggleKey.setAttribute("aria-pressed", show ? "true" : "false");
});

apiKeyInput.addEventListener("change", () => {
  localStorage.setItem(STORAGE_KEY, apiKeyInput.value.trim());
});

hotwordsInput.addEventListener("change", saveOptions);
for (const id of OPTION_IDS) {
  document.querySelector(`#${id}`).addEventListener("change", saveOptions);
}

fileInput.addEventListener("change", () => {
  setQueue(Array.from(fileInput.files || []));
});

["dragenter", "dragover"].forEach((name) => {
  dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-hot");
  });
});

["dragleave", "drop"].forEach((name) => {
  dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-hot");
  });
});

dropzone.addEventListener("drop", (event) => {
  const files = Array.from(event.dataTransfer?.files || []);
  if (!files.length) return;
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  fileInput.files = transfer.files;
  setQueue(files);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (busy) return;
  if (!queue.length) {
    setStatus("请先把录音拖进来。", true);
    fileInput.focus();
    return;
  }
  const invalid = queue.find((item) => item.error);
  if (invalid) {
    setStatus(invalid.error, true);
    return;
  }
  apiKeyInput.setCustomValidity(apiKeyInput.value.trim() ? "" : "请填写 API Key");
  if (!form.reportValidity()) return;
  localStorage.setItem(STORAGE_KEY, apiKeyInput.value.trim());
  saveOptions();
  runQueue();
});

function restoreSettings() {
  const savedKey = localStorage.getItem(STORAGE_KEY);
  if (savedKey) apiKeyInput.value = savedKey;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_OPTIONS) || "{}");
  } catch {
    saved = {};
  }
  if (typeof saved.hotwords === "string") hotwordsInput.value = saved.hotwords;
  for (const id of OPTION_IDS) {
    if (typeof saved[id] === "boolean") {
      document.querySelector(`#${id}`).checked = saved[id];
    }
  }
}

function saveOptions() {
  const payload = { hotwords: hotwordsInput.value };
  for (const id of OPTION_IDS) {
    payload[id] = document.querySelector(`#${id}`).checked;
  }
  localStorage.setItem(STORAGE_OPTIONS, JSON.stringify(payload));
}

function setQueue(files) {
  queue = files.map((file) => ({ file, error: validateFile(file) }));
  renderQueue();
  if (!queue.length) {
    setStatus("");
    return;
  }
  const problem = queue.find((item) => item.error);
  setStatus(problem ? problem.error : `已选 ${queue.length} 个文件，点「开始转写」。`, Boolean(problem));
}

function validateFile(file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
  if (ext && !SUPPORTED.has(ext)) {
    return `「${file.name}」格式不支持。请换成 wav、mp3 或 m4a。`;
  }
  if (file.size > MAX_BYTES) {
    return `「${file.name}」超过 512MB。模型 2.0 单文件上限是 512MB、5 小时。`;
  }
  if (file.size === 0) return `「${file.name}」是空文件。`;
  return "";
}

function renderQueue() {
  fileList.replaceChildren();
  if (!queue.length) {
    fileList.hidden = true;
    return;
  }
  fileList.hidden = false;
  for (const item of queue) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = item.file.name;
    const meta = document.createElement("span");
    meta.className = "file-meta";
    meta.textContent = item.error || formatSize(item.file.size);
    li.append(name, meta);
    fileList.append(li);
  }
}

async function runQueue() {
  busy = true;
  submitButton.disabled = true;
  resultsEl.replaceChildren();
  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    setStatus(`正在转写第 ${index + 1} / ${queue.length} 个：${item.file.name}`);
    try {
      const payload = await transcribe(item.file);
      appendResult(payload);
      setStatus(`「${item.file.name}」转写完成。`);
    } catch (error) {
      appendError(item.file.name, error);
      setStatus(`「${item.file.name}」转写失败。`, true);
    }
  }
  progressEl.hidden = true;
  busy = false;
  submitButton.disabled = false;
  if (queue.length > 1) setStatus("全部处理完了。");
}

function transcribe(file) {
  const body = new FormData();
  body.append("file", file, file.name);
  body.append("api_key", apiKeyInput.value.trim());
  body.append("hotwords", hotwordsInput.value);
  body.append("enable_speaker_info", checkedValue("enable-speaker"));
  body.append("enable_punc", checkedValue("enable-punc"));
  body.append("enable_itn", checkedValue("enable-itn"));
  body.append("enable_ddc", checkedValue("enable-ddc"));
  body.append("enable_channel_split", checkedValue("enable-channel"));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/transcribe");
    xhr.responseType = "json";
    const started = Date.now();
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setStatus(`正在转写「${file.name}」，已等待 ${seconds} 秒。模型 2.0 要先提交再等待，几十分钟的录音通常要几分钟。`);
    }, 1000);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      progressEl.hidden = false;
      progressEl.max = event.total;
      progressEl.value = event.loaded;
      if (event.loaded >= event.total) {
        progressEl.removeAttribute("value");
      }
    });

    xhr.addEventListener("load", () => {
      window.clearInterval(timer);
      const payload = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300 && payload.ok) {
        resolve(payload);
        return;
      }
      const error = new Error(payload.message || `转写失败（HTTP ${xhr.status}）`);
      error.logid = payload.logid || "";
      error.statusCode = payload.status_code || "";
      reject(error);
    });

    xhr.addEventListener("error", () => {
      window.clearInterval(timer);
      reject(new Error("本地服务没有响应。请确认 server.py 还在运行。"));
    });

    xhr.addEventListener("timeout", () => {
      window.clearInterval(timer);
      reject(new Error("等待太久，请求超时了。"));
    });

    xhr.send(body);
  });
}

function appendResult(payload) {
  const card = document.createElement("article");
  card.className = "result-card";

  const header = document.createElement("header");
  const title = document.createElement("h2");
  const duration = payload.duration_ms ? ` · ${formatClock(payload.duration_ms)}` : "";
  title.textContent = `${payload.filename || "转写结果"}${duration}`;

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "ghost";
  copyButton.textContent = "复制";
  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.className = "ghost";
  downloadButton.textContent = "下载 txt";
  actions.append(copyButton, downloadButton);
  header.append(title, actions);
  card.append(header);

  const paragraphs = groupUtterances(payload.utterances || []);
  const names = new Map();
  const speakerIds = [...new Set(paragraphs.map((item) => item.speaker).filter(Boolean))];

  if (speakerIds.length) {
    const speakers = document.createElement("div");
    speakers.className = "speakers";
    for (const id of speakerIds) {
      const label = document.createElement("label");
      label.textContent = `说话人 ${id}`;
      const input = document.createElement("input");
      input.type = "text";
      input.value = `说话人 ${id}`;
      input.setAttribute("aria-label", `说话人 ${id} 的显示名称`);
      names.set(id, input.value);
      input.addEventListener("input", () => {
        names.set(id, input.value.trim() || `说话人 ${id}`);
        paintTranscript();
      });
      label.append(input);
      speakers.append(label);
    }
    card.append(speakers);
  }

  const list = document.createElement("ol");
  list.className = "transcript";
  card.append(list);

  function displayName(speaker) {
    if (!speaker) return "";
    return names.get(speaker) || `说话人 ${speaker}`;
  }

  function paintTranscript() {
    list.replaceChildren();
    if (!paragraphs.length) {
      const plain = document.createElement("p");
      plain.className = "plain-text";
      plain.textContent = payload.text || "识别成功，但没有返回文字。";
      list.replaceWith(plain);
      return;
    }
    for (const paragraph of paragraphs) {
      const item = document.createElement("li");
      const when = document.createElement("div");
      when.className = "when";
      when.textContent = formatClock(paragraph.start);
      const body = document.createElement("div");
      if (paragraph.speaker) {
        const who = document.createElement("div");
        who.className = `who who-${Number(paragraph.speaker) || 1}`;
        who.textContent = displayName(paragraph.speaker);
        body.append(who);
      }
      const text = document.createElement("p");
      text.className = "line-text";
      text.textContent = paragraph.text;
      body.append(text);
      item.append(when, body);
      list.append(item);
    }
  }

  function exportText() {
    if (!paragraphs.length) return payload.text || "";
    return paragraphs
      .map((paragraph) => {
        const who = displayName(paragraph.speaker);
        const head = who ? `[${formatClock(paragraph.start)}] ${who}` : `[${formatClock(paragraph.start)}]`;
        return `${head}\n${paragraph.text}`;
      })
      .join("\n\n");
  }

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(exportText());
    copyButton.textContent = "已复制";
    window.setTimeout(() => {
      copyButton.textContent = "复制";
    }, 1600);
  });

  downloadButton.addEventListener("click", () => {
    const base = (payload.filename || "转写").replace(/\.[^.]+$/, "");
    const blob = new Blob([exportText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${base}-转写.txt`;
    link.click();
    URL.revokeObjectURL(url);
  });

  paintTranscript();
  resultsEl.append(card);
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function appendError(filename, error) {
  const card = document.createElement("article");
  card.className = "result-card error-card";
  const title = document.createElement("h2");
  title.textContent = filename;
  const message = document.createElement("p");
  message.textContent = error.message || "转写失败。";
  card.append(title, message);
  if (error.logid) {
    const log = document.createElement("p");
    log.className = "logid";
    log.textContent = `日志号 ${error.logid}${error.statusCode ? ` · 状态 ${error.statusCode}` : ""}`;
    card.append(log);
  }
  resultsEl.append(card);
}

function groupUtterances(utterances) {
  const paragraphs = [];
  for (const item of utterances) {
    const text = (item.text || "").trim();
    if (!text) continue;
    const speaker = item.speaker || "";
    const start = Number(item.start_time) || 0;
    const end = Number(item.end_time) || start;
    const previous = paragraphs[paragraphs.length - 1];
    if (previous && previous.speaker === speaker && start - previous.end < 2500) {
      previous.text += text;
      previous.end = end;
      continue;
    }
    paragraphs.push({ speaker, start, end, text });
  }
  return paragraphs;
}

function formatClock(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function checkedValue(id) {
  return document.querySelector(`#${id}`).checked ? "1" : "0";
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", Boolean(isError));
}
