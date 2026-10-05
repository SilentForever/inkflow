/* InkFlow · 公式渲染：MathJax(tex-svg) → 矢量 SVG → 潦草化位图
 * 1) MathJax 直接给出 width/height（ex 单位）与 vertical-align（基线以下深度），
 *    因此无需 DOM 测量即可精确换算像素尺寸与基线偏移。
 * 2) 「潦草化」= 波形扭曲 + 多次叠描，让印刷体公式呈现出被手写覆盖的观感。
 *    结果按 (公式, 强度, 种子) 缓存，每页只计算一次。 */
(function (global) {
  "use strict";
  var U = global.InkUtil;

  var cache = new Map();       // latex|px|color -> {html,w,h,depth}
  var imgCache = new Map();    // html -> Image|null
  var scribCache = new Map();  // key -> {canvas,padPx,w,h}
  var ready = false, failed = false;
  var EX_RATIO = 0.5;

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

  /* ---------- 1. LaTeX → SVG ---------- */
  function render(latex, fontPx, color) {
    var src = String(latex == null ? "" : latex);
    if (!src.trim()) return null;
    var key = Math.round(fontPx * 100) + "|" + (color || "") + "|" + src;
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
      clone.setAttribute("width", wPx);
      clone.setAttribute("height", hPx);
      clone.setAttribute("style", "color:" + (color || "#111") + ";display:block;");
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
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

  /* ---------- 3. 潦草化：波形扭曲 + 多次叠描 ---------- */
  var SS = 2;   // 超采样倍率

  function scribble(img, w, h, amount, seed, color) {
    var key = w.toFixed(2) + "x" + h.toFixed(2) + "|" + amount.toFixed(2) + "|" + seed + "|" + (color || "") + "|" + U.hashString(String(img.src || ""));
    if (scribCache.has(key)) return scribCache.get(key);

    var W = Math.max(2, Math.ceil(w * SS));
    var H = Math.max(2, Math.ceil(h * SS));
    var rnd = new U.Rand(seed >>> 0, "scrib|" + amount.toFixed(2));

    // 波形幅度：决定"歪扭"程度
    /* 幅度按"字形尺度"取，避免高分式（H 很大）被过度扭曲 */
    var glyph = Math.min(H, Math.max(24, W * 0.35));
    var waveAmp = amount * glyph * 0.05;
    var pad = Math.ceil(waveAmp + H * 0.05) + 2;
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H + pad * 2;
    var ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (!(amount > 0.001)) {
      ctx.drawImage(img, 0, pad, W, H);
      var plain = { canvas: cv, padPx: pad / SS, w: w, h: h };
      scribCache.set(key, plain);
      return plain;
    }

    var passes = amount > 0.55 ? 3 : (amount > 0.25 ? 2 : 1);
    var freq = 1.1 + rnd.next() * 1.8;
    var phase = rnd.next() * Math.PI * 2;
    /* 切片按「图像自然宽度」计算（源坐标），目标坐标再乘 SS。
       注意：img 的自然尺寸是 w×h，画布是 W×H，两者不可混用。 */
    var slices = Math.max(12, Math.round(w / 3));
    var sliceW = w / slices;
    var passAlpha = [1, 0.46, 0.3];
    var passScale = [1, 0.85, 0.7];

    for (var p = 0; p < passes; p++) {
      ctx.save();
      ctx.globalAlpha = passAlpha[p];
      var ox = rnd.jitter(amount * W * 0.008 * passScale[p]);
      var oy = rnd.jitter(amount * H * 0.016 * passScale[p]);
      var rot = rnd.jitter(amount * 0.010 * passScale[p]);
      ctx.translate(W / 2, pad + H / 2);
      ctx.rotate(rot);
      ctx.translate(-W / 2, -(pad + H / 2));
      for (var i = 0; i < slices; i++) {
        var sx = i * sliceW;                 // 源坐标（自然尺寸空间）
        var t = i / slices;
        var wy = Math.sin(t * Math.PI * 2 * freq + phase) * waveAmp + oy;
        var wx = Math.cos(t * Math.PI * 2 * freq * 0.63 + phase) * waveAmp * 0.35 + ox;
        ctx.drawImage(
          img,
          sx, 0, Math.min(sliceW + 0.5, w - sx), h,        // 源：自然尺寸
          sx * SS + wx, pad + wy, sliceW * SS + 0.8, H     // 目标：超采样尺寸
        );
      }
      ctx.restore();
    }

    var res = { canvas: cv, padPx: pad / SS, w: w, h: h };
    scribCache.set(key, res);
    return res;
  }

  global.InkMath = {
    render: render, loadImage: loadImage, scribble: scribble,
    isAvailable: isAvailable, markReady: markReady, markFailed: markFailed,
    clearCache: clearCache, stats: stats, cacheSize: function () { return cache.size; },
    EX_RATIO: EX_RATIO
  };
})(typeof window !== "undefined" ? window : this);
