/* InkFlow · 公式渲染：MathJax(tex-svg) → 手写字形重绘 → 位图
 *
 * 思路：MathJax 只负责「排版」——算出每个字形的精确位置与字号；
 *       字形本身用**手写字体**重新绘制，于是公式里的数字、符号
 *       （∠ △ ≅ ∵ ∴ √ ∫ ∑ π ° …）也变成手写体。
 *
 * 1) MathJax 给出 width/height（ex 单位）与 vertical-align（基线深度），
 *    无需 DOM 测量即可换算像素尺寸与基线偏移。
 * 2) 解析 SVG 的 <g data-mml-node> 嵌套，累乘 transform 矩阵，
 *    得到每个 <use>（字形）与 <rect>（分数线/根号线）的绝对坐标。
 * 3) 逐字符挑字体：正文手写体 → Zen Kurenaido（数学符号覆盖最全）→
 *    都不覆盖时保留 MathJax 原字形（保证内容绝对正确）。
 * 4) 再叠加轻微抖动，模拟手写时字被写歪。
 * 结果按 (公式, 字号, 颜色, 手写度, 种子, 字体) 缓存。
 */
(function (global) {
  "use strict";
  var U = global.InkUtil;

  var cache = new Map();
  var imgCache = new Map();
  var scribCache = new Map();
  var ready = false, failed = false;
  var EX_RATIO = 0.5;
  var SS = 2;

  function isAvailable() { return !failed && typeof global.MathJax !== "undefined" && typeof global.MathJax.tex2svg === "function"; }
  function markReady() { ready = true; failed = false; }
  function markFailed() { failed = true; }
  function stats() { return { ready: ready, failed: failed, available: isAvailable(), cached: cache.size, scribbled: scribCache.size }; }
  function clearCache() { cache.clear(); imgCache.clear(); scribCache.clear(); _covCache = {}; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  function readEx(svg) {
    var wEx = num(svg.getAttribute("width"));
    var hEx = num(svg.getAttribute("height"));
    var m = (svg.getAttribute("style") || "").match(/vertical-align:\s*(-?[\d.]+)ex/);
    var va = m ? parseFloat(m[1]) : 0;
    return { wEx: wEx, hEx: hEx, depthEx: va < 0 ? -va : 0 };
  }

  /* ================= 字形覆盖检测 ================= */
  var _mc = null, _covCache = {};
  function measurer() { if (!_mc) _mc = document.createElement("canvas"); return _mc.getContext("2d"); }
  /* 某字体是否含该字符：与「必然缺失」的 sans-serif 兜底比较宽度 */
  function hasGlyph(family, ch) {
    var key = family + "|" + ch;
    if (key in _covCache) return _covCache[key];
    var ok = false;
    try {
      var c = measurer();
      c.font = '64px "' + family + '"';
      var w1 = c.measureText(ch).width;
      c.font = "64px sans-serif";
      var w2 = c.measureText(ch).width;
      c.font = "64px serif";
      var w3 = c.measureText(ch).width;
      ok = Math.abs(w1 - w2) > 0.01 || Math.abs(w1 - w3) > 0.01;
    } catch (e) { ok = false; }
    _covCache[key] = ok;
    return ok;
  }
  function pickFont(families, ch) {
    for (var i = 0; i < families.length; i++) if (hasGlyph(families[i], ch)) return families[i];
    return null;
  }

  /* ================= 组合字形 =================
   * 少数符号在所有手写体里都没有（如 ≅ U+2245）。
   * 用两个手写字符拼出来，既保持手写观感，又不丢失含义。
   * dy 以 em 为单位，负值向上。 */
  var COMPOSITES = {
    "2245": [{ c: "\u223C", dy: -0.34, s: 0.92 }, { c: "=", dy: 0.02, s: 1.0 }],   // ≅ = ∼ 上 = 下
    "2243": [{ c: "\u223C", dy: -0.30, s: 0.88 }, { c: "=", dy: 0.04, s: 1.0 }],   // ≃
    "2242": [{ c: "=", dy: -0.06, s: 1.0 }, { c: "\u223C", dy: 0.34, s: 0.92 }]    // ≂
  };

  /* ================= 数学字母数字 → 普通字符 =================
   * MathJax 用 Unicode 数学字母区（𝐴 U+1D434 等），普通字体没有；
   * 折回 ASCII / 希腊字母即可。 */
  function charOf(code) {
    var c = parseInt(code, 16);
    if (!isFinite(c)) return null;
    /* 数学字母数字符号区 */
    if (c >= 0x1D400 && c <= 0x1D7FF) {
      /* 按 52 个字母一组（A-Z a-z）折叠 */
      var base = c - 0x1D400;
      var sets = [0x1D400, 0x1D434, 0x1D468, 0x1D49C, 0x1D4D0, 0x1D504, 0x1D538,
                  0x1D56C, 0x1D5A0, 0x1D5D4, 0x1D608, 0x1D63C, 0x1D670];
      for (var i = 0; i < sets.length; i++) {
        var off = c - sets[i];
        if (off >= 0 && off < 52) {
          var ci = off < 26 ? (65 + off) : (97 + off - 26);
          return String.fromCharCode(ci);
        }
      }
      /* 希腊字母：尽量映射到普通希腊区 */
      if (c >= 0x1D6A8 && c <= 0x1D6E1) {
        var go = c - 0x1D6A8;
        if (go < 25) return String.fromCharCode(0x391 + go);
        if (go >= 25 && go < 50) return String.fromCharCode(0x3B1 + (go - 25));
      }
      return null;   // 不认识的数学字母 → 交给 MathJax 原字形
    }
    if (c === 0xA0 || c === 0x2009 || c === 0x200A || c === 0x2061) return null;  // 空格类不画
    return String.fromCodePoint(c);
  }

  /* ================= 矩阵运算 ================= */
  function matMul(m1, m2) {   // 先 m2 后 m1
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  }
  function parseTransform(str) {
    var m = [1, 0, 0, 1, 0, 0];
    if (!str) return m;
    var re = /(translate|scale|rotate|matrix)\s*\(([^)]*)\)/g, mm;
    while ((mm = re.exec(str))) {
      var a = mm[2].split(/[\s,]+/).filter(function (x) { return x !== ""; }).map(Number);
      var t;
      if (mm[1] === "translate") t = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
      else if (mm[1] === "scale") t = [a[0] === undefined ? 1 : a[0], 0, 0, (a[1] === undefined ? a[0] : a[1]) || 1, 0, 0];
      else if (mm[1] === "rotate") { var r = (a[0] || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r); t = [cs, sn, -sn, cs, a[1] || 0, a[2] || 0]; }
      else if (mm[1] === "matrix") t = [a[0], a[1], a[2], a[3], a[4], a[5]];
      else continue;
      m = matMul(m, t);
    }
    return m;
  }
  function apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

  /* ================= 手写字形重绘 ================= */
  var SKIP_NODE = { mspace: 1, mstyle: 1, mpadded: 1, mphantom: 1 };

  function redrawGlyphs(svg, fontPx, pxPerUnit, families, rnd) {
    var uses = [], rects = [], lines = [];
    (function walk(node, m) {
      var kids = node.children || [];
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        var tag = el.tagName ? el.tagName.toLowerCase() : "";
        if (tag === "defs" || tag === "title" || tag === "desc") continue;
        var mm = matMul(m, parseTransform(el.getAttribute("transform")));
        if (tag === "use") uses.push({ el: el, m: mm });
        else if (tag === "rect") rects.push({ el: el, m: mm });
        else if (tag === "line") lines.push({ el: el, m: mm });
        else walk(el, mm);
      }
    })(svg, [1, 0, 0, 1, 0, 0]);

    if (!uses.length) return false;

    var out = [];
    var emUnits = fontPx / pxPerUnit;      // 1em = 多少 SVG 用户单位
    var kept = 0, drawn = 0, byFont = {};

    /* --- 字形 --- */
    for (var i = 0; i < uses.length; i++) {
      var u = uses[i];
      var ch = charOf(u.el.getAttribute("data-c"));
      var pos = apply(u.m, 0, 0);
      var sc = Math.hypot(u.m[0], u.m[1]) || 1;
      /* 组合字形：用两个手写字符拼出来 */
      var comp = COMPOSITES[u.el.getAttribute("data-c")];
      if (comp) {
        var made = true, parts = [];
        for (var ci = 0; ci < comp.length; ci++) {
          var pf = pickFont(families, comp[ci].c);
          if (!pf) { made = false; break; }
          var psz = emUnits * sc * comp[ci].s;
          parts.push('<text x="' + pos[0].toFixed(2) + '" y="' + (-pos[1] + comp[ci].dy * psz).toFixed(2) + '"' +
                     ' font-family="' + pf.replace(/"/g, "") + '" font-size="' + psz.toFixed(2) + '"' +
                     ' fill="currentColor">' + escapeXml(comp[ci].c) + '</text>');
        }
        if (made) {
          out.push(parts.join(""));
          drawn++;
          byFont["composite"] = (byFont["composite"] || 0) + 1;
          continue;
        }
      }
      var fam = ch ? pickFont(families, ch) : null;
      if (!fam) {
        /* 无法手写化 → 保留 MathJax 原字形，保证正确性 */
        out.push('<g transform="translate(' + pos[0].toFixed(2) + ',' + pos[1].toFixed(2) + ') scale(' + sc.toFixed(4) + ')">' +
                 u.el.outerHTML + '</g>');
        kept++;
        continue;
      }
      drawn++;
      byFont[fam] = (byFont[fam] || 0) + 1;
      /* 轻微抖动：字被写歪、大小不一 */
      var jx = rnd ? rnd.jitter(emUnits * sc * 0.012) : 0;
      var jy = rnd ? rnd.jitter(emUnits * sc * 0.016) : 0;
      var jr = rnd ? rnd.jitter(0.9) : 0;
      var js = 1 + (rnd ? rnd.jitter(0.012) : 0);
      out.push('<text x="' + pos[0].toFixed(2) + '" y="' + (-pos[1]).toFixed(2) + '"' +
               ' font-family="' + fam.replace(/"/g, "") + '"' +
               ' font-size="' + (emUnits * sc * js).toFixed(2) + '"' +
               ' fill="currentColor"' +
               (Math.abs(jr) > 0.01 ? ' transform="rotate(' + jr.toFixed(2) + ' ' + pos[0].toFixed(2) + ' ' + (-pos[1]).toFixed(2) + ')"' : '') +
               '>' + escapeXml(ch) + '</text>');
    }

    /* --- 分数线 / 根号线 / 表格线 --- */
    for (var r = 0; r < rects.length; r++) {
      var rc = rects[r], el2 = rc.el;
      var x0 = num(el2.getAttribute("x")), y0 = num(el2.getAttribute("y"));
      var w0 = num(el2.getAttribute("width")), h0 = num(el2.getAttribute("height"));
      var p1 = apply(rc.m, x0, y0), p2 = apply(rc.m, x0 + w0, y0 + h0);
      var xa = Math.min(p1[0], p2[0]), xb = Math.max(p1[0], p2[0]);
      var ya = Math.min(-p1[1], -p2[1]), yb = Math.max(-p1[1], -p2[1]);
      var th = Math.max(0.6, yb - ya);
      var midY = (ya + yb) / 2;
      var wob = th * 0.55;
      var bend = rnd ? rnd.jitter(th * 0.5) : 0;
      out.push('<path d="M ' + xa.toFixed(2) + ' ' + midY.toFixed(2) +
               ' C ' + ((xa + (xb - xa) * 0.33).toFixed(2)) + ' ' + (midY + bend + wob * 0.3).toFixed(2) +
               ', ' + ((xa + (xb - xa) * 0.66).toFixed(2)) + ' ' + (midY - bend - wob * 0.3).toFixed(2) +
               ', ' + xb.toFixed(2) + ' ' + midY.toFixed(2) + '"' +
               ' fill="none" stroke="currentColor" stroke-width="' + th.toFixed(2) +
               '" stroke-linecap="round"/>');
    }
    for (var li = 0; li < lines.length; li++) {
      var ln = lines[li], le = ln.el;
      var q1 = apply(ln.m, num(le.getAttribute("x1")), num(le.getAttribute("y1")));
      var q2 = apply(ln.m, num(le.getAttribute("x2")), num(le.getAttribute("y2")));
      var sw = Math.max(0.6, num(le.getAttribute("stroke-width")) * Math.hypot(ln.m[0], ln.m[1]));
      out.push('<line x1="' + q1[0].toFixed(2) + '" y1="' + (-q1[1]).toFixed(2) +
               '" x2="' + q2[0].toFixed(2) + '" y2="' + (-q2[1]).toFixed(2) +
               '" stroke="currentColor" stroke-width="' + sw.toFixed(2) + '"/>');
    }

    /* --- 用新内容替换整个 svg 内容 --- */
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("stroke-width", "0");
    g.innerHTML = out.join("");
    svg.appendChild(g);
    svg.__inkStat = { drawn: drawn, kept: kept, byFont: byFont, emUnits: emUnits };
    return true;
  }

  function escapeXml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ================= 整片抖动（保留原有能力） ================= */
  function handify(svg, amount, seed, fontPx) {
    if (!(amount > 0.001)) return svg;
    var rnd = new U.Rand(seed >>> 0, "handify");
    var vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    var wAttr = num(svg.getAttribute("width")) || 1;
    var unitToPx = (vb.length === 4 && vb[2] > 0) ? wAttr / vb[2] : 1;
    var amp = Math.max(0, Math.min(1, amount));

    var nodes = svg.querySelectorAll("text, use");
    for (var i = 0; i < nodes.length; i++) {
      var u = nodes[i];
      var dx = rnd.jitter(amp * fontPx * 0.070) * (1 / unitToPx);
      var dy = rnd.jitter(amp * fontPx * 0.090) * (1 / unitToPx);
      var rot = rnd.jitter(amp * 7.0);
      var sc = 1 + rnd.jitter(amp * 0.070);
      var prev = u.getAttribute("transform") || "";
      u.setAttribute("transform", (prev ? prev + " " : "") +
        "translate(" + dx.toFixed(2) + "," + dy.toFixed(2) + ") rotate(" + rot.toFixed(2) + ") scale(" + sc.toFixed(3) + ")");
    }
    var rects = svg.querySelectorAll("rect, path");
    for (var k = 0; k < rects.length; k++) {
      var r = rects[k];
      var dy2 = rnd.jitter(amp * fontPx * 0.018) * (1 / unitToPx);
      var rot2 = rnd.jitter(amp * 1.1);
      var prevR = r.getAttribute("transform") || "";
      r.setAttribute("transform", (prevR ? prevR + " " : "") +
        "translate(0," + dy2.toFixed(2) + ") rotate(" + rot2.toFixed(2) + ")");
    }
    return svg;
  }

  /* ================= 1. LaTeX → SVG ================= */
  function render(latex, fontPx, color, amount, seed, opts) {
    var src = String(latex == null ? "" : latex);
    if (!src.trim()) return null;
    var amt = (typeof amount === "number") ? amount : 0;
    var sd = (seed == null ? 0 : seed) >>> 0;
    opts = opts || {};
    var families = opts.handFonts || [];
    var famKey = families.join(",");
    var key = Math.round(fontPx * 100) + "|" + (color || "") + "|" + amt.toFixed(2) + "|" + sd + "|" + famKey + "|" + src;
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
      var vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
      var vbW = (vb.length === 4 && vb[2] > 0) ? vb[2] : wPx;

      var clone = svg.cloneNode(true);
      clone.setAttribute("width", wPx);
      clone.setAttribute("height", hPx);
      clone.setAttribute("style", "color:" + (color || "#111") + ";display:block;");
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      var stat = null;
      if (families.length) {
        var rnd0 = new U.Rand(sd, "glyph");
        redrawGlyphs(clone, fontPx, wPx / vbW, families, rnd0);
        stat = clone.__inkStat || null;
      }
      handify(clone, amt, sd, fontPx);

      var g = clone.querySelector("g");
      if (g && !g.getAttribute("fill")) g.setAttribute("fill", "currentColor");
      out = { html: clone.outerHTML, w: wPx, h: hPx, depth: dPx, glyphStat: stat };
      cache.set(key, out);
    } catch (e) { out = null; }
    return out;
  }

  /* ================= 2. SVG → Image ================= */
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

  /* ================= 3. 光栅化 ================= */
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
    hasGlyph: hasGlyph, charOf: charOf,
    EX_RATIO: EX_RATIO, SS: SS
  };
})(typeof window !== "undefined" ? window : this);
