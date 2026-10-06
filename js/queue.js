/* InkFlow · 批量队列：多文档排队转写 + 结果缓存 + 批量导出
 * 纯内存，刷新即清空。
 */
(function (global) {
  "use strict";
  var U = global.InkUtil;

  var items = [];          // 队列
  var seq = 0;
  var running = false;
  var stopFlag = false;
  var currentId = null;    // 当前预览的文档 id
  var ctx = { toast: function () {}, onChange: function () {} };

  function $(id) { return document.getElementById(id); }

  function hashSettings(s) {
    var keys = ["pageSize","paper","fontKeyCJK","fontKeyLat","fontSize","lineHeight","letterSpacing",
      "hand","jitter","rotateDeg","sizeVary","baselineDrift","formulaHand","formulaScale",
      "inkColor","textColor","inkAmount","inkVary","margin","bold","italic","underline","textScale","sizeFromSource","pageAnchor",
      "showHeader","headerText","showDate","showFooter","showTotalPages","seed"];
    var parts = [];
    for (var i = 0; i < keys.length; i++) parts.push(keys[i] + "=" + s[keys[i]]);
    return U.hashString(parts.join("|")) >>> 0;
  }

  function pageCountOf(text) {
    try { return (global.InkParser && global.InkParser.pageMarks) ? global.InkParser.pageMarks(text).length : 0; }
    catch (e) { return 0; }
  }

  function add(name, kind, text) {
    var it = {
      id: "d" + (++seq),
      name: name || ("文档 " + seq),
      kind: kind || "text",
      text: text || "",
      status: text ? "pending" : "error",
      error: text ? "" : "未识别到内容",
      pageCount: pageCountOf(text || ""),   // 原文档页数（多页 PDF/Word > 1）
      pages: null,
      settingsHash: 0,
      checked: true
    };
    items.push(it);
    ctx.onChange();
    return it;
  }

  function remove(id) {
    items = items.filter(function (x) { return x.id !== id; });
    if (currentId === id) currentId = null;
    ctx.onChange();
  }

  function clearAll() {
    items = []; currentId = null; stopFlag = true;
    ctx.onChange();
  }

  function get(id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }

  function counts() {
    var c = { total: items.length, done: 0, pending: 0, error: 0, rendering: 0 };
    items.forEach(function (x) {
      if (x.status === "done") c.done++;
      else if (x.status === "pending") c.pending++;
      else if (x.status === "error") c.error++;
      else if (x.status === "rendering") c.rendering++;
    });
    return c;
  }

  /* 转写单篇：渲染 → 缓存 */
  async function renderOne(it, s, force) {
    var h = hashSettings(s);
    if (!force && it.pages && it.settingsHash === h) return;   // 命中缓存
    it.status = "rendering";
    it.error = "";
    ctx.onChange();
    try {
      var blocks = global.InkParser.parse(it.text);
      var res = await global.InkRender.render(blocks, s, {});
      it.pages = res.canvases;
      it.settingsHash = h;
      it.status = "done";
    } catch (e) {
      it.status = "error";
      it.error = String(e && e.message || e);
      it.pages = null;
    }
    ctx.onChange();
  }

  /* 排队转写：逐个（串行），带进度反馈 */
  async function runAll(settingsFn) {
    if (running) return;
    running = true; stopFlag = false;
    setRunUI(true);
    var todo = items.filter(function (x) { return x.text; });
    var doneN = 0;
    for (var i = 0; i < todo.length; i++) {
      if (stopFlag) break;
      var it = todo[i];
      setProgress(i, todo.length, it.name);
      await renderOne(it, settingsFn(), false);
      doneN++;
      setProgress(i + 1, todo.length, it.name);
    }
    running = false;
    setRunUI(false);
    var c = counts();
    ctx.toast("转写完成：成功 " + c.done + " / 失败 " + c.error, c.error ? "warn" : "ok", 3200);
  }

  function stop() { stopFlag = true; }

  function setRunUI(isRunning) {
    var b = $("queueRun"), s = $("queueStop"), p = $("queueProgress");
    if (b) { b.disabled = isRunning; b.textContent = isRunning ? "转写中…" : "全部转写"; }
    if (s) s.disabled = !isRunning;
    if (p) p.hidden = !isRunning && counts().total === 0;
  }
  function setProgress(done, total, name) {
    var fill = $("queueBarFill"), hint = $("queueHint"), p = $("queueProgress");
    if (p) p.hidden = false;
    if (fill) fill.style.width = (total ? Math.round(done / total * 100) : 0) + "%";
    if (hint) hint.textContent = total ? ("正在转写 " + Math.min(done + 1, total) + " / " + total + "：" + name) : "—";
  }

  /* 当前预览的文档（供右侧预览使用） */
  function current() { return get(currentId); }
  function select(id) { currentId = id; ctx.onChange(); return get(id); }

  function checked() { return items.filter(function (x) { return x.checked && x.status === "done" && x.pages; }); }

  function allPagesOf(list) {
    var out = [];
    list.forEach(function (it) { out = out.concat(it.pages); });
    return out;
  }

  global.InkQueue = {
    bind: function (o) { if (o) ctx = Object.assign({}, ctx, o); },
    add: add, remove: remove, clearAll: clearAll, get: get, items: function () { return items; },
    counts: counts, runAll: runAll, stop: stop, renderOne: renderOne,
    current: current, select: select, checked: checked, allPagesOf: allPagesOf,
    hashSettings: hashSettings,
    isRunning: function () { return running; }
  };
})(typeof window !== "undefined" ? window : this);
