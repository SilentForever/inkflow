
/* 回归：公式字形级手写化的抖动幅度与边界 */
(async function () {
  var out = document.getElementById("out");
  try {
    await new Promise(function (res) {
      var t0 = Date.now();
      (function p() { if (window.InkMath && InkMath.isAvailable()) return res(true); if (Date.now() - t0 > 25000) return res(false); setTimeout(p, 100); })();
    });
    var LATEX = "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}";
    function R(hand, px) { return InkMath.render(LATEX, px || 40, "#1b2a5e", hand, 12345); }
    function stats(html) {
      var vb = html.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number);
      var wAttr = parseFloat(html.match(/width="([\d.]+)"/)[1]);
      var unitToPx = wAttr / vb[2];
      var re = /<use[^>]*translate\((-?[\d.]+),(-?[\d.]+)\)\s*rotate\((-?[\d.]+)\)/g, m, dx = [], dy = [], rot = [];
      while ((m = re.exec(html))) {
        dx.push(Math.abs(parseFloat(m[1]) * unitToPx));
        dy.push(Math.abs(parseFloat(m[2]) * unitToPx));
        rot.push(Math.abs(parseFloat(m[3])));
      }
      function mx(a) { return a.length ? +Math.max.apply(null, a).toFixed(2) : 0; }
      return { n: dx.length, maxDxPx: mx(dx), maxDyPx: mx(dy), maxRotDeg: mx(rot) };
    }
    var r0 = R(0), r1 = R(0.5), r2 = R(1.0);
    var s0 = stats(r0.html), s1 = stats(r1.html), s2 = stats(r2.html);
    var rel = 40;                                   // 字号
    var bound = { dxPct: +(s1.maxDxPx / rel * 100).toFixed(1), dyPct: +(s1.maxDyPx / rel * 100).toFixed(1) };
    var ok = {
      neatNoJitter: s0.n === 0,
      normalHasJitter: s1.n > 0,
      casualStronger: s2.maxDxPx > s1.maxDxPx,
      withinGlyphBounds: s2.maxDxPx <= rel * 0.10 && s2.maxDyPx <= rel * 0.12,
      sizeStable: Math.abs(r0.w - r2.w) < 0.01 && Math.abs(r0.h - r2.h) < 0.01,
      deterministic: R(0.5).html === r1.html
    };
    out.textContent = "VERIFY:" + JSON.stringify({ ok: ok, neat: s0, normal: s1, casual: s2, pctOfFontSize: bound, allPass: Object.keys(ok).every(function (k) { return ok[k]; }) });
  } catch (e) { out.textContent = "VERR:" + (e && e.stack || e); }
})();
