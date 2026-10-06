/* InkFlow · 文档解析器：Markdown 子集 + LaTeX 公式识别 */
(function (global) {
  "use strict";

  var RE_HEADING = /^(#{1,6})\s+(.*)$/;
  var RE_HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
  var RE_BULLET = /^\s*[-*+]\s+(.*)$/;
  var RE_ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
  var RE_FENCE = /^\s*(```|~~~)\s*([A-Za-z0-9_+-]*)\s*$/;
  var RE_BLOCKMATH_OPEN = /^\s*\$\$\s*(.*)$/;
  /* 字号标记：导入器在块首行写入 \u0001F<百分比>\u0001，解析器剥离后挂到块上。
     百分比 = 该块字号 / 文档正文字号 × 100，用于「按原文大小转写」（标题更大、脚注更小）。 */
  var SZ_RE = /^\u0001F(\d+)\u0001/;
  function szMark(pct) { return "\u0001F" + Math.round(pct) + "\u0001"; }

  /* 解析为块列表 */
  function parse(src) {
    var text = String(src == null ? "" : src).replace(/\r\n?/g, "\n");
    var lines = text.split("\n");
    var blocks = [];
    var i = 0;
    var inCode = false, codeFence = "", codeLang = "", codeBuf = [], codePx = 0;
    var inMath = false, mathBuf = [], mathPx = 0;

    while (i < lines.length) {
      var line = lines[i];
      var m;

      if (inCode) {
        if (line.trim() === codeFence) {
          blocks.push({ type: "code", lang: codeLang, text: codeBuf.join("\n"), px: codePx });
          inCode = false; codeBuf = []; codeLang = ""; codePx = 0;
        } else { codeBuf.push(line); }
        i++; continue;
      }

      if (inMath) {
        var closeIdx = line.indexOf("$$");
        if (closeIdx >= 0) {
          var head = line.slice(0, closeIdx);
          if (head.trim()) mathBuf.push(head);
          blocks.push({ type: "mathblock", latex: mathBuf.join("\n").trim(), px: mathPx });
          inMath = false; mathBuf = []; mathPx = 0;
          var rest = line.slice(closeIdx + 2);
          if (rest.trim()) { lines[i] = rest; continue; }
        } else { mathBuf.push(line); }
        i++; continue;
      }

      /* 剥离块首的字号标记 */
      var px = 0;
      var szm = line.match(SZ_RE);
      if (szm) { px = parseInt(szm[1], 10); line = line.slice(szm[0].length); }

      m = line.match(RE_FENCE);
      if (m) { inCode = true; codeFence = m[1]; codeLang = m[2] || ""; codePx = px; i++; continue; }

      var bm = line.match(RE_BLOCKMATH_OPEN);
      if (bm) {
        var same = bm[1];
        var endIdx = same.indexOf("$$");
        if (endIdx >= 0) {
          blocks.push({ type: "mathblock", latex: same.slice(0, endIdx).trim(), px: px });
          var tail = same.slice(endIdx + 2);
          if (tail.trim()) { lines[i] = tail; continue; }
        } else {
          inMath = true; mathPx = px;
          if (same.trim()) mathBuf.push(same);
        }
        i++; continue;
      }

      if (line.trim() === "") { blocks.push({ type: "blank" }); i++; continue; }
      m = line.match(RE_HEADING);
      if (m) { blocks.push({ type: "heading", level: m[1].length, text: m[2].trim(), px: px }); i++; continue; }
      if (RE_HR.test(line)) { blocks.push({ type: "hr", px: px }); i++; continue; }
      m = line.match(RE_BULLET);
      if (m) { blocks.push({ type: "bullet", text: m[1], px: px }); i++; continue; }
      m = line.match(RE_ORDERED);
      if (m) { blocks.push({ type: "ordered", num: m[1], text: m[2], px: px }); i++; continue; }
      blocks.push({ type: "para", text: line, px: px });
      i++;
    }
    if (inCode && codeBuf.length) blocks.push({ type: "code", lang: codeLang, text: codeBuf.join("\n"), px: codePx });
    if (inMath && mathBuf.length) blocks.push({ type: "mathblock", latex: mathBuf.join("\n").trim(), px: mathPx });
    return blocks;
  }

  /* 把一行文本切成 文本/公式 片段。支持 $...$、\(...\)、\[...\] */
  function segment(text) {
    var out = [];
    var s = String(text == null ? "" : text);
    var i = 0, buf = "";
    function flush() { if (buf) { out.push({ kind: "text", value: buf }); buf = ""; } }

    while (i < s.length) {
      var ch = s[i];
      if (ch === "\\" && i + 1 < s.length && (s[i + 1] === "(" || s[i + 1] === "[")) {
        var open = s[i + 1], close = open === "(" ? "\\)" : "\\]";
        var end = s.indexOf(close, i + 2);
        if (end > 0) { flush(); out.push({ kind: "math", value: s.slice(i + 2, end).trim() }); i = end + 2; continue; }
      }
      if (ch === "$") {
        if (s[i + 1] === "$") {
          var e2 = s.indexOf("$$", i + 2);
          if (e2 > 0) { flush(); out.push({ kind: "math", value: s.slice(i + 2, e2).trim() }); i = e2 + 2; continue; }
        } else {
          var e1 = s.indexOf("$", i + 1);
          if (e1 > 0) {
            var inner = s.slice(i + 1, e1);
            if (inner.trim() && inner.indexOf("\n") < 0) {
              flush(); out.push({ kind: "math", value: inner.trim() }); i = e1 + 1; continue;
            }
          }
        }
      }
      buf += ch; i++;
    }
    flush();
    return out;
  }

  global.InkParser = { parse: parse, segment: segment, szMark: szMark };
})(typeof window !== "undefined" ? window : this);
