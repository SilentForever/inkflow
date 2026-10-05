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
      /* 关键：必须「追加」到 MathJax 原有的 transform 之后，不能覆盖。
         覆盖会丢掉 MathJax 的字形定位（如 translate(500,0)），
         导致同一个数字的两位叠在一起（16 显示成 6）。 */
      var prev = u.getAttribute("transform") || "";
      u.setAttribute("transform", (prev ? prev + " " : "") +
        "translate(" + dx.toFixed(2) + "," + dy.toFixed(2) + ") rotate(" + rot.toFixed(2) + ") scale(" + sc.toFixed(3) + ")");
    }
    /* 2) 分数线 / 根号线：轻微起伏，像手画的横线 */
    var rects = svg.querySelectorAll("rect");
    for (var k = 0; k < rects.length; k++) {
      var r = rects[k];
      var dy2 = rnd.jitter(amp * fontPx * 0.018) * pxToUnit;
      var rot2 = rnd.jitter(amp * 1.1);
      var prevR = r.getAttribute("transform") || "";
      r.setAttribute("transform", (prevR ? prevR + " " : "") +
        "translate(0," + dy2.toFixed(2) + ") rotate(" + rot2.toFixed(2) + ")");
    }
    return svg;
  }

  /* ---------- 字体覆盖检测 ---------- */
  var _mc2 = null, _cov = {};
  function meas2() { if (!_mc2) _mc2 = document.createElement("canvas"); return _mc2.getContext("2d"); }
  function hasGlyph(family, ch) {
    var key = family + "|" + ch;
    if (key in _cov) return _cov[key];
    var ok = false;
    try {
      var c = meas2();
      c.font = '64px "' + family + '"';
      var w1 = c.measureText(ch).width;
      c.font = "64px sans-serif";
      var w2 = c.measureText(ch).width;
      c.font = "64px serif";
      var w3 = c.measureText(ch).width;
      ok = Math.abs(w1 - w2) > 0.01 || Math.abs(w1 - w3) > 0.01;
    } catch (e) { ok = false; }
    _cov[key] = ok;
    return ok;
  }
  function pickFont(fams, ch) {
    for (var i = 0; i < fams.length; i++) if (hasGlyph(fams[i], ch)) return fams[i];
    return null;
  }
  /* 数学字母数字符号区 → 普通字符 */
  function charOf(code) {
    var c = parseInt(code, 16);
    if (!isFinite(c)) return null;
    if (c >= 0x1D400 && c <= 0x1D7FF) {
      var sets = [0x1D400, 0x1D434, 0x1D468, 0x1D49C, 0x1D4D0, 0x1D504, 0x1D538,
                  0x1D56C, 0x1D5A0, 0x1D5D4, 0x1D608, 0x1D63C, 0x1D670];
      for (var i = 0; i < sets.length; i++) {
        var off = c - sets[i];
        if (off >= 0 && off < 52) return String.fromCharCode(off < 26 ? 65 + off : 97 + off - 26);
      }
      if (c >= 0x1D6A8 && c <= 0x1D6E1) {
        var go = c - 0x1D6A8;
        if (go < 25) return String.fromCharCode(0x391 + go);
        if (go >= 25 && go < 50) return String.fromCharCode(0x3B1 + go - 25);
      }
      return null;
    }
    if (c === 0xA0 || c === 0x2009 || c === 0x200A || c === 0x2061) return null;
    return String.fromCodePoint(c);
  }
  /* 组合字形：手写体普遍缺失的符号，用两个手写字符拼出来 */
  var COMPOSITES = {
    "2245": [{ c: "\u223C", dy: -0.30, s: 0.92 }, { c: "=", dy: 0.06, s: 1.0 }],
    "2243": [{ c: "\u223C", dy: -0.26, s: 0.88 }, { c: "=", dy: 0.08, s: 1.0 }],
    "2242": [{ c: "=", dy: -0.08, s: 1.0 }, { c: "\u223C", dy: 0.30, s: 0.92 }]
  };
  /* 累乘祖先的 scale 因子（只取 scale，避免坐标翻转问题） */
  function scaleOf(el, root) {
    var s = 1, n = el;
    while (n && n !== root) {
      var t = n.getAttribute && n.getAttribute("transform");
      if (t) {
        var re = /scale\(([^)]*)\)/g, mm;
        while ((mm = re.exec(t))) {
          var a = mm[2].split(/[\s,]+/).filter(function (x) { return x !== ""; }).map(Number);
          s *= (a[0] === undefined ? 1 : a[0]);
        }
      }
      n = n.parentNode;
    }
    return s || 1;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ---------- 1. LaTeX → SVG（含手写化） ----------
   * 做法：先让浏览器把 MathJax 的 SVG 真实布局一遍，用
   * getBoundingClientRect() 读出**每个字形的真实像素坐标与尺寸**
   * （这是唯一可靠的方式——手写解析 transform 矩阵极易在 scale(1,-1)
   *  这类嵌套下出错）。然后用**手写字体**在同样的位置重画字形。
   * 这样公式的排版完全由 MathJax 决定，我们只换「笔迹」。 */
  function render(latex, fontPx, color, amount, seed, opts) {
    var src = String(latex == null ? "" : latex);
    if (!src.trim()) return null;
    var amt = (typeof amount === "number") ? amount : 0;
    var sd = (seed == null ? 0 : seed) >>> 0;
    opts = opts || {};
    var fams = opts.handFonts || [];
    var key = Math.round(fontPx * 100) + "|" + (color || "") + "|" + amt.toFixed(2) + "|" + sd + "|" + fams.join(",") + "|" + src;
    if (cache.has(key)) return cache.get(key);
    if (!isAvailable()) return null;
    var out = null;
    var host = null;
    try {
      var node = global.MathJax.tex2svg(src, { display: false, em: 16, ex: 8, containerWidth: 100000 });
      var svg0 = node.querySelector ? node.querySelector("svg") : (node.tagName === "svg" ? node : null);
      if (!svg0) throw new Error("no svg");
      var ex = readEx(svg0);
      if (!(ex.wEx > 0) || !(ex.hEx > 0)) throw new Error("bad dims");
      var exPx = fontPx * EX_RATIO;
      var wPx = ex.wEx * exPx, hPx = ex.hEx * exPx, dPx = ex.depthEx * exPx;

      var clone = svg0.cloneNode(true);
      clone.setAttribute("width", wPx);
      clone.setAttribute("height", hPx);
      clone.setAttribute("style", "color:" + (color || "#111") + ";display:block;");
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      var stat = null;
      if (fams.length) {
        stat = redraw(clone, fontPx, wPx, fams, sd, amt);
      }
      handify(clone, amt, sd, fontPx);

      var g = clone.querySelector("g");
      if (g && !g.getAttribute("fill")) g.setAttribute("fill", "currentColor");
      out = { html: clone.outerHTML, w: wPx, h: hPx, depth: dPx, glyphStat: stat };
      cache.set(key, out);
    } catch (e) { out = null; }
    if (host && host.parentNode) host.parentNode.removeChild(host);
    return out;
  }

  /* 用 getBoundingClientRect 读取真实几何，再用手写字体重画。
   * 关键：不替换原 SVG，而是「隐藏已手写化的字形 + 追加一层手绘内容」，
   *       这样无法手写化的字符仍由 MathJax 原字形兜底，内容绝不丢失。 */
  function redraw(svg, fontPx, wPx, fams, seed, amount) {
    var amp = Math.max(0, Math.min(1, typeof amount === "number" ? amount : 0));
    var host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-20000px;top:0;width:0;height:0;overflow:hidden;";
    host.appendChild(svg);
    document.body.appendChild(host);
    var live = host.querySelector("svg");
    var sr = live.getBoundingClientRect();
    var vb = (live.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    var vbx = vb[0] || 0, vby = vb[1] || 0, vbw = vb[2] || sr.width, vbh = vb[3] || sr.height;
    var kx = vbw / (sr.width || 1), ky = vbh / (sr.height || 1);
    /* 像素(屏幕)坐标 → SVG 用户坐标 */
    function ux(px) { return vbx + px * kx; }
    function uy(py) { return vby + py * ky; }

    var rnd = new U.Rand(seed, "glyph");
    var mc = meas2();
    var REF = 100;
    var parts = [], drawn = 0, kept = 0, byFont = {};
    var toHide = [];
    var thisFam = fams[0] || "sans-serif";

    /* ---------- 字形 ---------- */
    var uses = live.querySelectorAll("use");
    for (var i = 0; i < uses.length; i++) {
      var u = uses[i], b = u.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0) continue;
      var code = u.getAttribute("data-c");
      var ch = charOf(code);
      var cxPx = b.left - sr.left, cyPx = b.top - sr.top;
      var bwPx = b.width, bhPx = b.height;
      var cxm = ux(cxPx + bwPx / 2), cym = uy(cyPx + bhPx / 2);

      function sizeFor(glyph, targetH) {
        mc.font = REF + "px \"" + thisFam + "\"";
        var a = 0, d = 0;
        try {
          var mt = mc.measureText(glyph);
          a = mt.actualBoundingBoxAscent || 0;
          d = mt.actualBoundingBoxDescent || 0;
        } catch (e) {}
        var nat = a + d;
        if (!(nat > 0)) nat = REF * 0.72;
        return targetH * REF / nat;
      }

      /* 组合字形 */
      var comp = COMPOSITES[code];
      if (comp) {
        var okc = true, sub = [];
        for (var ci = 0; ci < comp.length; ci++) {
          var pf = pickFont(fams, comp[ci].c);
          if (!pf) { okc = false; break; }
          thisFam = pf;
          var psz = sizeFor(comp[ci].c, bhPx) * comp[ci].s;   // px
          sub.push('<text x="' + cxm.toFixed(2) + '" y="' + (cym + comp[ci].dy * psz * ky).toFixed(2) +
                   '" font-family="' + pf.replace(/"/g, "") + '" font-size="' + (psz * kx).toFixed(2) + '"' +
                   ' text-anchor="middle" dominant-baseline="central" fill="currentColor">' + esc(comp[ci].c) + '</text>');
        }
        if (okc) { parts.push(sub.join("")); drawn++; byFont["composite"] = (byFont["composite"] || 0) + 1; toHide.push(u); continue; }
      }

      var fam = ch ? pickFont(fams, ch) : null;
      if (!fam) { kept++; continue; }        // 保留 MathJax 原字形
      thisFam = fam;
      drawn++; byFont[fam] = (byFont[fam] || 0) + 1;
      var fsz = sizeFor(ch, bhPx);                       // 像素
      var jx = rnd.jitter(fsz * 0.012 * amp), jy = rnd.jitter(fsz * 0.014 * amp);
      var jr = rnd.jitter(0.9 * amp), jsc = 1 + rnd.jitter(0.010 * amp);
      /* 注意：SVG 里的 font-size 是「用户单位」，必须按 viewBox 尺度换算 */
      parts.push('<text x="' + (cxm + jx * kx).toFixed(2) + '" y="' + (cym + jy * ky).toFixed(2) + '"' +
                 ' font-family="' + fam.replace(/"/g, "") + '" font-size="' + (fsz * jsc * kx).toFixed(2) + '"' +
                 ' text-anchor="middle" dominant-baseline="central" fill="currentColor"' +
                 (Math.abs(jr) > 0.01 ? ' transform="rotate(' + jr.toFixed(2) + ' ' + (cxm + jx * kx).toFixed(2) + ' ' + (cym + jy * ky).toFixed(2) + ')"' : '') +
                 '>' + esc(ch) + '</text>');
      toHide.push(u);
    }

    /* ---------- 分数线 / 根号线 / 表格线 ---------- */
    var rects = live.querySelectorAll("rect");
    for (var r = 0; r < rects.length; r++) {
      var rc = rects[r], rb = rc.getBoundingClientRect();
      if (rb.width <= 0) continue;
      var x0 = ux(rb.left - sr.left), x1 = ux(rb.right - sr.left);
      var yt = uy(rb.top - sr.top), yb2 = uy(rb.bottom - sr.top);
      var mid = (yt + yb2) / 2, th = Math.max(0.7, Math.abs(yb2 - yt));
      var bend = rnd.jitter(th * 0.45 * amp);
      parts.push('<path d="M ' + x0.toFixed(2) + ' ' + mid.toFixed(2) +
                 ' C ' + (x0 + (x1 - x0) * 0.34).toFixed(2) + ' ' + (mid + bend).toFixed(2) +
                 ', ' + (x0 + (x1 - x0) * 0.67).toFixed(2) + ' ' + (mid - bend).toFixed(2) +
                 ', ' + x1.toFixed(2) + ' ' + mid.toFixed(2) + '"' +
                 ' fill="none" stroke="currentColor" stroke-width="' + th.toFixed(2) + '" stroke-linecap="round"/>');
      toHide.push(rc);
    }
    var lines = live.querySelectorAll("line");
    for (var li = 0; li < lines.length; li++) {
      var le = lines[li], lb = le.getBoundingClientRect();
      var ly = uy(lb.top - sr.top + lb.height / 2);
      var lth = Math.max(0.7, lb.height || 1);
      parts.push('<path d="M ' + ux(lb.left - sr.left).toFixed(2) + ' ' + ly.toFixed(2) +
                 ' L ' + ux(lb.right - sr.left).toFixed(2) + ' ' + ly.toFixed(2) + '"' +
                 ' fill="none" stroke="currentColor" stroke-width="' + lth.toFixed(2) + '"/>');
      toHide.push(le);
    }

    /* ---------- 应用：隐藏已重绘的原元素 + 追加手绘层 ---------- */
    for (var h = 0; h < toHide.length; h++) {
      if (toHide[h].parentNode) toHide[h].parentNode.removeChild(toHide[h]);
    }
    var layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("stroke-width", "0");
    layer.innerHTML = parts.join("");
    live.appendChild(layer);

    var stat = { drawn: drawn, kept: kept, byFont: byFont };
    live.__inkStat = stat;
    return stat;
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
