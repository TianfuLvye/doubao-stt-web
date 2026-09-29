const STRINGS = {
  zh: {
    eyebrow: "豆包语音 · 录音文件识别模型 2.0",
    title: "语音转写",
    lede: "把录音拖进下面的区域。本地服务会把文件交给火山引擎，转成带时间戳和说话人的文字。单文件不超过 512MB、5 小时。结果通常要等几分钟。",
    langLegend: "语言",
    credentials: "接口凭证",
    show: "显示",
    hide: "隐藏",
    keyHelpBefore: "在",
    consoleLink: "豆包语音控制台",
    keyHelpAfter: "开通「豆包录音文件识别模型 2.0」，再到 API Key 管理里复制。Key 只留在这台电脑的浏览器里。",
    files: "录音文件",
    dropTitle: "把录音拖到这里，或点击选择",
    dropHint: "wav、mp3、m4a、aac、ogg、amr。可以一次放多段，会按顺序转写。",
    options: "识别选项",
    optSpeaker: "区分说话人",
    optPunc: "自动标点",
    optItn: "数字规整",
    optDdc: "去掉口头禅",
    optChannel: "左右声道分开",
    hotwords: "专有名词",
    hotwordsPlaceholder: "每行一个，例如人名、产品名、专业术语",
    hotwordsHint: "这些词会优先被识别出来。人名、产品名、专业术语可以写在这里。",
    submit: "开始转写",
    needFile: "请先把录音拖进来。",
    needKey: "请填写 API Key",
    selected: "已选 {count} 个文件，点「开始转写」。",
    badFormat: "「{name}」格式不支持。请换成 wav、mp3 或 m4a。",
    tooBig: "「{name}」超过 512MB。模型 2.0 单文件上限是 512MB、5 小时。",
    emptyFile: "「{name}」是空文件。",
    progressItem: "正在转写第 {index} / {total} 个：{name}",
    doneOne: "「{name}」转写完成。",
    failOne: "「{name}」转写失败。",
    allDone: "全部处理完了。",
    waiting: "正在转写「{name}」，已等待 {seconds} 秒。模型 2.0 要先提交再等待，几十分钟的录音通常要几分钟。",
    resultTitle: "转写结果",
    copy: "复制",
    copied: "已复制",
    download: "下载 txt",
    speaker: "说话人 {id}",
    speakerLabel: "说话人 {id} 的显示名称",
    noText: "识别成功，但没有返回文字。",
    httpFail: "转写失败（HTTP {status}）",
    noServer: "本地服务没有响应。请确认 server.py 还在运行。",
    clientTimeout: "等待太久，请求超时了。",
    failGeneric: "转写失败。",
    logid: "日志号 {id}{code}",
    logCode: " · 状态 {code}",
    downloadBase: "转写",
    downloadSuffix: "-转写.txt",
  },
  en: {
    eyebrow: "Doubao Speech · Recording File Recognition Model 2.0",
    title: "Speech Transcription",
    lede: "Drag a recording into the area below. This local app sends it to Volcano Engine and returns text with timestamps and speaker labels. A single file can be up to 512 MB and 5 hours. Results usually take a few minutes.",
    langLegend: "Language",
    credentials: "Credentials",
    show: "Show",
    hide: "Hide",
    keyHelpBefore: "In the ",
    consoleLink: "Doubao Speech Console",
    keyHelpAfter: ", activate “Doubao Recording File Recognition Model 2.0”, then copy the key from API Key Management. The key stays in this browser.",
    files: "Recording",
    dropTitle: "Drag a recording here, or click to choose",
    dropHint: "wav, mp3, m4a, aac, ogg, amr. You can add several files; they are transcribed in order.",
    options: "Options",
    optSpeaker: "Separate speakers",
    optPunc: "Add punctuation",
    optItn: "Normalize numbers",
    optDdc: "Remove filler words",
    optChannel: "Split left and right channels",
    hotwords: "Proper nouns",
    hotwordsPlaceholder: "One per line, such as names, product names, or technical terms",
    hotwordsHint: "These words are recognized first. Names, product names, and technical terms can go here.",
    submit: "Transcribe",
    needFile: "Add a recording first.",
    needKey: "Enter an API Key",
    selected: "{count} file(s) selected. Click “Transcribe”.",
    badFormat: "“{name}” is not a supported format. Use wav, mp3, or m4a.",
    tooBig: "“{name}” is over 512 MB. Model 2.0 allows up to 512 MB and 5 hours.",
    emptyFile: "“{name}” is empty.",
    progressItem: "Transcribing {index} / {total}: {name}",
    doneOne: "“{name}” is ready.",
    failOne: "“{name}” failed.",
    allDone: "All files are done.",
    waiting: "Transcribing “{name}”. Waited {seconds}s. Model 2.0 submits the file first, then waits. Recordings tens of minutes long usually take a few minutes.",
    resultTitle: "Transcript",
    copy: "Copy",
    copied: "Copied",
    download: "Download txt",
    speaker: "Speaker {id}",
    speakerLabel: "Display name for speaker {id}",
    noText: "Recognition succeeded, but no text was returned.",
    httpFail: "Transcription failed (HTTP {status})",
    noServer: "The local server did not respond. Check that server.py is still running.",
    clientTimeout: "The request timed out.",
    failGeneric: "Transcription failed.",
    logid: "Log {id}{code}",
    logCode: " · status {code}",
    downloadBase: "transcript",
    downloadSuffix: "-transcript.txt",
  },
};

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
const keyHelp = document.querySelector("#key-help");

const STORAGE_LANG = "doubao_stt_lang";
let lang = localStorage.getItem(STORAGE_LANG) === "en" ? "en" : "zh";
let statusRenderer = () => "";
let statusIsError = false;
const rendered = [];

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
const savedLang = document.querySelector(`input[name="ui-lang"][value="${lang}"]`);
if (savedLang) savedLang.checked = true;
applyLanguage();

document.querySelectorAll('input[name="ui-lang"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked) return;
    lang = input.value === "en" ? "en" : "zh";
    localStorage.setItem(STORAGE_LANG, lang);
    applyLanguage();
  });
});

toggleKey.addEventListener("click", () => {
  const show = apiKeyInput.type === "password";
  apiKeyInput.type = show ? "text" : "password";
  toggleKey.textContent = show ? t("hide") : t("show");
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
    setStatus(() => t("needFile"), true);
    fileInput.focus();
    return;
  }
  const invalid = queue.find((item) => item.issue);
  if (invalid) {
    setStatus(() => issueText(invalid.issue), true);
    return;
  }
  apiKeyInput.setCustomValidity(apiKeyInput.value.trim() ? "" : t("needKey"));
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
  queue = files.map((file) => ({ file, issue: fileIssue(file) }));
  renderQueue();
  if (!queue.length) {
    setStatus("");
    return;
  }
  const problem = queue.find((item) => item.issue);
  if (problem) setStatus(() => issueText(problem.issue), true);
  else setStatus(() => t("selected", { count: queue.length }));
}

function fileIssue(file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
  if (ext && !SUPPORTED.has(ext)) return { key: "badFormat", name: file.name };
  if (file.size > MAX_BYTES) return { key: "tooBig", name: file.name };
  if (file.size === 0) return { key: "emptyFile", name: file.name };
  return null;
}

function issueText(issue) {
  return issue ? t(issue.key, { name: issue.name }) : "";
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
    meta.textContent = issueText(item.issue) || formatSize(item.file.size);
    li.append(name, meta);
    fileList.append(li);
  }
}

async function runQueue() {
  busy = true;
  submitButton.disabled = true;
  rendered.length = 0;
  resultsEl.replaceChildren();
  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    setStatus(() => t("progressItem", { index: index + 1, total: queue.length, name: item.file.name }));
    try {
      const payload = await transcribe(item.file);
      appendResult(payload);
      setStatus(() => t("doneOne", { name: item.file.name }));
    } catch (error) {
      appendError(item.file.name, error);
      setStatus(() => t("failOne", { name: item.file.name }), true);
    }
  }
  progressEl.hidden = true;
  busy = false;
  submitButton.disabled = false;
  if (queue.length > 1) setStatus(() => t("allDone"));
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
    xhr.setRequestHeader("X-Ui-Lang", lang);
    xhr.responseType = "json";
    const started = Date.now();
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setStatus(() => t("waiting", { name: file.name, seconds }));
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
      const error = new Error(payload.message || t("httpFail", { status: xhr.status }));
      error.logid = payload.logid || "";
      error.statusCode = payload.status_code || "";
      reject(error);
    });

    xhr.addEventListener("error", () => {
      window.clearInterval(timer);
      reject(new Error(t("noServer")));
    });

    xhr.addEventListener("timeout", () => {
      window.clearInterval(timer);
      reject(new Error(t("clientTimeout")));
    });

    xhr.send(body);
  });
}

function appendResult(payload) {
  const record = { type: "ok", payload, names: {} };
  rendered.push(record);
  const card = renderOkCard(record);
  resultsEl.append(card);
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderOkCard(record) {
  const payload = record.payload;
  const card = document.createElement("article");
  card.className = "result-card";

  const header = document.createElement("header");
  const title = document.createElement("h2");
  const duration = payload.duration_ms ? ` · ${formatClock(payload.duration_ms)}` : "";
  title.textContent = `${payload.filename || t("resultTitle")}${duration}`;

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "ghost";
  copyButton.textContent = t("copy");
  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.className = "ghost";
  downloadButton.textContent = t("download");
  actions.append(copyButton, downloadButton);
  header.append(title, actions);
  card.append(header);

  const paragraphs = groupUtterances(payload.utterances || []);
  const speakerIds = [...new Set(paragraphs.map((item) => item.speaker).filter(Boolean))];

  if (speakerIds.length) {
    const speakers = document.createElement("div");
    speakers.className = "speakers";
    for (const id of speakerIds) {
      const label = document.createElement("label");
      const prefix = document.createElement("span");
      prefix.textContent = t("speaker", { id });
      const input = document.createElement("input");
      input.type = "text";
      input.value = record.names[id] || t("speaker", { id });
      input.setAttribute("aria-label", t("speakerLabel", { id }));
      input.addEventListener("input", () => {
        const fallback = t("speaker", { id });
        const value = input.value.trim();
        record.names[id] = value && value !== fallback ? value : "";
        paintTranscript();
      });
      label.append(prefix, input);
      speakers.append(label);
    }
    card.append(speakers);
  }

  const list = document.createElement("ol");
  list.className = "transcript";
  card.append(list);

  function displayName(speaker) {
    if (!speaker) return "";
    return record.names[speaker] || t("speaker", { id: speaker });
  }

  function paintTranscript() {
    list.replaceChildren();
    if (!paragraphs.length) {
      const plain = document.createElement("p");
      plain.className = "plain-text";
      plain.textContent = payload.text || t("noText");
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
    copyButton.textContent = t("copied");
    window.setTimeout(() => {
      copyButton.textContent = t("copy");
    }, 1600);
  });

  downloadButton.addEventListener("click", () => {
    const base = (payload.filename || t("downloadBase")).replace(/\.[^.]+$/, "");
    const blob = new Blob([exportText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${base}${t("downloadSuffix")}`;
    link.click();
    URL.revokeObjectURL(url);
  });

  paintTranscript();
  return card;
}

function appendError(filename, error) {
  const record = {
    type: "err",
    filename,
    message: error.message || "",
    logid: error.logid || "",
    statusCode: error.statusCode || "",
  };
  rendered.push(record);
  resultsEl.append(renderErrCard(record));
}

function renderErrCard(record) {
  const card = document.createElement("article");
  card.className = "result-card error-card";
  const title = document.createElement("h2");
  title.textContent = record.filename;
  const message = document.createElement("p");
  message.textContent = record.message || t("failGeneric");
  card.append(title, message);
  if (record.logid) {
    const log = document.createElement("p");
    log.className = "logid";
    const code = record.statusCode ? t("logCode", { code: record.statusCode }) : "";
    log.textContent = t("logid", { id: record.logid, code });
    card.append(log);
  }
  return card;
}

function renderAllResults() {
  resultsEl.replaceChildren();
  for (const record of rendered) {
    resultsEl.append(record.type === "ok" ? renderOkCard(record) : renderErrCard(record));
  }
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

function setStatus(render, isError = false) {
  statusRenderer = typeof render === "function" ? render : () => render;
  statusIsError = Boolean(isError);
  paintStatus();
}

function paintStatus() {
  statusEl.textContent = statusRenderer();
  statusEl.classList.toggle("is-error", statusIsError && Boolean(statusEl.textContent));
}

function t(key, vars = {}) {
  const table = STRINGS[lang] || STRINGS.zh;
  let text = table[key] ?? STRINGS.zh[key] ?? key;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

function applyLanguage() {
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  toggleKey.textContent = apiKeyInput.type === "password" ? t("show") : t("hide");
  renderKeyHelp();
  renderQueue();
  paintStatus();
  renderAllResults();
}

function renderKeyHelp() {
  const link = document.createElement("a");
  link.href = "https://console.volcengine.com/speech/new/overview";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = t("consoleLink");
  keyHelp.replaceChildren(document.createTextNode(t("keyHelpBefore")), link, document.createTextNode(t("keyHelpAfter")));
}
