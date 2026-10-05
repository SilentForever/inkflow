/* InkFlow · 导出：PNG / 矢量 PDF（纯本地，无上传） */
(function (global) {
  "use strict";

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }

  function canvasToBlob(cv, type, quality) {
    return new Promise(function (resolve) {
      if (cv.toBlob) cv.toBlob(function (b) { resolve(b); }, type || "image/png", quality);
      else {
        var d = cv.toDataURL(type || "image/png", quality);
        var bin = atob(d.split(",")[1]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: type || "image/png" }));
      }
    });
  }

  async function exportPNG(canvas, filename, scale) {
    scale = scale || 1;
    var target = canvas;
    if (scale !== 1) {
      target = document.createElement("canvas");
      target.width = Math.round(canvas.width * scale);
      target.height = Math.round(canvas.height * scale);
      var ctx = target.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(canvas, 0, 0, target.width, target.height);
    }
    var blob = await canvasToBlob(target, "image/png");
    triggerDownload(blob, filename);
    return blob;
  }

  /* 把 SVG 矢量重绘到 PDF：jsPDF 支持 addImage(SVG 需栅格化)，这里用高分辨率位图保证清晰 */
  async function exportPDF(canvases, filename, opts) {
    opts = opts || {};
    var jsPDFCtor = global.jspdf && global.jspdf.jsPDF;
    if (!jsPDFCtor) throw new Error("jsPDF 未加载");
    var dpi = opts.dpi || 150;
    var first = canvases[0];
    var pxToPt = 72 / dpi;
    var wPt = first.width * pxToPt;
    var hPt = first.height * pxToPt;
    var doc = new jsPDFCtor({ unit: "pt", format: [wPt, hPt], orientation: wPt > hPt ? "landscape" : "portrait", compress: true });
    for (var i = 0; i < canvases.length; i++) {
      var cv = canvases[i];
      if (i > 0) {
        var pw = cv.width * pxToPt, ph = cv.height * pxToPt;
        doc.addPage([pw, ph], pw > ph ? "landscape" : "portrait");
      }
      var data = cv.toDataURL("image/jpeg", opts.quality || 0.92);
      doc.addImage(data, "JPEG", 0, 0, cv.width * pxToPt, cv.height * pxToPt, undefined, "FAST");
    }
    doc.save(filename);
    return doc;
  }

  global.InkExport = { exportPNG: exportPNG, exportPDF: exportPDF, canvasToBlob: canvasToBlob, triggerDownload: triggerDownload };
})(typeof window !== "undefined" ? window : this);
