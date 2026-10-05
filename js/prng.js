/* InkFlow · 种子随机与通用工具（经典脚本，无模块） */
(function (global) {
  "use strict";

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* 有界随机：以 seed 为基础，按 index 生成稳定伪随机数，保证可复现 */
  function Rand(seed, salt) {
    this.base = (hashString(String(salt == null ? "" : salt)) ^ (seed >>> 0)) >>> 0;
    this.n = 0;
  }
  Rand.prototype.next = function () {
    this.n += 1;
    return mulberry32((this.base + this.n * 0x9E3779B1) >>> 0)();
  };
  /* 对称抖动：返回 [-amp, amp] */
  Rand.prototype.jitter = function (amp) {
    return (this.next() * 2 - 1) * amp;
  };
  Rand.prototype.range = function (a, b) {
    return a + this.next() * (b - a);
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function round2(v) { return Math.round(v * 100) / 100; }

  /* 判断是否 CJK / 全角字符 */
  function isCJK(ch) {
    var c = ch.codePointAt(0);
    return (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff) ||
           (c >= 0xff00 && c <= 0xffef) || (c >= 0x3000 && c <= 0x303f);
  }

  /* 把一行文本切成排版单元：CJK/空格逐字，拉丁词整体（保留连笔） */
  function splitUnits(text) {
    var units = [];
    var buf = "";
    var chars = Array.from(text);
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch === " " || ch === "\t" || isCJK(ch)) {
        if (buf) { units.push({ t: buf, space: false }); buf = ""; }
        units.push({ t: ch === "\t" ? "    " : ch, space: ch === " " || ch === "\t" });
      } else {
        buf += ch;
      }
    }
    if (buf) units.push({ t: buf, space: false });
    return units;
  }

  global.InkUtil = {
    mulberry32: mulberry32,
    hashString: hashString,
    Rand: Rand,
    clamp: clamp,
    round2: round2,
    isCJK: isCJK,
    splitUnits: splitUnits
  };
})(typeof window !== "undefined" ? window : this);
