/* InkFlow · 应用层：状态、字体注册、交互、导出 */
(function (global) {
  "use strict";
  var U = global.InkUtil;

  /* ================= 字体注册（全部本地文件，零网络） ================= */
  var FONT_FILES = [
    /* 中文手写（含日文手写体；按数学符号覆盖率排序） */
    { family: "Zen Kurenaido",      url: "fonts/ZenKurenaido-Regular.ttf",        weight: "400" },
    { family: "MPLUSRounded1c",     url: "fonts/MPLUSRounded1c-Regular.ttf",      weight: "400" },
    { family: "PottaOne",           url: "fonts/PottaOne-Regular.ttf",            weight: "400" },
    { family: "ZenMaruGothic",      url: "fonts/ZenMaruGothic-Regular.ttf",       weight: "400" },
    { family: "Yomogi",             url: "fonts/Yomogi-Regular.ttf",              weight: "400" },
    { family: "MaShanZheng",        url: "fonts/MaShanZheng-Regular.ttf",         weight: "400" },
    { family: "Klee One",           url: "fonts/KleeOne-Regular.ttf",             weight: "400" },
    { family: "LongCang",           url: "fonts/LongCang-Regular.ttf",            weight: "400" },
    { family: "ZhiMangXing",        url: "fonts/ZhiMangXing-Regular.ttf",         weight: "400" },
    { family: "LiuJianMaoCao",      url: "fonts/LiuJianMaoCao-Regular.ttf",       weight: "400" },
    /* 英文手写 */
    { family: "Caveat",             url: "fonts/Caveat-Regular.woff2",            weight: "400" },
    { family: "Caveat",             url: "fonts/Caveat-Bold.woff2",               weight: "700" },
    { family: "Patrick Hand",       url: "fonts/PatrickHand-Regular.woff2",       weight: "400" },
    { family: "Indie Flower",       url: "fonts/IndieFlower-Regular.woff2",       weight: "400" },
    { family: "Kalam",              url: "fonts/Kalam-Regular.woff2",             weight: "400" },
    { family: "Shadows Into Light", url: "fonts/ShadowsIntoLight-Regular.woff2",  weight: "400" },
    { family: "Architects Daughter",url: "fonts/ArchitectsDaughter-Regular.woff2",weight: "400" },
    { family: "Gloria Hallelujah",  url: "fonts/GloriaHallelujah-Regular.woff2",  weight: "400" },
    { family: "Reenie Beanie",      url: "fonts/ReenieBeanie-Regular.woff2",      weight: "400" },
    { family: "Rock Salt",          url: "fonts/RockSalt-Regular.woff2",          weight: "400" }
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
    fontKey: "zenkurenaido",
    fontKeyCJK: "zenkurenaido",
    fontKeyLat: "caveat",
    fontSize: 28,
    lineHeight: 1.9,
    letterSpacing: 0.3,
    hand: "normal",          // 工整 / 自然 / 随性
    handCustom: false,       // 高级设置里是否手动改过抖动
    bold: false, italic: false, underline: false,
    textColor: "#1b2a5e", textScale: 1,
    autoRender: true,        // 关闭后需手动点「生成手写稿」
    jitter: 1.1,
    rotateDeg: 0.55,
    sizeVary: 0.02,
    baselineDrift: 0.7,
    inkColor: "#1b2a5e",
    inkAmount: 0.93,
    inkVary: 0.09,
    formulaHand: 0.5,
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
      fontKeyCJK: state.fontKeyCJK, fontKeyLat: state.fontKeyLat,
      fontSize: state.fontSize, lineHeight: state.lineHeight, letterSpacing: state.letterSpacing,
      jitter: state.jitter, rotateDeg: state.rotateDeg, sizeVary: state.sizeVary,
      baselineDrift: state.baselineDrift, inkColor: state.inkColor, inkAmount: state.inkAmount,
      inkVary: state.inkVary, formulaHand: state.formulaHand, formulaScale: state.formulaScale, seed: state.seed,
      hand: state.hand, handCustom: state.handCustom,
      bold: state.bold, italic: state.italic, underline: state.underline,
      textColor: state.textColor, textScale: state.textScale,
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
  var dirty = false;

  /* 把「需要重绘」标记为待处理；是否立刻执行取决于自动重绘开关 */
  function markDirty() {
    dirty = true;
    var btn = $("regenerate");
    if (btn) btn.classList.add("is-dirty");
  }
  function clearDirty() {
    dirty = false;
    var btn = $("regenerate");
    if (btn) btn.classList.remove("is-dirty");
  }

  function scheduleRender(immediate) {
    if (pending) clearTimeout(pending);
    if (!state.autoRender) { markDirty(); return; }
    pending = setTimeout(function () { pending = null; doRender(); }, immediate ? 0 : 260);
  }

  /* 手动生成：跳过防抖立即渲染 */
  function regenerate() {
    if (pending) { clearTimeout(pending); pending = null; }
    return doRender();
  }

  async function doRender() {
    var token = ++renderToken;
    var src = els.source ? els.source.value : "";
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
      if (token === renderToken) { setBusy(false); clearDirty(); }
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
  function bindRange(id, key, fmt, onChange) {
    var input = $(id);
    if (!input) return;
    var out = $(id + "Out");
    function sync() {
      var v = parseFloat(input.value);
      state[key] = v;
      if (out) out.textContent = fmt ? fmt(v) : String(v);
    }
    input.addEventListener("input", function () { sync(); if (onChange) onChange(); scheduleRender(); });
    sync();
  }

  /* 字号：WPS 式数字输入框（替代滑杆） */
  function bindFontSize(id, key) {
    var input = $(id);
    if (!input) return;
    input.value = state[key];
    function sync() {
      var v = parseFloat(input.value);
      if (!isFinite(v)) return;
      state[key] = v;
    }
    input.addEventListener("input", function () { sync(); scheduleRender(); });
    input.addEventListener("change", function () {
      var v = parseFloat(input.value);
      if (!isFinite(v)) v = state[key];
      v = Math.max(12, Math.min(96, Math.round(v)));
      input.value = v; state[key] = v; scheduleRender(true);
    });
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

    /* ---------- 中英字体：分别选择 ---------- */
    function fillFontSelect(selId, lang, current) {
      var sel = $(selId);
      if (!sel) return;
      var list = global.InkRender.fontsByLang(lang);
      sel.innerHTML = "";
      for (var i = 0; i < list.length; i++) {
        var o = document.createElement("option");
        o.value = list[i].key; o.textContent = list[i].label;
        sel.appendChild(o);
      }
      if (current) {
        var has = false;
        for (var k = 0; k < sel.options.length; k++) if (sel.options[k].value === current) has = true;
        if (has) sel.value = current;
      }
      return sel;
    }
    state.fontKeyCJK = state.fontKeyCJK || "zenkurenaido";
    state.fontKeyLat = state.fontKeyLat || "caveat";
    fillFontSelect("fontCJK", "cjk", state.fontKeyCJK);
    fillFontSelect("fontLat", "lat", state.fontKeyLat);
    var selCJK = $("fontCJK"), selLat = $("fontLat");
    if (selCJK) selCJK.addEventListener("change", function () {
      state.fontKeyCJK = selCJK.value; state.fontKey = selCJK.value; scheduleRender(true);
    });
    if (selLat) selLat.addEventListener("change", function () {
      state.fontKeyLat = selLat.value; scheduleRender(true);
    });

    /* ---------- 手写程度：三档 ---------- */
    function applyHand(level) {
      state.hand = level;
      state.handCustom = false;
      var hp = global.InkRender.handOf(level);
      state.jitter = hp.jitter; state.rotateDeg = hp.rotateDeg;
      state.sizeVary = hp.sizeVary; state.baselineDrift = hp.baselineDrift;
      state.formulaHand = hp.formulaHand;
      syncRange("jitter"); syncRange("rotateDeg"); syncRange("sizeVary");
      syncRange("baselineDrift"); syncRange("formulaHand");
      var bs = document.querySelectorAll('[data-hand]');
      for (var i = 0; i < bs.length; i++) bs[i].setAttribute("aria-pressed", bs[i].getAttribute("data-hand") === level ? "true" : "false");
      scheduleRender(true);
    }
    var handBtns = document.querySelectorAll('[data-hand]');
    for (var hb = 0; hb < handBtns.length; hb++) {
      (function (b) { b.addEventListener("click", function () { applyHand(b.getAttribute("data-hand")); }); })(handBtns[hb]);
    }

    /* ---------- 常规控件 ---------- */
    bindSelect("pageSize", "pageSize");
    bindSelect("paper", "paper");
    bindFontSize("fontSize", "fontSize");
    bindRange("lineHeight", "lineHeight", function (v) { return v.toFixed(2) + "×"; });
    bindRange("letterSpacing", "letterSpacing", function (v) { return v.toFixed(1) + " px"; });
    bindRange("formulaScale", "formulaScale", function (v) { return v.toFixed(2) + "×"; });
    bindRange("inkAmount", "inkAmount", function (v) { return Math.round(v * 100) + "%"; });
    bindRange("margin", "margin", function (v) { return v + " px"; });

    /* ---------- 高级：抖动微调（手动改过即脱离档位） ---------- */
    function markCustom() { state.handCustom = true; }
    bindRange("jitter", "jitter", function (v) { return v.toFixed(1) + " px"; }, markCustom);
    bindRange("rotateDeg", "rotateDeg", function (v) { return v.toFixed(2) + "°"; }, markCustom);
    bindRange("sizeVary", "sizeVary", function (v) { return (v * 100).toFixed(1) + "%"; }, markCustom);
    bindRange("baselineDrift", "baselineDrift", function (v) { return v.toFixed(1) + " px"; }, markCustom);
    bindRange("formulaHand", "formulaHand", function (v) { return Math.round(v * 100) + "%"; }, markCustom);

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

    if (els.source) els.source.addEventListener("input", function () { updateCounts(); scheduleRender(); });

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

    /* ---------- 自定义字体：仅本地读取 ---------- */
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
        state.fontKeyCJK = "userfont"; state.fontKey = "userfont";
        var sel2 = $("fontCJK");
        if (sel2) {
          var opt = document.createElement("option");
          opt.value = "userfont";
          opt.textContent = "自定义：" + f.name.slice(0, 18);
          sel2.appendChild(opt);
          sel2.value = "userfont";
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

    /* ---------- 导入：文件 / 图片 / 粘贴识别 ---------- */
    function afterImport() {
      updateCounts();
      if (mode === "queue") { setView("edit"); renderQueueList(); }   // 批量：停在队列
      else { setView("edit"); scheduleRender(true); }                 // 单篇：导入后自动进入「编辑」页
    }
    if (global.InkImport) global.InkImport.bind({
      getSource: function () { return els.source || $("source"); },
      toast: toast,
      queueMode: function () { return mode === "queue"; },
      onItem: function (name, kind, text) { global.InkQueue.add(name, kind, text); },
      onDone: afterImport
    });

    /* ---------- 拖拽导入 ---------- */
    var drop = $("dropzone");
    if (drop) {
      ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
      ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
      drop.addEventListener("drop", function (e) {
        var files = e.dataTransfer && e.dataTransfer.files;
        if (!files || !files.length) return;
        if (global.InkImport) global.InkImport.handleFiles(files, { toast: toast, onDone: afterImport });
      });
    }

    /* ---------- 文字样式（加粗 / 斜体 / 下划线 / 字色 / 缩放） ---------- */
    function bindFmt(id, key) {
      var el = $(id);
      if (!el) return;
      el.setAttribute("aria-pressed", state[key] ? "true" : "false");
      el.addEventListener("click", function () {
        state[key] = !state[key];
        el.setAttribute("aria-pressed", state[key] ? "true" : "false");
        scheduleRender(true);
      });
    }
    bindFmt("fmtBold", "bold");
    bindFmt("fmtItalic", "italic");
    bindFmt("fmtUnder", "underline");

    var tcol = $("textColor");
    if (tcol) { tcol.value = state.textColor; tcol.addEventListener("input", function () { state.textColor = tcol.value; scheduleRender(); }); }
    bindRange("textScale", "textScale", function (v) { return v.toFixed(2) + "×"; });

    /* ---------- 左栏页签：导入（默认） / 编辑 ---------- */
    var view = "import";
    var mode = "single";
    /* 面板可见性统一由 syncPanels 决定：
       导入页 = 导入面板；编辑页单篇 = 编辑器；编辑页批量 = 队列 */
    function syncPanels() {
      var ti = $("tabImport"), te = $("tabEdit");
      var importTab = (view === "import");
      if (ti) ti.setAttribute("aria-selected", importTab ? "true" : "false");
      if (te) te.setAttribute("aria-selected", !importTab ? "true" : "false");
      var iv = $("importView"), ew = $("editorWrap"), qp = $("queuePanel");
      if (iv) iv.hidden = !importTab;
      if (ew) ew.hidden = !(view === "edit" && mode === "single");
      if (qp) qp.hidden = !(view === "edit" && mode === "queue");
    }
    function setView(v) {
      view = (v === "edit") ? "edit" : "import";
      syncPanels();
      if (view === "edit" && els.source) els.source.focus();
    }
    if ($("tabImport")) $("tabImport").addEventListener("click", function () { setView("import"); });
    if ($("tabEdit")) $("tabEdit").addEventListener("click", function () { setView("edit"); });

    /* ---------- 单篇 / 批量 模式切换（批量是「编辑」页的子模式） ---------- */
    function setMode(m) {
      mode = (m === "queue") ? "queue" : "single";
      var ms = $("modeSingle"), mq = $("modeQueue");
      if (ms) ms.setAttribute("aria-pressed", mode === "single" ? "true" : "false");
      if (mq) mq.setAttribute("aria-pressed", mode === "queue" ? "true" : "false");
      if (mode === "queue") view = "edit";   // 批量属于「编辑」页
      syncPanels();
      renderQueueList();
      if (mode === "queue") { var cur = global.InkQueue.current(); if (cur) showQueueItem(cur.id); }
      else scheduleRender(true);
    }
    function showQueueItem(id) {
      var it = global.InkQueue.select(id);
      if (!it) return;
      if (it.status === "done" && it.pages) { pages = it.pages; currentPage = 0; paintPage(0); }
      else { pages = []; paintPage(0); }
      renderQueueList();
    }
    function renderQueueList() {
      var ul = $("queueList"); if (!ul) return;
      var list = global.InkQueue.items();
      var empty = $("queueEmpty");
      if (empty) empty.hidden = list.length > 0;
      ul.innerHTML = "";
      var cur = global.InkQueue.current();
      list.forEach(function (it) {
        var li = document.createElement("li");
        if (cur && cur.id === it.id) li.className = "active";
        li.setAttribute("data-id", it.id);

        var cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = !!it.checked;
        cb.addEventListener("click", function (e) { e.stopPropagation(); it.checked = cb.checked; syncQueueAll(); });
        li.appendChild(cb);

        var nm = document.createElement("span");
        nm.className = "q-name"; nm.textContent = it.name;
        nm.title = it.name + (it.error ? (" — " + it.error) : "");
        li.appendChild(nm);

        var kd = document.createElement("span");
        kd.className = "q-kind"; kd.textContent = it.kind;
        li.appendChild(kd);

        var st = document.createElement("span");
        st.className = "q-status " + it.status;
        st.textContent = it.status === "done" ? ("✓ 已完成 " + (it.pages ? it.pages.length : 0) + " 页")
          : it.status === "rendering" ? "⟳ 转写中"
          : it.status === "error" ? ("✕ " + (it.error || "失败").slice(0, 14))
          : "○ 待转写";
        li.appendChild(st);

        var del = document.createElement("button");
        del.type = "button"; del.className = "q-del"; del.textContent = "✕";
        del.title = "移除";
        del.addEventListener("click", function (e) { e.stopPropagation(); global.InkQueue.remove(it.id); renderQueueList(); });
        li.appendChild(del);

        li.addEventListener("click", function () { showQueueItem(it.id); });
        ul.appendChild(li);
      });
      syncQueueAll();
    }
    function syncQueueAll() {
      var all = $("queueAll"); if (!all) return;
      var list = global.InkQueue.items();
      var ck = list.filter(function (x) { return x.checked; }).length;
      all.checked = list.length > 0 && ck === list.length;
      all.indeterminate = ck > 0 && ck < list.length;
    }
    if ($("modeSingle")) $("modeSingle").addEventListener("click", function () { setMode("single"); });
    if ($("modeQueue")) $("modeQueue").addEventListener("click", function () { setMode("queue"); });

    /* 队列按钮 */
    if ($("queueRun")) $("queueRun").addEventListener("click", function () {
      if (!global.InkQueue.items().length) return toast("队列为空，先导入文件", "warn");
      global.InkQueue.runAll(toSettings);
    });
    if ($("queueStop")) $("queueStop").addEventListener("click", function () { global.InkQueue.stop(); toast("已请求停止", "warn", 1800); });
    if ($("queueAll")) $("queueAll").addEventListener("change", function () {
      var v = $("queueAll").checked;
      global.InkQueue.items().forEach(function (x) { x.checked = v; });
      renderQueueList();
    });
    if ($("queueClear")) $("queueClear").addEventListener("click", function () { global.InkQueue.clearAll(); renderQueueList(); });
    if ($("queueExport")) $("queueExport").addEventListener("click", async function () {
      var sel = global.InkQueue.checked();
      if (!sel.length) return toast("没有可导出的已完成文档", "warn");
      var all = global.InkQueue.allPagesOf(sel);
      try {
        setBusy(true);
        await global.InkExport.exportPDF(all, "inkflow-batch-" + sel.length + ".pdf", { dpi: 150, quality: 0.92 });
        toast("已导出 " + sel.length + " 篇（共 " + all.length + " 页）", "ok", 3200);
      } catch (e) { toast("导出失败：" + e.message, "err"); }
      finally { setBusy(false); }
    });

    /* 队列状态变化时重绘列表 */
    if (global.InkQueue) global.InkQueue.bind({ toast: toast, onChange: function () {
      if (mode === "queue") { renderQueueList(); var cur = global.InkQueue.current(); if (cur && cur.pages) { pages = cur.pages; currentPage = 0; paintPage(0); } }
    }});

    setMode("single");
    setView("import");

    /* ---------- 生成按钮 + 自动重绘开关 ---------- */
    var regen = $("regenerate");
    if (regen) regen.addEventListener("click", function () {
      clearDirty();
      toast("正在生成手写稿…", "ok", 900);
      regenerate();
    });

    var auto = $("autoRender");
    if (auto) {
      auto.checked = !!state.autoRender;
      auto.addEventListener("change", function () {
        state.autoRender = auto.checked;
        if (state.autoRender) {
          if (dirty) { clearDirty(); regenerate(); }
          toast("已开启自动生成", "ok", 1400);
        } else {
          toast("已关闭自动生成：改完参数后点「生成手写稿」", "warn", 3000);
        }
      });
    }

    window.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "Enter") { e.preventDefault(); clearDirty(); regenerate(); }
      var k = e.key.toLowerCase();
      if (k === "b") { e.preventDefault(); var fb = $("fmtBold"); if (fb) fb.click(); }
      if (k === "i") { e.preventDefault(); var fi = $("fmtItalic"); if (fi) fi.click(); }
      if (k === "u") { e.preventDefault(); var fu = $("fmtUnder"); if (fu) fu.click(); }
      if (k === "s") { e.preventDefault(); var b = $("exportPdf"); if (b) b.click(); }
    });
  }

  /* 把状态值写回滑杆（档位切换时用） */
  function syncRange(id) {
    var el = $(id); if (!el) return;
    var key = id;
    if (state[key] == null) return;
    el.value = String(state[key]);
    var out = $(id + "Out");
    if (out) {
      var v = parseFloat(el.value);
      var fmt = { fontSize: function(){return v+" px";}, lineHeight: function(){return v.toFixed(2)+"×";},
        letterSpacing: function(){return v.toFixed(1)+" px";}, jitter: function(){return v.toFixed(1)+" px";},
        rotateDeg: function(){return v.toFixed(2)+"°";}, sizeVary: function(){return (v*100).toFixed(1)+"%";},
        baselineDrift: function(){return v.toFixed(1)+" px";}, formulaHand: function(){return Math.round(v*100)+"%";},
        formulaScale: function(){return v.toFixed(2)+"×";}, inkAmount: function(){return Math.round(v*100)+"%";},
        margin: function(){return v+" px";} }[id];
      out.textContent = fmt ? fmt() : String(v);
    }
  }

  function updateCounts() {
    var el = $("counts");
    if (!el) return;
    var s = els.source ? els.source.value : "";
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
    if (els.source) els.source.value = global.InkSamples.equation;
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

  global.InkApp = { state: state, toSettings: toSettings, doRender: doRender, regenerate: regenerate, scheduleRender: scheduleRender, registerFonts: registerFonts, setFontBase: setFontBase, boot: boot };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : this);
