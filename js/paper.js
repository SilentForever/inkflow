/* InkFlow · 纸张底纹绘制 */
(function (global) {
  "use strict";

  var PAPERS = [
    { id: "plain",  name: "白纸",   bg: "#ffffff", line: null },
    { id: "ruled",  name: "横线纸", bg: "#fffdf8", line: "#c9d6e4", mode: "ruled" },
    { id: "grid",   name: "方格纸", bg: "#fffdf8", line: "#cfd8e3", mode: "grid" },
    { id: "mi",     name: "米字格", bg: "#fffdf8", line: "#e0b7b7", mode: "mi" },
    { id: "kraft",  name: "牛皮纸", bg: "#e8d7bb", line: "#c9b28c", mode: "ruled" },
    { id: "letter", name: "信纸",   bg: "#fdfbf4", line: "#b9cfe0", mode: "letter" }
  ];

  function byId(id) { for (var i = 0; i < PAPERS.length; i++) if (PAPERS[i].id === id) return PAPERS[i]; return PAPERS[0]; }

  /* 底纹：以「行」为单位绘制，保证与手写基线对齐 */
  function draw(ctx, paper, opt) {
    var W = opt.width, H = opt.height, top = opt.top, lineH = opt.lineH, left = opt.left, right = opt.right;
    ctx.save();
    ctx.fillStyle = paper.bg;
    ctx.fillRect(0, 0, W, H);

    if (paper.mode === "ruled" || paper.mode === "letter") {
      ctx.strokeStyle = paper.line;
      ctx.lineWidth = 1;
      var y = top + lineH;
      while (y < H - opt.bottom + lineH) {
        ctx.beginPath();
        ctx.moveTo(left, Math.round(y) + 0.5);
        ctx.lineTo(W - right, Math.round(y) + 0.5);
        ctx.stroke();
        y += lineH;
      }
    } else if (paper.mode === "grid") {
      ctx.strokeStyle = paper.line;
      ctx.lineWidth = 1;
      var step = lineH;
      for (var gx = left; gx <= W - right + 0.5; gx += step) {
        ctx.beginPath(); ctx.moveTo(Math.round(gx) + 0.5, top); ctx.lineTo(Math.round(gx) + 0.5, H - opt.bottom); ctx.stroke();
      }
      for (var gy = top; gy <= H - opt.bottom + 0.5; gy += step) {
        ctx.beginPath(); ctx.moveTo(left, Math.round(gy) + 0.5); ctx.lineTo(W - right, Math.round(gy) + 0.5); ctx.stroke();
      }
    } else if (paper.mode === "mi") {
      var cell = lineH;
      ctx.strokeStyle = paper.line;
      ctx.lineWidth = 1;
      for (var cx = left; cx + cell <= W - right + 0.5; cx += cell) {
        for (var cy = top; cy + cell <= H - opt.bottom + 0.5; cy += cell) {
          ctx.strokeRect(Math.round(cx) + 0.5, Math.round(cy) + 0.5, cell, cell);
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.moveTo(cx, cy); ctx.lineTo(cx + cell, cy + cell);
          ctx.moveTo(cx + cell, cy); ctx.lineTo(cx, cy + cell);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    if (paper.id === "letter") {
      ctx.strokeStyle = "#d98c8c";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left - 10, top); ctx.lineTo(left - 10, H - opt.bottom);
      ctx.stroke();
    }

    // 牛皮纸颗粒质感
    if (paper.id === "kraft") {
      var rnd = global.InkUtil.mulberry32(20240517);
      ctx.globalAlpha = 0.05;
      for (var k = 0; k < Math.floor(W * H / 900); k++) {
        ctx.fillStyle = rnd() > 0.5 ? "#8a6f45" : "#fff6e0";
        ctx.fillRect(rnd() * W, rnd() * H, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  global.InkPaper = { PAPERS: PAPERS, byId: byId, draw: draw };
})(typeof window !== "undefined" ? window : this);
