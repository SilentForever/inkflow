
(async function(){
  var out = document.getElementById("out");
  try {
    await new Promise(function(res){ var t0=Date.now(); (function p(){ if(window.InkMath&&InkMath.isAvailable())return res(true); if(Date.now()-t0>25000)return res(false); setTimeout(p,100); })(); });
    await window.InkApp.registerFonts(); try{ await document.fonts.ready; }catch(e){}
    var fams = window.InkRender.mathFontsOf({ fontKey: 'mashanzheng' });
    var LATEX = "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}";
    function R(amt){ return window.InkMath.render(LATEX, 40, "#1b2a5e", amt, 12345, { handFonts: fams }); }
    function rot(r){ var s=0; (r.glyphs||[]).forEach(function(g){ s+=Math.abs(g.rot||0); }); return s; }
    var r0=R(0), r1=R(0.5), r2=R(1.0);
    var ok = {
      hasGlyphs: r1.glyphs.length > 0,
      neatNoJitter: rot(r0) === 0,
      normalHasJitter: rot(r1) > 0,
      casualStronger: rot(r2) > rot(r1),
      sizeStable: Math.abs(r0.w-r2.w) < 0.01 && Math.abs(r0.h-r2.h) < 0.01,
      deterministic: JSON.stringify(R(0.5).glyphs) === JSON.stringify(r1.glyphs),
      allHandFonts: r1.glyphs.every(function(g){ return !!g.fam; })
    };
    out.textContent = "VERIFY:" + JSON.stringify({ ok: ok, glyphs: r1.glyphs.length,
      rotSum: [rot(r0), rot(r1), rot(r2)].map(function(v){return +v.toFixed(2);}),
      allPass: Object.keys(ok).every(function(k){ return ok[k]; }) });
  } catch(e){ out.textContent = "VERR:" + (e && e.stack || e); }
})();
