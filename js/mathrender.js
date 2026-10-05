/* InkFlow · 公式渲染：MathJax(tex-svg) → 矢量 SVG → 字形级手写化 → 位图
 *
 * 1) MathJax 直接给出 width/height（ex 单位）与 vertical-align（基线以下深度），
 *    因此无需 DOM 测量即可精确换算像素尺寸与基线偏移。
 * 2) 「手写化」= 在 SVG 层面按 MathJax 的 <g data-mml-node> 结构，
 *    对**每一个字形**（<use>）单独施加位移 / 旋转 / 缩放抖动，
 *    对分数线与根号线施加轻微起伏。
 *    —— 这样既保留公式的数学正确性，又不会出现「整片扭曲」或「叠描重影」。
 * 3) 结果按 (公式, 字号, 颜色, 手写度, 种子) 缓存。
 */
(function (global) {
  "use strict";
  var U = global.InkUtil;

  var cache = new Map();       // key -> {html,w,h,depth}
  var imgCache = new Map();    // html -> Image|null
  var scribCache = new Map();  // key -> {canvas,padPx,w,h}
  var ready = false, failed = false;
  var EX_RATIO = 0.5;
  var SS = 2;                  // 位图超采样倍率（只影响清晰度，不再用于扭曲）

  function isAvailable() { return !failed && typeof global.MathJax !== "undefined" && typeof global.MathJax.tex2svg === "function"; }
  function markReady() { ready = true; failed = false; }
  function markFailed() { failed = true; }
  function stats() { return { ready: ready, failed: failed, available: isAvailable(), cached: cache.size, scribbled: scribCache.size }; }
  function clearCache() { cache.clear(); imgCache.clear(); scribCache.clear(); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  function readEx(svg) {
    var wEx = num(svg.getAttribute("width"));
    var hEx = num(svg.getAttribute("height"));
    var m = (svg.getAttribute("style") || "").match(/vertical-align:\s*(-?[\d.]+)ex/);
    var va = m ? parseFloat(m[1]) : 0;
    return { wEx: wEx, hEx: hEx, depthEx: va < 0 ? -va : 0 };
  }

  /* ---------- 字形级手写化 ----------
   * amount: 0..1 手写度；seed: 随机种子；fontPx: 当前公式字号（用于换算抖动幅度）
   * 抖动幅度以「像素」为单位，再按 viewBox/width 换算成 SVG 用户单位。 */
  function handify(svg, amount, seed, fontPx) {
    if (!(amount > 0.001)) return svg;
    var rnd = new U.Rand(seed >>> 0, "handify");
    var vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    var wAttr = num(svg.getAttribute("width")) || 1;
    var pxToUnit = (vb.length === 4 && vb[2] > 0) ? vb[2] / wAttr : 31.5;
    var amp = Math.max(0, Math.min(1, amount));

    /* 1) 字形：位移 + 旋转 + 轻微缩放（每个字形都不同） */
    var uses = svg.querySelectorAll("use");
    for (var i = 0; i < uses.length; i++) {
      var u = uses[i];
      var dx = rnd.jitter(amp * fontPx * 0.070) * pxToUnit;
      var dy = rnd.jitter(amp * fontPx * 0.090) * pxToUnit;
      var rot = rnd.jitter(amp * 7.0);
      var sc = 1 + rnd.jitter(amp * 0.070);
      u.setAttribute("transform",
        "translate(" + dx.toFixed(2) + "," + dy.toFixed(2) + ") rotate(" + rot.toFixed(2) + ") scale(" + sc.toFixed(3) + ")");
    }
    /* 2) 分数线 / 根号线：轻微起伏，像手画的横线 */
    var rects = svg.querySelectorAll("rect");
    for (var k = 0; k < rects.length; k++) {
      var r = rects[k];
      var dy2 = rnd.jitter(amp * fontPx * 0.018) * pxToUnit;
      var rot2 = rnd.jitter(amp * 1.1);
      r.setAttribute("transform", "translate(0," + dy2.toFixed(2) + ") rotate(" + rot2.toFixed(2) + ")");
    }
    return svg;
  }

  /* ---------- 1. LaTeX → SVG（含手写化） ---------- */
  function render(latex, fontPx, color, amount, seed) {
    var src = String(latex == null ? "" : latex);
    if (!src.trim()) return null;
    var amt = (typeof amount === "number") ? amount : 0;
    var sd = (seed == null ? 0 : seed) >>> 0;
    var key = Math.round(fontPx * 100) + "|" + (color || "") + "|" + amt.toFixed(2) + "|" + sd + "|" + src;
    if (cache.has(key)) return cache.get(key);
    if (!isAvailable()) return null;
    var out = null;
    try {
      var node = global.MathJax.tex2svg(src, { display: false, em: 16, ex: 8, containerWidth: 100000 });
      var svg = node.querySelector ? node.querySelector("svg") : (node.tagName === "svg" ? node : null);
      if (!svg) throw new Error("no svg");
      var ex = readEx(svg);
      if (!(ex.wEx > 0) || !(ex.hEx > 0)) throw new Error("bad dims");
      var exPx = fontPx * EX_RATIO;
      var wPx = ex.wEx * exPx, hPx = ex.hEx * exPx, dPx = ex.depthEx * exPx;
      var clone = svg.cloneNode(true);
      /* 先写入像素尺寸，再手写化 —— handify 需要用「像素宽度」反推
         SVG 用户单位，若仍沿用 MathJax 的 ex 宽度会把抖动放大二十余倍。 */
      clone.setAttribute("width", wPx);
      clone.setAttribute("height", hPx);
      clone.setAttribute("style", "color:" + (color || "#111") + ";display:block;");
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      handify(clone, amt, sd, fontPx);
      var g = clone.querySelector("g");
      if (g && !g.getAttribute("fill")) g.setAttribute("fill", "currentColor");
      out = { html: clone.outerHTML, w: wPx, h: hPx, depth: dPx };
      cache.set(key, out);
    } catch (e) { out = null; }
    return out;
  }

  /* ---------- 2. SVG → Image ---------- */
  function loadImage(html) {
    if (imgCache.has(html)) return Promise.resolve(imgCache.get(html));
    return new Promise(function (resolve) {
      var img = new Image();
      var s = html.indexOf("xmlns=") < 0 ? html.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"') : html;
      img.onload = function () { imgCache.set(html, img); resolve(img); };
      img.onerror = function () { imgCache.set(html, null); resolve(null); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
    });
  }

  /* ---------- 3. 光栅化（只做超采样，保证边缘清晰；不再扭曲） ----------
   * 保留 scribble 这个名字以兼容旧调用；amount 参数已不再影响几何形状。 */
  function scribble(img, w, h, amount, seed, color) {
    var key = w.toFixed(2) + "x" + h.toFixed(2) + "|" + (color || "") + "|" + U.hashString(String(img.src || ""));
    if (scribCache.has(key)) return scribCache.get(key);
    var W = Math.max(2, Math.ceil(w * SS));
    var H = Math.max(2, Math.ceil(h * SS));
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, W, H);
    var res = { canvas: cv, padPx: 0, w: w, h: h };
    scribCache.set(key, res);
    return res;
  }

  global.InkMath = {
    render: render, loadImage: loadImage, scribble: scribble, handify: handify,
    isAvailable: isAvailable, markReady: markReady, markFailed: markFailed,
    clearCache: clearCache, stats: stats, cacheSize: function () { return cache.size; },
    EX_RATIO: EX_RATIO, SS: SS
  };
})(typeof window !== "undefined" ? window : this);
