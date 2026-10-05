/* InkFlow · 按需加载重型本地组件（经典脚本，兼容 file://）
 *
 * 首屏只加载「公式引擎 + 轻量本地模块」；PDF / Word / OCR / jsPDF 等
 * 只在真正用到时再插入 <script>，避免拖慢首次加载。
 * 所有资源仍是同源本地文件，不发起任何网络请求。
 */
(function (global) {
  "use strict";

  var BASE = (function () {
    try {
      var s = document.currentScript && document.currentScript.src;
      return s ? s.replace(/js\/loader\.js.*$/, "") : "";
    } catch (e) { return ""; }
  })();

  var pending = {};
  function loadScript(url) {
    if (pending[url]) return pending[url];
    pending[url] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url;
      s.async = false;
      s.onload = function () { resolve(url); };
      s.onerror = function () { delete pending[url]; reject(new Error("组件加载失败：" + url)); };
      document.head.appendChild(s);
    });
    return pending[url];
  }

  /* 等待某个全局变量出现（脚本已加载但可能尚未初始化完成） */
  function when(pred, timeout) {
    return new Promise(function (resolve, reject) {
      var t0 = Date.now();
      (function poll() {
        if (pred()) return resolve();
        if (Date.now() - t0 > (timeout || 15000)) return reject(new Error("组件就绪超时"));
        setTimeout(poll, 40);
      })();
    });
  }

  function ensurePdf() {
    if (global.pdfjsLib) return Promise.resolve();
    return loadScript(BASE + "vendor/pdf.min.js").then(function () { return when(function () { return !!global.pdfjsLib; }); });
  }
  function ensureDocx() {
    if (global.mammoth) return Promise.resolve();
    return loadScript(BASE + "vendor/mammoth.browser.min.js").then(function () { return when(function () { return !!global.mammoth; }); });
  }
  function ensureOcr() {
    if (global.Tesseract) return Promise.resolve();
    return loadScript(BASE + "vendor/tesseract.min.js").then(function () { return when(function () { return !!global.Tesseract; }); });
  }
  function ensureJsPdf() {
    if (global.jspdf && global.jspdf.jsPDF) return Promise.resolve();
    return loadScript(BASE + "vendor/jspdf.umd.min.js").then(function () { return when(function () { return !!(global.jspdf && global.jspdf.jsPDF); }); });
  }

  global.InkLoader = {
    loadScript: loadScript, when: when,
    ensurePdf: ensurePdf, ensureDocx: ensureDocx, ensureOcr: ensureOcr, ensureJsPdf: ensureJsPdf,
    BASE: BASE
  };
})(typeof window !== "undefined" ? window : this);
