/* InkFlow · 导入器：TXT/MD · PDF · Word(.docx) · 图片(OCR)
 *
 * 全部在浏览器本地完成：
 *  - PDF  ：pdf.js（本地 vendor）；按每行原始字号打「字号标记」以还原标题/脚注层级
 *  - Word ：自解 ZIP（DecompressionStream）读 w:sz 取字号 → 带标记 Markdown；失败回退 mammoth
 *  - 图片 ：tesseract.js（本地 vendor + 本地语言包）→ 文本
 *  - 文本 ：FileReader
 * 全程不发起任何网络请求（worker / wasm / 语言包均来自同源本地文件）。
 * 字号标记形如 \u0001F167\u0001（=正文的 167%），由 js/parser.js 剥离并挂到块上。
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

  /* ---------- 极简 ZIP 读取（用于 .docx，纯本地解压，不联网） ---------- */
  async function inflateRaw(bytes) {
    var ds = new DecompressionStream("deflate-raw");
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function unzipTexts(buf) {
    var bytes = new Uint8Array(buf);
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var n = bytes.length, eocd = -1;
    for (var i = n - 22; i >= Math.max(0, n - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("不是有效的 ZIP");
    var cdCount = dv.getUint16(eocd + 10, true);
    var cdOff = dv.getUint32(eocd + 16, true);
    var out = {}, p = cdOff;
    for (var e = 0; e < cdCount; e++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var compSize = dv.getUint32(p + 20, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commLen = dv.getUint16(p + 32, true);
      var localOff = dv.getUint32(p + 42, true);
      var name = new TextDecoder("utf-8").decode(bytes.subarray(p + 46, p + 46 + nameLen));
      var lnl = dv.getUint16(localOff + 26, true), lel = dv.getUint16(localOff + 28, true);
      var dataStart = localOff + 30 + lnl + lel;
      var comp = bytes.subarray(dataStart, dataStart + compSize);
      var data = method === 0 ? comp : await inflateRaw(comp);
      out[name] = new TextDecoder("utf-8").decode(data);
      p += 46 + nameLen + extraLen + commLen;
    }
    return out;
  }

  /* 分页标记：多页 PDF/Word 每页首个块前写入 \u0001PG<页码>\u0001，parser 剥离后挂到块上，
     右侧转写据此「按原文档页码排序布局」 */
  function pgMark(n) {
    return (global.InkParser && global.InkParser.pgMark) ? global.InkParser.pgMark(n) : ("\u0001PG" + n + "\u0001");
  }

  /* 字号标记：把「相对文档正文字号的百分比」写进块首（parser 会剥离并挂到块上） */
  function mark(pct) {
    var v = Math.round(pct);
    if (!isFinite(v) || v <= 0) v = 100;
    return (global.InkParser && global.InkParser.szMark) ? global.InkParser.szMark(v) : "";
  }
  /* 一组字号 → 正文字号（众数，四舍五入到整数磅） */
  function bodySizeOf(sizes) {
    var m = {}, best = 12, bn = 0;
    for (var i = 0; i < sizes.length; i++) {
      var k = Math.round(sizes[i]);
      if (k > 0) m[k] = (m[k] || 0) + 1;
    }
    for (var key in m) if (m[key] > bn) { bn = m[key]; best = parseInt(key, 10); }
    return best || 12;
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
  function configurePdf() {
    if (pdfReady) return;
    try { global.pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + "vendor/pdf.worker.min.js"; } catch (e) {}
    pdfReady = true;
  }
  async function ensurePdf() {
    if (global.pdfjsLib) { configurePdf(); return true; }
    if (global.InkLoader) { await global.InkLoader.ensurePdf(); configurePdf(); return true; }
    return false;
  }
  async function readPdf(file) {
    if (!(await ensurePdf())) throw new Error("PDF 组件未就绪");
    var buf = await file.arrayBuffer();
    var doc = await global.pdfjsLib.getDocument({ data: buf, disableFontFace: false }).promise;
    var pageLines = [];       /* [{text,h}] 每页 */
    var allH = [];            /* 全文字号样本 */
    for (var p = 1; p <= doc.numPages; p++) {
      setStatus("正在解析 PDF：第 " + p + " / " + doc.numPages + " 页…", "busy", true);
      var page = await doc.getPage(p);
      var tc = await page.getTextContent();
      /* 按 y 坐标聚合成行，尽量还原段落；同时记录该行字号 */
      var items = tc.items.map(function (it) {
        return { s: it.str, x: it.transform[4], y: it.transform[5], h: Math.abs(it.transform[3]) || 10 };
      }).filter(function (it) { return it.s && it.s.trim(); });
      items.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
      var lines = [], cur = null;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!cur || Math.abs(cur.y - it.y) > Math.max(2, it.h * 0.6)) { cur = { y: it.y, h: it.h, parts: [it] }; lines.push(cur); }
        else { cur.parts.push(it); if (it.h > cur.h) cur.h = it.h; }
      }
      var built = lines.map(function (ln) {
        ln.parts.sort(function (a, b) { return a.x - b.x; });
        var s = "";
        for (var j = 0; j < ln.parts.length; j++) {
          var t = ln.parts[j].s;
          if (s && !/\s$/.test(s) && !/^\s/.test(t)) s += " ";
          s += t;
        }
        return { text: s.replace(/\s+$/, ""), h: ln.h };
      });
      pageLines.push(built);
      for (var b = 0; b < built.length; b++) if (built[b].text) allH.push(built[b].h);
    }
    /* 正文字号 = 出现最多的字号；每行按相对大小打标记，实现「按原文字号转写」 */
    var body = bodySizeOf(allH);
    var pageTexts = [];
    for (var q = 0; q < pageLines.length; q++) {
      pageTexts.push(pageLines[q].map(function (ln) {
        if (!ln.text) return "";
        return mark(ln.h / body * 100) + ln.text;
      }).join("\n"));
    }
    /* 多页 PDF：每页首个块前写入分页标记 → 右侧转写按原页码排序布局；
       单页文档不加标记，仍走连续分页（与旧版一致）。 */
    var contentN = pageTexts.filter(function (t) { return t.trim(); }).length;
    var multi = contentN > 1;
    var out = [];
    for (var q2 = 0; q2 < pageTexts.length; q2++) {
      var pt = pageTexts[q2];
      out.push((multi && pt.trim()) ? (pgMark(q2 + 1) + pt) : pt);
    }
    return out.join("\n\n");
  }

  /* ---------- Word(.docx) ---------- */
  function xmlUnescape(s) {
    return String(s)
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); })
      .replace(/&amp;/g, "&");
  }
  /* 直接从 document.xml 抽取段落 + 字号（半磅）→ 带字号标记的 Markdown */
  function docxToSizedText(docXml, map) {
    var styleSize = {}, defHalf = null, stylesXml = null;
    for (var k in map) if (/word\/styles\.xml$/i.test(k)) { stylesXml = map[k]; break; }
    if (stylesXml) {
      var dd = stylesXml.match(/<w:docDefaults[\s\S]*?<\/w:docDefaults>/i);
      if (dd) { var m0 = dd[0].match(/<w:sz\b[^>]*w:val="(\d+)"/i); if (m0) defHalf = parseInt(m0[1], 10); }
      var sre = /<w:style\b[^>]*w:styleId="([^"]+)"[\s\S]*?<\/w:style>/gi, sm;
      while ((sm = sre.exec(stylesXml))) {
        var sz = sm[0].match(/<w:sz\b[^>]*w:val="(\d+)"/i);
        if (sz) styleSize[sm[1]] = parseInt(sz[1], 10);
      }
    }
    var paras = [];
    var pre = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi, pm;
    while ((pm = pre.exec(docXml))) {
      var inner = pm[1];
      var pPrM = inner.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/i);
      var pPr = pPrM ? pPrM[1] : "";
      var half = null;
      var szm = pPr.match(/<w:sz\b[^>]*w:val="(\d+)"/i);
      if (szm) half = parseInt(szm[1], 10);
      if (half == null) {
        var ps = pPr.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/i);
        if (ps && styleSize[ps[1]] != null) half = styleSize[ps[1]];
      }
      if (half == null) half = defHalf;
      var txt = "";
      var tre = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi, tm;
      while ((tm = tre.exec(inner))) txt += xmlUnescape(tm[1]);
      /* 分页：显式分页符（<w:br w:type="page"/>）、渲染期分页、或段前分页 */
      var pageBreak = /<w:br\b[^>]*\bw:type="page"/i.test(inner) || /<w:lastRenderedPageBreak\b/i.test(inner) || /<w:pageBreakBefore\b/i.test(pPr);
      paras.push({ text: txt, half: half, list: /<w:numPr\b/i.test(pPr), pageBreak: pageBreak });
    }
    var sizes = [];
    for (var i = 0; i < paras.length; i++) if (paras[i].text.trim()) sizes.push(paras[i].half ? paras[i].half / 2 : (defHalf ? defHalf / 2 : 12));
    var body = bodySizeOf(sizes);
    /* 是否含分页（多页 Word）；无分页则不加标记，保持与旧版一致 */
    var multi = false;
    for (var q = 0; q < paras.length; q++) if (paras[q].pageBreak) { multi = true; break; }
    var parts = [];
    var page = 1, pageFirst = true;
    for (var j = 0; j < paras.length; j++) {
      var p = paras[j];
      /* 遇到分页 → 进入新一页；下一页的首个非空段落带上分页标记 */
      if (p.pageBreak) { if (parts.length) page++; pageFirst = true; }
      var t = p.text.replace(/\s+/g, " ").trim();
      if (!t) continue;
      var pt = p.half ? p.half / 2 : body;
      var prefix = (multi && pageFirst) ? pgMark(page) : "";
      pageFirst = false;
      parts.push(prefix + mark(body ? pt / body * 100 : 100) + (p.list ? "- " : "") + t);
    }
    return parts.join("\n\n");
  }
  async function readDocx(file) {
    var buf = await file.arrayBuffer();
    var map = null;
    try { map = await unzipTexts(buf); } catch (e) { map = null; }
    if (map) {
      var docXml = null;
      for (var k in map) if (/word\/document\.xml$/i.test(k)) { docXml = map[k]; break; }
      if (docXml) {
        try {
          var sized = docxToSizedText(docXml, map);
          if (sized && sized.replace(/[\u0001]/g, "").trim()) return sized;
        } catch (e) {}
      }
    }
    /* 兜底：mammoth（无法取到字号 → 统一字号，结构仍保留） */
    if (!global.mammoth && global.InkLoader) await global.InkLoader.ensureDocx();
    if (!global.mammoth) throw new Error("Word 组件未就绪");
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
    /* 按需加载 OCR 组件（首屏不加载） */
    var ready = global.Tesseract ? Promise.resolve()
      : (global.InkLoader ? global.InkLoader.ensureOcr() : Promise.reject(new Error("OCR 组件未就绪")));
    return ready.then(function () {
      if (!global.Tesseract) throw new Error("OCR 组件未就绪");
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
    });
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
    var added = 0;                                  // 入队（批量）计数
    var multi = files.length > 1;                   // 多选即批量，无需手动切换模式
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
        if (ctx.onItem) {
          /* 统一出口：多选 → 逐个入队（批量）；单选 → 直接渲染（单篇） */
          ctx.onItem(name, ext || "text", text, { multi: multi });
          if (multi) added++;
          setStatus(multi ? ("已加入队列：" + name) : ("已导入 " + name), "ok");
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
      ctx.toast("已导入 " + acc.length + " 个文件（仅本地处理）", "ok", 3000);
    }
    if (added) ctx.toast("已加入队列 " + added + " 个文件（仅本地处理）", "ok", 3000);
    ctx.onDone && ctx.onDone({ added: added, multi: multi });
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
