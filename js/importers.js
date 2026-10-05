/* InkFlow · 导入器：TXT/MD · PDF · Word(.docx) · 图片(OCR)
 *
 * 全部在浏览器本地完成：
 *  - PDF  ：pdf.js（本地 vendor）
 *  - Word ：mammoth（本地 vendor）→ HTML → 文本/Markdown
 *  - 图片 ：tesseract.js（本地 vendor + 本地语言包）→ 文本
 *  - 文本 ：FileReader
 * 全程不发起任何网络请求（worker / wasm / 语言包均来自同源本地文件）。
 */
(function (global) {
  "use strict";

  var BASE = (function () {
    try {
      var s = document.currentScript && document.currentScript.src;
      return s ? s.replace(/js\/importers\.js.*$/, "") : "";
    } catch (e) { return ""; }
  })();

  var TEXT_EXT = /^(md|markdown|txt|text|csv|json|tex|latex)$/i;
  var IMG_EXT = /^(png|jpe?g|webp|bmp|gif)$/i;
  var status = null, hint = null, host = null;

  function el(id) { return document.getElementById(id); }
  function setStatus(msg, kind, sticky) {
    if (!status) status = el("importStatus");
    if (!status) return;
    if (!msg) { status.hidden = true; status.textContent = ""; return; }
    status.hidden = false;
    status.textContent = msg;
    status.className = "import-status " + (kind || "");
    if (!sticky) setTimeout(function () { if (status.textContent === msg) { status.hidden = true; } }, 4200);
  }

  /* ---------- 文本 ---------- */
  function readText(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || "")); };
      r.onerror = function () { reject(new Error("读取失败")); };
      r.readAsText(file, "utf-8");
    });
  }

  /* ---------- PDF ---------- */
  var pdfReady = false;
  function ensurePdf() {
    if (pdfReady) return true;
    var lib = global.pdfjsLib;
    if (!lib) return false;
    try {
      lib.GlobalWorkerOptions.workerSrc = BASE + "vendor/pdf.worker.min.js";
    } catch (e) {}
    pdfReady = true;
    return true;
  }
  async function readPdf(file) {
    if (!ensurePdf()) throw new Error("PDF 组件未就绪");
    var buf = await file.arrayBuffer();
    var doc = await global.pdfjsLib.getDocument({ data: buf, disableFontFace: false }).promise;
    var out = [];
    for (var p = 1; p <= doc.numPages; p++) {
      setStatus("正在解析 PDF：第 " + p + " / " + doc.numPages + " 页…", "busy", true);
      var page = await doc.getPage(p);
      var tc = await page.getTextContent();
      /* 按 y 坐标聚合成行，尽量还原段落 */
      var items = tc.items.map(function (it) {
        return { s: it.str, x: it.transform[4], y: it.transform[5], h: Math.abs(it.transform[3]) || 10 };
      }).filter(function (it) { return it.s && it.s.trim(); });
      items.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
      var lines = [], cur = null;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!cur || Math.abs(cur.y - it.y) > Math.max(2, it.h * 0.6)) { cur = { y: it.y, parts: [it] }; lines.push(cur); }
        else cur.parts.push(it);
      }
      var text = lines.map(function (ln) {
        ln.parts.sort(function (a, b) { return a.x - b.x; });
        var s = "";
        for (var j = 0; j < ln.parts.length; j++) {
          var t = ln.parts[j].s;
          if (s && !/\s$/.test(s) && !/^\s/.test(t)) s += " ";
          s += t;
        }
        return s.replace(/\s+$/,"");
      }).join("\n");
      out.push(text);
    }
    return out.join("\n\n");
  }

  /* ---------- Word(.docx) ---------- */
  async function readDocx(file) {
    if (!global.mammoth) throw new Error("Word 组件未就绪");
    var buf = await file.arrayBuffer();
    var res = await global.mammoth.convertToHtml({ arrayBuffer: buf });
    var html = res.value || "";
    /* HTML → 纯文本（保留段落与列表结构） */
    var div = document.createElement("div");
    div.innerHTML = html;
    var blocks = [];
    var nodes = div.querySelectorAll("h1,h2,h3,h4,p,li,blockquote,pre");
    if (!nodes.length) return div.textContent || "";
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var tag = n.tagName.toLowerCase();
      var txt = (n.textContent || "").trim();
      if (!txt) continue;
      if (tag === "h1") blocks.push("# " + txt);
      else if (tag === "h2") blocks.push("## " + txt);
      else if (tag === "h3") blocks.push("### " + txt);
      else if (tag === "h4") blocks.push("#### " + txt);
      else if (tag === "li") blocks.push("- " + txt);
      else if (tag === "blockquote") blocks.push("> " + txt);
      else if (tag === "pre") blocks.push("```\n" + txt + "\n```");
      else blocks.push(txt);
    }
    return blocks.join("\n\n");
  }

  /* ---------- 图片 OCR ---------- */
  var ocrWorker = null;
  /* 浏览器不允许 file:// 页面创建 Worker 并 importScripts，
     因此图片识别只在 http(s) 环境（如已部署的线上版本）可用。 */
  function ocrSupported() {
    try { return location.protocol === "http:" || location.protocol === "https:"; } catch (e) { return false; }
  }
  function ensureOcr() {
    if (ocrWorker) return Promise.resolve(ocrWorker);
    if (!ocrSupported()) {
      return Promise.reject(new Error("图片识别需要 http(s) 环境：本地双击打开（file://）时浏览器不允许启动识别线程。请改用 PDF / Word / 文本导入，或访问已部署的在线版本。"));
    }
    if (!global.Tesseract) return Promise.reject(new Error("OCR 组件未就绪"));
    setStatus("正在初始化 OCR（首次较慢）…", "busy", true);
    return global.Tesseract.createWorker(["chi_sim", "eng"], 1, {
      workerPath: BASE + "vendor/tesseract.min.js",
      corePath: BASE + "vendor/",
      langPath: BASE + "vendor/tessdata",
      cacheMethod: "none",
      logger: function (m) {
        if (m && m.status) setStatus("OCR：" + m.status + (m.progress ? " " + Math.round(m.progress * 100) + "%" : ""), "busy", true);
      }
    }).then(function (w) { ocrWorker = w; return w; });
  }
  function fileToDataURL(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(new Error("图片读取失败")); };
      r.readAsDataURL(file);
    });
  }
  async function readImage(file) {
    var w = await ensureOcr();
    var url = await fileToDataURL(file);
    setStatus("正在识别图片文字…", "busy", true);
    var res = await w.recognize(url);
    var text = (res && res.data && res.data.text) || "";
    return cleanupOcr(text);
  }
  function cleanupOcr(t) {
    return String(t || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(function (l) { return l.replace(/[ \t]+/g, " ").trim(); })
      .filter(function (l) { return l.length > 0; })
      .join("\n");
  }

  /* ---------- 剪贴板图片 ---------- */
  function bindPaste(btn) {
    if (!btn) return;
    btn.addEventListener("click", function () {
      setStatus("请按 Ctrl/⌘ + V 粘贴图片…", "busy", true);
      function onPaste(e) {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].type && items[i].type.indexOf("image") === 0) {
            var f = items[i].getAsFile();
            if (f) {
              e.preventDefault();
              document.removeEventListener("paste", onPaste);
              handleFiles([f]);
              return;
            }
          }
        }
      }
      document.addEventListener("paste", onPaste, { once: false });
      setTimeout(function () { document.removeEventListener("paste", onPaste); }, 30000);
    });
  }

  /* ---------- 统一入口 ---------- */
  var ctx = { toast: function () {}, onDone: function () {} };
  async function handleFiles(files, opts) {
    if (opts) ctx = Object.assign({}, ctx, opts);
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    var acc = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var name = f.name || "image";
      var ext = (name.split(".").pop() || "").toLowerCase();
      try {
        var text = "";
        if (TEXT_EXT.test(ext)) { text = await readText(f); }
        else if (ext === "pdf") { setStatus("正在解析 PDF…", "busy", true); text = await readPdf(f); }
        else if (ext === "docx" || ext === "doc") {
          if (ext === "doc") { ctx.toast("旧版 .doc 请先另存为 .docx", "warn", 4200); continue; }
          setStatus("正在解析 Word…", "busy", true); text = await readDocx(f);
        }
        else if (IMG_EXT.test(ext) || (f.type && f.type.indexOf("image") === 0)) {
          if (!ocrSupported()) { ctx.toast("图片识别需要 http(s) 环境；本地打开时请改用 PDF / Word / 文本", "warn", 5200); continue; }
          text = await readImage(f);
        }
        else { ctx.toast("不支持的文件类型：" + ext, "warn", 3600); continue; }

        text = String(text || "").trim();
        if (!text) { ctx.toast(name + "：未识别到内容", "warn", 3600); continue; }
        if (ctx.queueMode && ctx.queueMode()) {
          /* 批量模式：逐个入队，转写交给队列 */
          if (ctx.onItem) ctx.onItem(name, ext || "text", text);
          setStatus("已加入队列：" + name, "ok");
        } else {
          acc.push(text);
          setStatus("已导入 " + name, "ok");
        }
      } catch (e) {
        ctx.toast(name + " 导入失败：" + (e && e.message || e), "err", 4600);
      }
    }
    if (acc.length) {
      var src = ctx.getSource ? ctx.getSource() : null;
      if (src) {
        var cur = src.value.trim();
        src.value = cur ? (cur + "\n\n" + acc.join("\n\n")) : acc.join("\n\n");
      }
      ctx.onDone && ctx.onDone();
      ctx.toast("已导入 " + acc.length + " 个文件（仅本地处理）", "ok", 3000);
    }
    setStatus("");
  }

  function bind(opts) {
    if (opts) ctx = Object.assign({}, ctx, opts);
    status = el("importStatus"); hint = el("importHint"); host = el("ocrHost");
    /* file:// 下禁用图片识别按钮并说明原因 */
    if (!ocrSupported()) {
      var bImg0 = el("importImage"), bPaste0 = el("importPaste");
      [bImg0, bPaste0].forEach(function (b) {
        if (!b) return;
        b.disabled = true;
        b.title = "图片识别需要 http(s) 环境；本地双击打开时不支持";
      });
      if (hint) hint.textContent = "支持 Markdown / TXT / PDF / Word(.docx)。图片识别需 http(s) 环境（线上版本可用），本地双击打开时不可用。";
    }
    var fi = el("fileInput");
    var bFile = el("importFile"), bImg = el("importImage"), bPaste = el("importPaste");
    if (bFile && fi) bFile.addEventListener("click", function () { fi.click(); });
    if (bImg && fi) bImg.addEventListener("click", function () {
      fi.setAttribute("accept", ".png,.jpg,.jpeg,.webp,.bmp");
      fi.click();
      setTimeout(function () { fi.setAttribute("accept", ".md,.markdown,.txt,.text,.pdf,.docx,.png,.jpg,.jpeg,.webp,.bmp"); }, 60000);
    });
    if (fi) fi.addEventListener("change", function () { handleFiles(fi.files); fi.value = ""; });
    bindPaste(bPaste);
  }

  /* 供测试使用：解析文件并直接返回文本（不写入页面） */
  async function capture(files) {
    var out = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var ext = ((f.name || '').split('.').pop() || '').toLowerCase();
      var text = '';
      if (TEXT_EXT.test(ext)) text = await readText(f);
      else if (ext === 'pdf') text = await readPdf(f);
      else if (ext === 'docx') text = await readDocx(f);
      else if (IMG_EXT.test(ext) || (f.type || '').indexOf('image') === 0) text = await readImage(f);
      else throw new Error('unsupported: ' + ext);
      out.push(String(text || '').trim());
    }
    return out.join('\n\n');
  }

  global.InkImport = { bind: bind, handleFiles: handleFiles, capture: capture, setStatus: setStatus, BASE: BASE };
})(typeof window !== "undefined" ? window : this);
