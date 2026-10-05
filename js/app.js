/* InkFlow · 应用层：状态、字体注册、交互、导出 */
(function (global) {
  "use strict";
  var U = global.InkUtil;

  /* ================= 字体注册（全部本地文件，零网络） ================= */
  var FONT_FILES = [
    { family: "Caveat",         url: "fonts/Caveat-Regular.woff2",        weight: "400" },
    { family: "Caveat",         url: "fonts/Caveat-Bold.woff2",           weight: "700" },
    { family: "Rock Salt",      url: "fonts/RockSalt-Regular.woff2",      weight: "400" },
    { family: "Reenie Beanie",  url: "fonts/ReenieBeanie-Regular.woff2",  weight: "400" },
    { family: "Homemade Apple", url: "fonts/HomemadeApple-Regular.woff2", weight: "400" },
    { family: "Patrick Hand",   url: "fonts/PatrickHand-Regular.woff2",   weight: "400" },
    { family: "MaShanZheng",    url: "fonts/MaShanZheng-Regular.ttf",     weight: "400" },
    { family: "LongCang",       url: "fonts/LongCang-Regular.ttf",        weight: "400" }
  ];

  /* 字体目录：由本脚本自身的 URL 推导，因此在任意子目录下都能正确定位 */
  var SELF_SRC = (function () {
    try { return (document.currentScript && document.currentScript.src) || ""; } catch (e) { return ""; }
  })();
  var FONT_BASE = (function () {
    if (!SELF_SRC) return "";
    return SELF_SRC.replace(/js\/app\.js.*$/, "");
  })();
  function setFontBase(p) { FONT_BASE = String(p == null ? "" : p); }

  async function registerFonts() {
    var results = [];
    for (var i = 0; i < FONT_FILES.length; i++) {
      var f = FONT_FILES[i];
      try {
        var face = new FontFace(f.family, "url('" + FONT_BASE + f.url + "')", { weight: f.weight, style: "normal" });
        await face.load();
        document.fonts.add(face);
        results.push({ family: f.family, ok: true });
      } catch (e) {
        results.push({ family: f.family, ok: false, err: String(e && e.message || e) });
      }
    }
    return results;
  }

  /* ================= 状态 ================= */
  var state = {
    source: "",
    pageSize: "a4",
    paper: "ruled",
    fontKey: "mashanzheng",
    fontSize: 28,
    lineHeight: 1.9,
    letterSpacing: 0.3,
    jitter: 1.1,
    rotateDeg: 0.55,
    sizeVary: 0.02,
    baselineDrift: 0.7,
    inkColor: "#1b2a5e",
    inkAmount: 0.93,
    inkVary: 0.09,
    formulaScribble: 0.5,
    formulaScale: 1.0,
    seed: 20240517,
    margin: 88,
    customFontFamily: "",
    showHeader: true,
    headerText: "",
    showDate: false,
    showFooter: true,
    showTotalPages: true
  };

  function toSettings() {
    var m = state.margin;
    return {
      pageSize: state.pageSize, paper: state.paper, fontKey: state.fontKey,
      fontSize: state.fontSize, lineHeight: state.lineHeight, letterSpacing: state.letterSpacing,
      jitter: state.jitter, rotateDeg: state.rotateDeg, sizeVary: state.sizeVary,
      baselineDrift: state.baselineDrift, inkColor: state.inkColor, inkAmount: state.inkAmount,
      inkVary: state.inkVary, formulaScribble: state.formulaScribble, formulaScale: state.formulaScale, seed: state.seed,
      marginTop: m, marginBottom: Math.round(m * 0.9), marginLeft: m, marginRight: Math.round(m * 0.8),
      showHeader: state.showHeader, headerText: state.headerText,
      showDate: state.showDate, dateText: new Date().toLocaleDateString("zh-CN"),
      showFooter: state.showFooter, showTotalPages: state.showTotalPages
    };
  }

  /* ================= DOM ================= */
  var $ = function (id) { return document.getElementById(id); };
  var els = {};
  var pages = [];
  var currentPage = 0;
  var renderToken = 0;
  var lastStats = null;
  var degradedCount = 0;

  function toast(msg, kind, ms) {
    var host = $("toasts");
    if (!host) return;
    var el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.setAttribute("role", "status");
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, ms || 2600);
  }

  /* ================= 渲染 ================= */
  var pending = null;
  function scheduleRender(immediate) {
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () { pending = null; doRender(); }, immediate ? 0 : 260);
  }

  async function doRender() {
    var token = ++renderToken;
    var src = els.source.value;
    state.source = src;
    if (!src.trim()) {
      pages = []; currentPage = 0;
      showEmpty(true);
      updateStats(null);
      return;
    }
    showEmpty(false);
    setBusy(true);
    try {
      var blocks = global.InkParser.parse(src);
      var settings = toSettings();
      var res = await global.InkRender.render(blocks, settings, {});
      if (token !== renderToken) return;   // 已有更新的渲染
      pages = res.canvases;
      lastStats = res.stats;
      degradedCount = countDegraded(res.lines);
      if (currentPage >= pages.length) currentPage = 0;
      paintPage(currentPage);
      updateStats(res.stats);
      if (degradedCount > 0) toast(degradedCount + " 处公式未能渲染，已按原文显示", "warn", 3600);
    } catch (e) {
      console.error(e);
      toast("渲染失败：" + (e && e.message || e), "err", 4200);
    } finally {
      if (token === renderToken) setBusy(false);
    }
  }

  function countDegraded(lines) {
    var n = 0;
    for (var i = 0; i < lines.length; i++) {
      for (var j = 0; j < lines[i].tokens.length; j++) if (lines[i].tokens[j].degraded) n++;
    }
    return n;
  }

  function paintPage(idx) {
    var stage = $("stage");
    if (!pages.length) { showEmpty(true); return; }
    currentPage = U.clamp(idx, 0, pages.length - 1);
    var cv = pages[currentPage];
    var old = document.getElementById("preview");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    cv.id = "preview";
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", "手写效果预览 第 " + (currentPage + 1) + " 页，共 " + pages.length + " 页");
    stage.appendChild(cv);
    var ind = $("pageInd");
    if (ind) ind.textContent = (currentPage + 1) + " / " + pages.length;
    var prev = $("prevPage"), next = $("nextPage");
    if (prev) prev.disabled = currentPage <= 0;
    if (next) next.disabled = currentPage >= pages.length - 1;
  }

  function showEmpty(on) {
    var stage = $("stage"), empty = $("empty");
    if (!stage || !empty) return;
    empty.style.display = on ? "" : "none";
    stage.style.display = on ? "none" : "";
  }

  function setBusy(on) {
    var b = $("busy");
    if (b) b.style.display = on ? "" : "none";
  }

  function updateStats(st) {
    var box = $("stats");
    if (!box) return;
    if (!st) { box.innerHTML = '<div class="stat"><b>—</b><span>等待输入</span></div>'; return; }
    box.innerHTML = [
      '<div class="stat"><b>' + st.totalMs + ' ms</b><span>渲染耗时</span></div>',
      '<div class="stat"><b>' + st.pages + '</b><span>页数</span></div>',
      '<div class="stat"><b>' + st.lineCount + '</b><span>行数</span></div>',
      '<div class="stat"><b>' + st.mathCount + '</b><span>公式数</span></div>'
    ].join("");
  }

  /* ================= 控件绑定 ================= */
  function bindRange(id, key, fmt) {
    var input = $(id);
    if (!input) return;
    var out = $(id + "Out");
    function sync() {
      var v = parseFloat(input.value);
      state[key] = v;
      if (out) out.textContent = fmt ? fmt(v) : String(v);
    }
    input.addEventListener("input", function () { sync(); scheduleRender(); });
    sync();
  }

  function bindSelect(id, key) {
    var el = $(id);
    if (!el) return;
    el.value = state[key];
    el.addEventListener("change", function () { state[key] = el.value; scheduleRender(true); });
  }

  function bindCheck(id, key) {
    var el = $(id);
    if (!el) return;
    el.checked = !!state[key];
    el.addEventListener("change", function () { state[key] = el.checked; scheduleRender(); });
  }

  function bindText(id, key) {
    var el = $(id);
    if (!el) return;
    el.value = state[key] || "";
    el.addEventListener("input", function () { state[key] = el.value; scheduleRender(); });
  }

  function initControls() {
    els.source = $("source");

    bindSelect("pageSize", "pageSize");
    bindSelect("paper", "paper");
    bindSelect("fontKey", "fontKey");

    bindRange("fontSize", "fontSize", function (v) { return v + " px"; });
    bindRange("lineHeight", "lineHeight", function (v) { return v.toFixed(2) + "×"; });
    bindRange("letterSpacing", "letterSpacing", function (v) { return v.toFixed(1) + " px"; });
    bindRange("jitter", "jitter", function (v) { return v.toFixed(1) + " px"; });
    bindRange("rotateDeg", "rotateDeg", function (v) { return v.toFixed(2) + "°"; });
    bindRange("sizeVary", "sizeVary", function (v) { return (v * 100).toFixed(1) + "%"; });
    bindRange("baselineDrift", "baselineDrift", function (v) { return v.toFixed(1) + " px"; });
    bindRange("formulaScribble", "formulaScribble", function (v) { return Math.round(v * 100) + "%"; });
    bindRange("formulaScale", "formulaScale", function (v) { return v.toFixed(2) + "×"; });
    bindRange("inkAmount", "inkAmount", function (v) { return Math.round(v * 100) + "%"; });
    bindRange("inkVary", "inkVary", function (v) { return Math.round(v * 100) + "%"; });
    bindRange("margin", "margin", function (v) { return v + " px"; });

    var ink = $("inkColor");
    if (ink) { ink.value = state.inkColor; ink.addEventListener("input", function () { state.inkColor = ink.value; scheduleRender(); }); }

    bindText("headerText", "headerText");
    bindCheck("showHeader", "showHeader");
    bindCheck("showDate", "showDate");
    bindCheck("showFooter", "showFooter");
    bindCheck("showTotalPages", "showTotalPages");

    var seed = $("seed");
    if (seed) { seed.value = String(state.seed); seed.addEventListener("change", function () { var n = parseInt(seed.value, 10); state.seed = isFinite(n) ? n : 0; scheduleRender(true); }); }

    var re = $("reseed");
    if (re) re.addEventListener("click", function () { state.seed = Math.floor(Math.random() * 1e9); if (seed) seed.value = String(state.seed); scheduleRender(true); toast("已生成新随机种子", "ok", 1600); });

    els.source.addEventListener("input", function () { updateCounts(); scheduleRender(); });

    var prev = $("prevPage"), next = $("nextPage");
    if (prev) prev.addEventListener("click", function () { paintPage(currentPage - 1); });
    if (next) next.addEventListener("click", function () { paintPage(currentPage + 1); });

    var expPng = $("exportPng");
    if (expPng) expPng.addEventListener("click", async function () {
      if (!pages.length) return toast("没有可导出的内容", "warn");
      try { await global.InkExport.exportPNG(pages[currentPage], "inkflow-page" + (currentPage + 1) + ".png", 2); toast("PNG 已导出（第 " + (currentPage + 1) + " 页）", "ok"); }
      catch (e) { toast("导出失败：" + e.message, "err"); }
    });

    var expPdf = $("exportPdf");
    if (expPdf) expPdf.addEventListener("click", async function () {
      if (!pages.length) return toast("没有可导出的内容", "warn");
      try { setBusy(true); await global.InkExport.exportPDF(pages, "inkflow.pdf", { dpi: 150, quality: 0.92 }); toast("PDF 已导出（" + pages.length + " 页）", "ok"); }
      catch (e) { toast("导出失败：" + e.message, "err"); }
      finally { setBusy(false); }
    });

    var clr = $("clearAll");
    if (clr) clr.addEventListener("click", function () { els.source.value = ""; state.source = ""; updateCounts(); scheduleRender(true); toast("已清空", "ok", 1400); });

    var demo = $("loadDemo");
    if (demo) demo.addEventListener("click", function () { els.source.value = global.InkSamples.equation; updateCounts(); scheduleRender(true); });

    var demo2 = $("loadDemo2");
    if (demo2) demo2.addEventListener("click", function () { els.source.value = global.InkSamples.calculus; updateCounts(); scheduleRender(true); });

    /* 自定义字体：仅本地读取文件，不发起任何网络请求 */
    var cf = $("customFont");
    if (cf) cf.addEventListener("change", async function () {
      var f = cf.files && cf.files[0];
      if (!f) return;
      try {
        var buf = await f.arrayBuffer();
        var family = "UserFont_" + f.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 24);
        var face = new FontFace(family, buf);
        await face.load();
        document.fonts.add(face);
        global.InkRender.addCustomFont("userfont", family, "自定义：" + f.name.slice(0, 18));
        state.fontKey = "userfont";
        var sel = $("fontKey");
        if (sel) {
          var opt = document.createElement("option");
          opt.value = "userfont";
          opt.textContent = "自定义：" + f.name.slice(0, 18);
          sel.appendChild(opt);
          sel.value = "userfont";
        }
        var hint = $("customFontHint");
        if (hint) hint.textContent = "已载入：" + f.name + "（仅本地读取）";
        toast("自定义字体已启用：" + f.name, "ok", 2600);
        scheduleRender(true);
      } catch (e) {
        toast("字体载入失败：" + (e && e.message || e), "err", 3600);
      }
    });

    var help = $("showHelp");
    if (help) help.addEventListener("click", function () { var d = $("helpDlg"); if (d && d.showModal) d.showModal(); });
    var hclose = $("helpClose");
    if (hclose) hclose.addEventListener("click", function () { var d = $("helpDlg"); if (d) d.close(); });

    // 拖拽导入（本地读取，不上传）
    var drop = $("dropzone");
    if (drop) {
      ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
      ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
      drop.addEventListener("drop", function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () { els.source.value = String(r.result); updateCounts(); scheduleRender(true); toast("已载入 " + f.name + "（仅本地读取）", "ok"); };
        r.readAsText(f);
      });
    }

    window.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "Enter") { e.preventDefault(); scheduleRender(true); }
      if (e.key.toLowerCase() === "s") { e.preventDefault(); var b = $("exportPdf"); if (b) b.click(); }
    });
  }

  function updateCounts() {
    var el = $("counts");
    if (!el) return;
    var s = els.source.value;
    var chars = s.length;
    var lines = s ? s.split("\n").length : 0;
    el.textContent = chars + " 字符 · " + lines + " 行";
  }

  /* ================= 启动 ================= */
  async function boot() {
    initControls();
    updateCounts();

    var fontResults = await registerFonts();
    var okCount = fontResults.filter(function (r) { return r.ok; }).length;
    var fb = $("fontBadge");
    if (fb) fb.textContent = "字体 " + okCount + "/" + fontResults.length;

    try { await document.fonts.ready; } catch (e) {}

    // MathJax 就绪检测
    var mjOk = await waitForMathJax(6000);
    var mb = $("mathBadge");
    if (mb) {
      mb.textContent = mjOk ? "公式引擎就绪" : "公式引擎不可用";
      mb.className = "badge " + (mjOk ? "ok" : "warn");
    }

    // 载入示例
    els.source.value = global.InkSamples.equation;
    updateCounts();
    scheduleRender(true);
  }

  function waitForMathJax(timeoutMs) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      var settled = false;
      function finish(v) { if (!settled) { settled = true; resolve(v); } }
      function check() {
        if (global.InkMath.isAvailable()) { global.InkMath.markReady(); return finish(true); }
        if (Date.now() - t0 > timeoutMs) return finish(false);
        setTimeout(check, 100);
      }
      var p = null;
      try { p = global.MathJax && global.MathJax.startup && global.MathJax.startup.promise; } catch (e) {}
      if (p && typeof p.then === "function") p.then(check, check);
      else check();
    });
  }

  global.InkApp = { state: state, toSettings: toSettings, doRender: doRender, registerFonts: registerFonts, setFontBase: setFontBase, boot: boot };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : this);
