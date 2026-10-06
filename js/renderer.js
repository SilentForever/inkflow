/* InkFlow · 手写渲染内核：排版 + 逐字手写化 + 分页 */
(function (global) {
  "use strict";
  var U = global.InkUtil;

  /* 字体按语言分组，供界面做二级选择：中文 / 英文 */
  /* 字体按语言分组，供界面做二级选择：中文 / 英文。
     中文部分按「数学符号覆盖率」排序（实测 59 个符号）：
       MPLUSRounded1c 55 · ZenKurenaido 52 · PottaOne 46 · ZenMaruGothic 40 · Yomogi 38 · 其余 33–34 */
  var FONTS = {
    /* ---------- 中文手写（含日文手写体，符号覆盖更好） ---------- */
    zenkurenaido: { label: "Zen 圆珠笔手写 ★推荐", css: '"Zen Kurenaido", "KaiTi", cursive', cjk: true, lang: "cjk", family: "Zen Kurenaido" },
    mplusround:   { label: "M PLUS 圆体（符号最全）", css: '"MPLUSRounded1c", "KaiTi", cursive', cjk: true, lang: "cjk", family: "MPLUSRounded1c" },
    pottaone:     { label: "Potta 手绘圆体",   css: '"PottaOne", "KaiTi", cursive',        cjk: true, lang: "cjk", family: "PottaOne" },
    zenmaru:      { label: "Zen 圆体",         css: '"ZenMaruGothic", "KaiTi", cursive',    cjk: true, lang: "cjk", family: "ZenMaruGothic" },
    yomogi:       { label: "Yomogi 随性手写",  css: '"Yomogi", "KaiTi", cursive',           cjk: true, lang: "cjk", family: "Yomogi" },
    mashanzheng:  { label: "马善政 毛笔楷书",  css: '"MaShanZheng", "KaiTi", cursive',      cjk: true, lang: "cjk", family: "MaShanZheng" },
    kleeone:      { label: "Klee One 楷书",    css: '"Klee One", "KaiTi", cursive',         cjk: true, lang: "cjk", family: "Klee One" },
    longcang:     { label: "龙藏 行草",        css: '"LongCang", "KaiTi", cursive',          cjk: true, lang: "cjk", family: "LongCang" },
    zhimangxing:  { label: "志莽行书",         css: '"ZhiMangXing", "KaiTi", cursive',       cjk: true, lang: "cjk", family: "ZhiMangXing" },
    liujianmaocao:{ label: "刘建毛草 狂草",    css: '"LiuJianMaoCao", "KaiTi", cursive',     cjk: true, lang: "cjk", family: "LiuJianMaoCao" },
    kai:          { label: "系统楷体",         css: '"KaiTi", "SimKai", "Ink Free", cursive', cjk: true, lang: "cjk", family: "KaiTi", sys: true },
    /* ---------- 中文：系统自带（无需下载，随系统即时可用） ---------- */
    stxingkai:    { label: "华文行楷（系统）",  css: '"华文行楷", "STXingkai", "KaiTi", cursive', cjk: true, lang: "cjk", family: "华文行楷", sys: true },
    sysink:       { label: "Ink Free 手写（系统）", css: '"Ink Free", "Segoe Print", "KaiTi", cursive', cjk: true, lang: "cjk", family: "Ink Free", sys: true },
    /* ---------- 英文手写 ---------- */
    caveat:       { label: "Caveat 连笔",     css: '"Caveat", "Segoe Script", cursive', cjk: false, lang: "lat", family: "Caveat" },
    patrick:      { label: "Patrick 工整",    css: '"Patrick Hand", cursive',           cjk: false, lang: "lat", family: "Patrick Hand" },
    indie:        { label: "Indie 随记",      css: '"Indie Flower", cursive',           cjk: false, lang: "lat", family: "Indie Flower" },
    kalam:        { label: "Kalam 洒脱",      css: '"Kalam", cursive',                  cjk: false, lang: "lat", family: "Kalam" },
    shadows:      { label: "Shadows 轻柔",    css: '"Shadows Into Light", cursive',     cjk: false, lang: "lat", family: "Shadows Into Light" },
    architects:   { label: "Architects 手绘", css: '"Architects Daughter", cursive',    cjk: false, lang: "lat", family: "Architects Daughter" },
    gloria:       { label: "Gloria 活泼",     css: '"Gloria Hallelujah", cursive',      cjk: false, lang: "lat", family: "Gloria Hallelujah" },
    reenie:       { label: "Reenie 细瘦",     css: '"Reenie Beanie", cursive',          cjk: false, lang: "lat", family: "Reenie Beanie" },
    rocksalt:     { label: "Rock Salt 粗犷",  css: '"Rock Salt", cursive',              cjk: false, lang: "lat", family: "Rock Salt" },
    /* ---------- 英文：系统自带（无需下载，随系统即时可用） ---------- */
    segoescript:  { label: "Segoe Script 手写（系统）", css: '"Segoe Script", cursive', cjk: false, lang: "lat", family: "Segoe Script", sys: true },
    segoeprint:   { label: "Segoe Print 打印（系统）",  css: '"Segoe Print", cursive',  cjk: false, lang: "lat", family: "Segoe Print", sys: true },
    comic:        { label: "Comic 漫画（系统）",        css: '"Comic Sans MS", cursive', cjk: false, lang: "lat", family: "Comic Sans MS", sys: true },
    gabriola:     { label: "Gabriola 花体（系统）",     css: '"Gabriola", cursive',     cjk: false, lang: "lat", family: "Gabriola", sys: true }
  };

  /* 允许在运行时挂载用户自带的字体 */
  function addCustomFont(key, familyName, label) {
    if (!key || !familyName) return;
    _visCache = {};
    FONTS[key] = { label: label || familyName, css: '"' + familyName + '", cursive', cjk: true, custom: true };
  }
  var MONO = '"Consolas", "Courier New", monospace';

  var PAGE_SIZES = {
    a4:     { w: 1240, h: 1754, label: "A4 竖版" },
    a4l:    { w: 1754, h: 1240, label: "A4 横版" },
    letter: { w: 1275, h: 1650, label: "Letter" },
    square: { w: 1400, h: 1400, label: "方形" }
  };

  /* 行内公式高度超过该倍数（相对字号）时，单独成行以避免挤压正文 */
  var INLINE_MATH_TALL = 99;   // 行内公式不再单独抽行（真正的裁切问题已在 mathrender 修复）

  var _mc = null;
  function measurer() { if (!_mc) _mc = document.createElement("canvas"); return _mc.getContext("2d"); }
  function fontStr(px, cssFont) { return px + "px " + cssFont; }
  function measureText(text, px, cssFont) { var c = measurer(); c.font = fontStr(px, cssFont); return c.measureText(text).width; }
  /* 用「完整字体串」测量（已含 字号/样式），避免重复拼接前缀 */
  function measureStyled(text, fullFont) { var c = measurer(); c.font = fullFont; return c.measureText(text).width; }

  function fontCssOf(key) { return (FONTS[key] || FONTS.caveat).css; }

  /* 中英文分别选字体：按字符判断该用哪个字体栈 */
  function fontCssForChar(ch, s) {
    var cjk = U.isCJK(ch);
    var key = cjk ? (s.fontKeyCJK || s.fontKey) : (s.fontKeyLat || s.fontKey);
    var f = FONTS[key];
    if (!f) f = FONTS[cjk ? 'zenkurenaido' : 'caveat'];
    return { css: f.css, cjk: cjk, key: key };
  }

  /* 像 Word 一样：可加粗 / 斜体。返回带样式前缀的 font 简写片段。 */
  function fontStylePrefix(s) {
    var pre = "";
    if (s && s.italic) pre += "italic ";
    if (s && s.bold) pre += "700 ";
    return pre;
  }
  /* 供 canvas 使用的完整字体串（含样式前缀） */
  function styledFont(px, css, s) { return fontStylePrefix(s) + px + "px " + css; }
  /* 文本颜色：默认墨色，可单独指定字色 */
  function textColorOf(s) { return (s && s.textColor) || s.inkColor; }

  /* ---------- 公式视觉尺寸自适应 ----------
   * 不同字体的"视觉大小"差异很大（Caveat 的 x-height 只有 0.36em，
   * Rock Salt 却高达 0.79em），若公式用统一字号，就会出现公式比正文
   * 明显偏小或偏大的问题。这里按字体实测的视觉比例缩放公式字号。 */
  var _visCache = {};
  function visualRatioOf(key) {
    if (_visCache[key] != null) return _visCache[key];
    var f = FONTS[key] || FONTS.caveat;
    var ratio = 0;
    try {
      var c = measurer();
      c.font = "100px " + f.css;
      var cjk = c.measureText("\u6c49").actualBoundingBoxAscent || 0;
      var lat = c.measureText("x").actualBoundingBoxAscent || 0;
      if (f.cjk) ratio = cjk / 100;
      else ratio = (lat / 100) * 1.45;
      if (!(ratio > 0.05) && cjk > 0) ratio = cjk / 100;
    } catch (e) { ratio = 0; }
    /* 量不到（字体尚未就绪）时给出估算值，但**不写入缓存**，等字体就绪后再量 */
    if (!(ratio > 0.05)) return 0.62;
    _visCache[key] = ratio;
    return ratio;
  }

  /* 公式字号相对正文字号的倍数 */
  function formulaScaleOf(key) {
    var ratio = visualRatioOf(key);
    var s = ratio / 0.62;
    return U.clamp(s, 0.82, 1.5);
  }

  /* ---------- 手写风格档位 ----------
   * 界面只暴露 3 档，避免用户面对十几个滑杆。
   * 档位同时决定「整字抖动」与「公式手写化」的强度。 */
  var HAND_PRESETS = {
    neat:   { label: "工整", jitter: 0.35, rotateDeg: 0.18, sizeVary: 0.008, baselineDrift: 0.22, formulaHand: 0.18 },
    normal: { label: "自然", jitter: 1.10, rotateDeg: 0.55, sizeVary: 0.020, baselineDrift: 0.70, formulaHand: 0.50 },
    casual: { label: "随性", jitter: 1.90, rotateDeg: 1.00, sizeVary: 0.038, baselineDrift: 1.30, formulaHand: 0.85 }
  };
  function handOf(level) {
    var p = HAND_PRESETS[level] || HAND_PRESETS.normal;
    return p;
  }

  /* ---------- 公式字形字体链 ----------
   * 公式里的数字与符号也要写成手写体。顺序：
   *   1) 当前正文字体  2) Zen Kurenaido（圆珠笔手写，符号覆盖好，专职兜底）  3) 其余中文手写体
   * 都不含该字符时，mathrender 会保留 MathJax 原字形（内容绝不丢失）。 */
  var MATH_FALLBACK = ["MPLUSRounded1c", "Zen Kurenaido", "PottaOne", "ZenMaruGothic", "Yomogi", "Klee One", "MaShanZheng", "LongCang", "ZhiMangXing", "LiuJianMaoCao"];
  function mathFontsOf(s) {
    var cur = (FONTS[s.fontKeyCJK || s.fontKey] || {}).family;
    var list = [];
    if (cur) list.push(cur);
    for (var i = 0; i < MATH_FALLBACK.length; i++) if (MATH_FALLBACK[i] !== cur) list.push(MATH_FALLBACK[i]);
    return list;
  }

  /* 公式手写化强度：由档位决定，可被高级设置覆盖 */
  function formulaHandOf(s) {
    if (typeof s.formulaHand === "number") return s.formulaHand;
    return handOf(s.hand).formulaHand;
  }
  /* 公式随机种子：同一公式 + 同一种子 → 完全一致 */
  function mathSeedOf(latex, s) {
    return (U.hashString(String(latex || "")) ^ (s.seed >>> 0)) >>> 0;
  }

  /* ---------- 行内片段 → token ---------- */
  function inlineTokens(text, px, fontKey, settings) {
    var fcBase = fontCssOf(fontKey);
    var fc = styledFont(px, fcBase, settings);   // 含 加粗/斜体 前缀
    var tc = textColorOf(settings);
    var segs = global.InkParser.segment(text);
    var tokens = [];
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (seg.kind === "text") {
        var units = U.splitUnits(seg.value);
        for (var j = 0; j < units.length; j++) {
          var u = units[j];
          /* 逐单元选字体：CJK 用中文字体，拉丁用英文字体 */
          var fs2 = fontCssForChar(u.t, settings);
          var font = styledFont(px, fs2.css, settings);
          var w = measureStyled(u.t, font) + (u.space ? 0 : settings.letterSpacing);
          tokens.push({ kind: u.space ? "space" : "text", text: u.t, w: w, h: px, size: px, font: font, color: tc, cjk: fs2.cjk });
        }
      } else {
        var fpx = settings.formulaPx || px;
        var fhand = formulaHandOf(settings), fseed = mathSeedOf(seg.value, settings);
        var m = global.InkMath.render(seg.value, fpx, settings.inkColor, fhand, fseed, { handFonts: mathFontsOf(settings) });
        /* 行内公式过宽时等比缩小，避免撑出页面 */
        if (m) {
          var availW = (settings.pageWidth || 1240) - (settings.marginLeft || 0) - (settings.marginRight || 0);
          if (availW > 0 && m.w > availW) {
            var scFit = availW / m.w;
            var m2 = global.InkMath.render(seg.value, fpx * scFit, settings.inkColor, fhand, fseed, { handFonts: mathFontsOf(settings) });
            if (m2 && m2.w < m.w) { m = m2; fpx = fpx * scFit; }
          }
        }
        if (m) {
          var tall = m.h > px * INLINE_MATH_TALL;
          tokens.push({ kind: "math", latex: seg.value, w: m.w, h: m.h, depth: m.depth,
            glyphs: m.glyphs, lines: m.lines, fallbackSvg: m.fallbackSvg,
            size: fpx, font: fc, tall: tall });
        } else {
          var t2 = "$" + seg.value + "$";
          tokens.push({ kind: "text", text: t2, w: measureStyled(t2, fc), h: px, size: px, font: fc, color: tc, degraded: true });
        }
      }
    }
    return tokens;
  }

  /* ---------- 块 → 视觉行 ---------- */
  function layoutBlocks(blocks, s) {
    var maxW = s.pageWidth - s.marginLeft - s.marginRight;
    var lines = [];

    function pushLine(tokens, kind, size, align, indent) {
      lines.push({ tokens: tokens, kind: kind, size: size, align: align || "left", indent: indent || 0 });
    }

    /* 中文避头尾：这些符号不能出现在行首 / 行尾 */
    function canStartLine(tk) {
      if (tk.kind !== "text" || !tk.text) return true;
      return "\u3002\uff0c\u3001\uff1b\uff1a\uff1f\uff01\uff09\u3011\u300b\u300d\u300f\u201d\u2026\u2014\u00b7%\u2030\u2103".indexOf(tk.text) < 0;
    }
    function canEndLine(tk) {
      if (tk.kind !== "text" || !tk.text) return true;
      return "\uff08\u3010\u300a\u300c\u300e\u201c".indexOf(tk.text) < 0;
    }

    /* 把 token 流换行；过高的行内公式自动独占一行 */
    function flow(tokens, kind, size) {
      var cur = [], curW = 0, indent = 0;
      var limit = maxW;
      for (var k = 0; k < tokens.length; k++) {
        var tk = tokens[k];
        if (tk.tall) {
          if (cur.length) { pushLine(cur, kind, size, "left", indent); cur = []; curW = 0; }
          pushLine([tk], "mathblock", size, "center", 0);
          continue;
        }
        if (tk.kind === "space" && cur.length === 0) continue;

        var needBreak = (curW + tk.w > limit && cur.length > 0);
        if (needBreak) {
          // 避头：下一个字不能在行首 → 允许本行悬挂溢出（悬挂标点）
          if (!canStartLine(tk)) { cur.push(tk); curW += tk.w; continue; }
          // 避尾：本行最后一个字不能在行尾 → 把它一起挪到下一行
          var carry = null;
          if (cur.length > 1 && !canEndLine(cur[cur.length - 1])) {
            carry = cur.pop();
            curW -= carry.w;
          }
          pushLine(cur, kind, size, "left", indent);
          cur = []; curW = 0;
          if (carry) { cur.push(carry); curW += carry.w; }
          if (tk.kind === "space") continue;
        }
        cur.push(tk); curW += tk.w;
      }
      if (cur.length) pushLine(cur, kind, size, "left", indent);
      else if (!tokens.length) pushLine([], kind, size, "left", 0);
    }

    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.type === "blank") { pushLine([], "blank", s.fontSize, "left", 0); continue; }
      if (b.type === "hr") { pushLine([], "hr", s.fontSize, "left", 0); continue; }

      if (b.type === "heading") {
        var hs = s.fontSize * (b.level <= 1 ? 1.7 : b.level === 2 ? 1.42 : 1.2);
        flow(inlineTokens(b.text, hs, s.fontKey, s), "heading", hs);
        pushLine([], "gap", s.fontSize * 0.4, "left", 0);
        continue;
      }
      if (b.type === "para") { flow(inlineTokens(b.text, s.fontSize, s.fontKey, s), "para", s.fontSize); continue; }
      if (b.type === "bullet") {
        flow(inlineTokens("\u2022  " + b.text, s.fontSize, s.fontKey, s), "para", s.fontSize);
        continue;
      }
      if (b.type === "ordered") {
        flow(inlineTokens(b.num + ".  " + b.text, s.fontSize, s.fontKey, s), "para", s.fontSize);
        continue;
      }
      if (b.type === "code") {
        var cl = String(b.text).split("\n");
        var cs = s.fontSize * 0.82;
        for (var c = 0; c < cl.length; c++) {
          var ct = cl[c] || " ";
          var cfont = styledFont(cs, MONO, s);
          pushLine([{ kind: "code", text: ct, w: measureStyled(ct, cfont), h: cs, size: cs, font: cfont, color: textColorOf(s) }], "code", cs, "left", 14);
        }
        continue;
      }
      if (b.type === "mathblock") {
        var ms = (s.formulaPx || s.fontSize) * 1.25;
        var dhand = formulaHandOf(s), dseed = mathSeedOf(b.latex, s);
        var mm = global.InkMath.render(b.latex, ms, s.inkColor, dhand, dseed, { handFonts: mathFontsOf(s) });
        /* 独立公式过宽时等比缩小，保证不出血 */
        if (mm && maxW > 0 && mm.w > maxW) {
          var scB = maxW / mm.w;
          var mmS = global.InkMath.render(b.latex, ms * scB, s.inkColor, dhand, dseed, { handFonts: mathFontsOf(s) });
          if (mmS && mmS.w < mm.w) { mm = mmS; ms = ms * scB; }
        }
        if (mm) {
          pushLine([{ kind: "math", latex: b.latex, w: mm.w, h: mm.h, depth: mm.depth,
            glyphs: mm.glyphs, lines: mm.lines, fallbackSvg: mm.fallbackSvg,
            size: ms, font: fontCssOf(s.fontKey) }], "mathblock", ms, "center", 0);
        } else {
          var raw = "$$" + b.latex + "$$";
          pushLine([{ kind: "text", text: raw, w: measureText(raw, s.fontSize, fontCssOf(s.fontKey)), h: s.fontSize, size: s.fontSize, font: fontCssOf(s.fontKey), degraded: true }], "para", s.fontSize, "left", 0);
        }
        continue;
      }
    }
    return lines;
  }

  /* ---------- 行高与基线（ascent/descent 模型） ---------- */
  /* 文本按字形上下伸展量估算；公式用其精确高度与基线深度 */
  function ascentOf(tk) {
    if (tk.kind === "math") return Math.max(0, tk.h - tk.depth);
    return tk.size * 0.80;
  }
  function descentOf(tk) {
    if (tk.kind === "math") return Math.max(0, tk.depth);
    return tk.size * 0.26;
  }
  function metricsOf(ln, s) {
    var asc = s.fontSize * 0.80, desc = s.fontSize * 0.26;
    for (var t = 0; t < ln.tokens.length; t++) {
      var a = ascentOf(ln.tokens[t]), d = descentOf(ln.tokens[t]);
      if (a > asc) asc = a;
      if (d > desc) desc = d;
    }
    return { asc: asc, desc: desc };
  }

  function lineHeightFor(ln, s) {
    if (ln.kind === "blank") return s.lineHeightPx * 0.5;
    if (ln.kind === "gap") return s.lineHeightPx * 0.3;
    if (ln.kind === "hr") return s.lineHeightPx * 0.8;
    if (ln.kind === "code") return s.lineHeightPx * 0.92;
    var m = metricsOf(ln, s);
    var needed = m.asc + m.desc + s.fontSize * 0.12;
    var base = s.lineHeightPx;
    if (ln.kind === "heading") base = Math.max(base, ln.size * 1.5);
    if (ln.kind === "mathblock") base = Math.max(base, m.asc + m.desc + s.fontSize * 0.6);
    return Math.max(base, needed);
  }

  /* ---------- 分页 ---------- */
  function paginate(lines, s) {
    var usable = s.pageHeight - s.marginTop - s.marginBottom;
    var pages = [], cur = [], y = 0;
    for (var i = 0; i < lines.length; i++) {
      var lh = lineHeightFor(lines[i], s);
      if (y + lh > usable && cur.length > 0) { pages.push(cur); cur = []; y = 0; }
      cur.push(lines[i]); y += lh;
    }
    pages.push(cur);
    return pages;
  }

  /* ---------- 公式预处理：SVG → Image → 潦草化 ---------- */
  function collectMath(lines) {
    var map = new Map();
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].tokens;
      for (var j = 0; j < t.length; j++) {
        var tk = t[j];
        if (tk.kind === "math") map.set(tk, { tok: tk, img: null });
      }
    }
    return map;
  }

  async function prepareMath(map, s) {
    var jobs = [];
    map.forEach(function (rec) {
      /* 只有「无法手写化」的字符才需要一张回退图片 */
      if (!rec.tok.fallbackSvg) return;
      jobs.push((async function () {
        rec.img = await global.InkMath.loadImage(rec.tok.fallbackSvg);
      })());
    });
    if (jobs.length) await Promise.all(jobs);
  }

  /* ---------- 主渲染 ---------- */
  async function render(blocks, s, opts) {
    opts = opts || {};
    var now = function () { return (global.performance || Date).now(); };
    var t0 = now();

    s = Object.assign({}, s);
    /* 手写档位 → 具体抖动参数（高级设置里显式改过则以显式值为准） */
    if (s.hand && !s.handCustom) {
      var hp = handOf(s.hand);
      s.jitter = hp.jitter; s.rotateDeg = hp.rotateDeg;
      s.sizeVary = hp.sizeVary; s.baselineDrift = hp.baselineDrift;
    }
    var ps = PAGE_SIZES[s.pageSize] || PAGE_SIZES.a4;
    s.pageWidth = ps.w; s.pageHeight = ps.h;
    /* 文字缩放（像 Word 的字号）只影响正文，不影响页面尺寸 */
    s.fontSize = Math.max(8, Math.round(s.fontSize * (s.textScale || 1)));
    s.lineHeightPx = s.fontSize * s.lineHeight;
    var fscale = formulaScaleOf(s.fontKeyCJK || s.fontKey) * (s.formulaScale || 1);
    s.formulaPx = s.fontSize * fscale;

    var lines = layoutBlocks(blocks, s);
    var tLayout = now();

    var mathMap = collectMath(lines);
    await prepareMath(mathMap, s);
    var tMath = now();

    var pages = paginate(lines, s);
    var canvases = [];

    for (var p = 0; p < pages.length; p++) {
      var cv = document.createElement("canvas");
      cv.width = s.pageWidth; cv.height = s.pageHeight;
      var ctx = cv.getContext("2d");
      ctx.textBaseline = "alphabetic";

      var paper = global.InkPaper.byId(s.paper);
      global.InkPaper.draw(ctx, paper, {
        width: s.pageWidth, height: s.pageHeight, top: s.marginTop, bottom: s.marginBottom,
        left: s.marginLeft, right: s.marginRight, lineH: s.lineHeightPx
      });

      var rnd = new U.Rand(s.seed, "page" + p + "|" + s.seed);
      var y = s.marginTop;
      var drift = 0;

      for (var li = 0; li < pages[p].length; li++) {
        var ln = pages[p][li];
        var lh = lineHeightFor(ln, s);

        if (ln.kind === "hr") {
          ctx.save();
          ctx.strokeStyle = textColorOf(s);
          ctx.globalAlpha = U.clamp(s.inkAmount * 0.7, 0.1, 1);
          ctx.lineWidth = Math.max(1, s.fontSize / 24);
          var hy = Math.round(y + lh * 0.5);
          ctx.beginPath();
          ctx.moveTo(s.marginLeft, hy);
          ctx.bezierCurveTo(s.pageWidth * 0.35, hy + rnd.jitter(1.6), s.pageWidth * 0.65, hy - rnd.jitter(1.6), s.pageWidth - s.marginRight, hy);
          ctx.stroke();
          ctx.restore();
          y += lh; continue;
        }
        if (!ln.tokens.length) { y += lh; continue; }

        /* 基线：行盒底部减去下伸量 → 文字正好坐在横线上；再叠加基线漂移 */
        var lm = metricsOf(ln, s);
        var baseline = y + lh - lm.desc;

        drift += rnd.jitter(s.baselineDrift);
        drift = U.clamp(drift, -s.baselineDrift * 3, s.baselineDrift * 3);
        baseline += drift;

        var totalW = 0;
        for (var w1 = 0; w1 < ln.tokens.length; w1++) totalW += ln.tokens[w1].w;
        var x = s.marginLeft + (ln.indent || 0);
        if (ln.align === "center") x = s.marginLeft + Math.max(0, ((s.pageWidth - s.marginLeft - s.marginRight) - totalW) / 2);

        for (var k = 0; k < ln.tokens.length; k++) {
          var tk = ln.tokens[k];
          if (tk.kind === "space") { x += tk.w; continue; }

          var dx = rnd.jitter(s.jitter);
          var dy = rnd.jitter(s.jitter * 0.55);
          var rot = rnd.jitter(s.rotateDeg) * Math.PI / 180;
          var sc = 1 + rnd.jitter(s.sizeVary);
          var alpha = U.clamp(s.inkAmount * (1 + rnd.jitter(s.inkVary)), 0.05, 1);

          ctx.save();
          ctx.globalAlpha = alpha;
          var cx = x + tk.w / 2;
          ctx.translate(cx + dx, baseline + dy);
          ctx.rotate(rot);
          ctx.scale(sc, sc);

          if (tk.kind === "math") {
            drawMath(ctx, tk, mathMap, -tk.w / 2, -(tk.h - tk.depth), textColorOf(s));
          } else {
            ctx.font = tk.font || styledFont(tk.size, fontCssOf(s.fontKey), s);
            ctx.fillStyle = tk.color || textColorOf(s);
            ctx.textAlign = "left";
            ctx.fillText(tk.text, -tk.w / 2, 0);
            /* 下划线：像 Word 一样 */
            if (s.underline) {
              var uw = tk.w - (s.letterSpacing || 0);
              var uy = Math.round(tk.size * 0.16);
              ctx.save();
              ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.85;
              ctx.strokeStyle = tk.color || textColorOf(s);
              ctx.lineWidth = Math.max(1, tk.size / 22);
              ctx.beginPath();
              ctx.moveTo(-uw / 2 + rnd.jitter(0.4), uy);
              ctx.lineTo(uw / 2 + rnd.jitter(0.4), uy + rnd.jitter(0.5));
              ctx.stroke();
              ctx.restore();
            }
          }
          ctx.restore();
          x += tk.w;
        }
        y += lh;
      }

      drawFurniture(ctx, s, p, pages.length, rnd);
      canvases.push(cv);
    }

    var tEnd = now();
    return {
      canvases: canvases, lines: lines, pageCount: canvases.length,
      stats: {
        layoutMs: Math.round(tLayout - t0),
        mathMs: Math.round(tMath - tLayout),
        totalMs: Math.round(tEnd - t0),
        lineCount: lines.length, mathCount: mathMap.size, pages: canvases.length
      }
    };
  }

  /* ---------- 公式绘制 ----------
   * 字形用 canvas 画（canvas 能正常使用 Web 字体），
   * 少数无法手写化的字符叠一张 MathJax 原字形图片。 */
  function drawMath(ctx, tk, mathMap, ox, oy, color) {
    var rec = mathMap ? mathMap.get(tk) : null;
    var alpha0 = ctx.globalAlpha;
    if (!color) color = ctx.fillStyle;   // 兜底：调用方未指定时才继承

    /* 1) 回退字形（保持原样） */
    if (tk.fallbackSvg && rec && rec.img) {
      ctx.drawImage(rec.img, ox, oy, tk.w, tk.h);
    }

    /* 2) 手绘字形 */
    var gs = tk.glyphs || [];
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      ctx.save();
      ctx.translate(ox + g.cx, oy + g.baseY);
      if (g.rot) ctx.rotate(g.rot * Math.PI / 180);
      ctx.font = g.size + 'px "' + g.fam + '", cursive';
      ctx.fillText(g.ch, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    /* 3) 分数线 / 根号线：手画的曲线 */
    var ls = tk.lines || [];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    for (var k = 0; k < ls.length; k++) {
      var ln = ls[k];
      ctx.lineWidth = Math.max(1, ln.w);
      ctx.beginPath();
      if (ln.type === "bezier" && ln.bend) {
        ctx.moveTo(ox + ln.x0, oy + ln.y0);
        ctx.bezierCurveTo(ox + ln.x0 + (ln.x1 - ln.x0) * 0.34, oy + ln.y0 + ln.bend,
                          ox + ln.x0 + (ln.x1 - ln.x0) * 0.67, oy + ln.y0 - ln.bend,
                          ox + ln.x1, oy + ln.y0);
      } else {
        ctx.moveTo(ox + ln.x0, oy + ln.y0);
        ctx.lineTo(ox + ln.x1, oy + ln.y0);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = alpha0;
    ctx.fillStyle = color;
  }

  function drawFurniture(ctx, s, pageIdx, total, rnd) {
    if (!s.showHeader && !s.showFooter) return;
    ctx.save();
    ctx.globalAlpha = U.clamp(s.inkAmount * 0.8, 0.1, 1);
    ctx.fillStyle = textColorOf(s);
    var fs = Math.max(11, s.fontSize * 0.42);
    ctx.font = styledFont(fs, fontCssOf(s.fontKeyCJK || s.fontKey), s);
    ctx.textBaseline = "alphabetic";
    if (s.showHeader && s.headerText) {
      ctx.textAlign = "left";
      ctx.fillText(s.headerText, s.marginLeft + rnd.jitter(0.6), s.marginTop - fs * 0.95);
      if (s.showDate && s.dateText) {
        ctx.textAlign = "right";
        ctx.fillText(s.dateText, s.pageWidth - s.marginRight, s.marginTop - fs * 0.95);
      }
    }
    if (s.showFooter) {
      ctx.textAlign = "center";
      var label = String(pageIdx + 1);
      if (s.showTotalPages) label += " / " + total;
      ctx.fillText(label, s.pageWidth / 2 + rnd.jitter(1.2), s.pageHeight - s.marginBottom * 0.42);
    }
    ctx.restore();
  }

  global.InkRender = {
    render: render, FONTS: FONTS, MONO: MONO, PAGE_SIZES: PAGE_SIZES,
    layoutBlocks: layoutBlocks, paginate: paginate, lineHeightFor: lineHeightFor,
    measureText: measureText, fontStr: fontStr, fontCssOf: fontCssOf, addCustomFont: addCustomFont,
    visualRatioOf: visualRatioOf, formulaScaleOf: formulaScaleOf,
    handOf: handOf, HAND_PRESETS: HAND_PRESETS, mathFontsOf: mathFontsOf, fontsByLang: function (lang) {
      var out = [];
      for (var k in FONTS) if (!FONTS[k].custom && FONTS[k].lang === lang) out.push({ key: k, label: FONTS[k].label });
      return out;
    }
  };
})(typeof window !== "undefined" ? window : this);
