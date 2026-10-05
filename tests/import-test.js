var DOCX_B64="UEsDBBQAAAAAAAAAIQDJTxqwrgEAAK4BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPjxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1wYWNrYWdlLnJlbGF0aW9uc2hpcHMreG1sIi8+PERlZmF1bHQgRXh0ZW5zaW9uPSJ4bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi94bWwiLz48T3ZlcnJpZGUgUGFydE5hbWU9Ii93b3JkL2RvY3VtZW50LnhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLmRvY3VtZW50Lm1haW4reG1sIi8+PC9UeXBlcz5QSwMEFAAAAAAAAAAhALmBRHEqAQAAKgEAAAsAAABfcmVscy8ucmVsczw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFJlbGF0aW9uc2hpcHMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcyI+PFJlbGF0aW9uc2hpcCBJZD0icklkMSIgVHlwZT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy9vZmZpY2VEb2N1bWVudCIgVGFyZ2V0PSJ3b3JkL2RvY3VtZW50LnhtbCIvPjwvUmVsYXRpb25zaGlwcz5QSwMEFAAAAAAAAAAhAIxvhD7cAQAA3AEAABEAAAB3b3JkL2RvY3VtZW50LnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPHc6ZG9jdW1lbnQgeG1sbnM6dz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3dvcmRwcm9jZXNzaW5nbWwvMjAwNi9tYWluIj48dzpib2R5Pgo8dzpwPjx3OnBQcj48dzpwU3R5bGUgdzp2YWw9IkhlYWRpbmcxIi8+PC93OnBQcj48dzpyPjx3OnQ+5LiA44CB5rGC5qC55YWs5byP5o6o5a+8PC93OnQ+PC93OnI+PC93OnA+Cjx3OnA+PHc6cj48dzp0PuWvueS6juS4gOiIrOW9ouW8jyBheF4yK2J4K2M9MO+8jOS4pOi+ueWQjOmZpOS7pSBh77yaPC93OnQ+PC93OnI+PC93OnA+Cjx3OnA+PHc6cj48dzp0PnheMiArIChiL2EpeCArIGMvYSA9IDA8L3c6dD48L3c6cj48L3c6cD4KPHc6cD48dzpyPjx3OnQ+5rGC6KejIDJ4XjItNHgtNj0wIOeahOagueOAgjwvdzp0PjwvdzpyPjwvdzpwPgo8L3c6Ym9keT48L3c6ZG9jdW1lbnQ+UEsBAhQAFAAAAAAAAAAhAMlPGrCuAQAArgEAABMAAAAAAAAAAAAAAAAAAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAUAAAAAAAAACEAuYFEcSoBAAAqAQAACwAAAAAAAAAAAAAAAADfAQAAX3JlbHMvLnJlbHNQSwECFAAUAAAAAAAAACEAjG+EPtwBAADcAQAAEQAAAAAAAAAAAAAAAAAyAwAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAMAAwC5AAAAPQUAAAAA";

function b64ToFile(b64, name, mime) {
  var bin = atob(b64);
  var arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}
function textFile(text, name) { return new File([text], name, { type: 'text/plain' }); }

(async function () {
  var out = document.getElementById('out');
  var res = { docx: null, pdf: null, ocr: null, txt: null, errors: [] };
  try {
    /* ---- 1) TXT ---- */
    var r1 = await InkImport.capture([textFile('hello 世界\n\n$x^2$', 'a.txt')]);
    res.txt = { len: r1.length, head: r1.slice(0, 40) };

    /* ---- 2) DOCX ---- */
    var f = b64ToFile(DOCX_B64, 'fixture.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    var r2 = await InkImport.capture([f]);
    res.docx = { len: r2.length, hasHeading: r2.indexOf('求根公式推导') >= 0, hasBody: r2.indexOf('两边同除以') >= 0, head: r2.slice(0, 120) };

    /* ---- 3) PDF ---- */
    var pdf = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    pdf.setFontSize(16);
    pdf.text('Quadratic formula derivation', 60, 80);
    pdf.setFontSize(13);
    pdf.text('ax^2 + bx + c = 0', 60, 120);
    pdf.text('x = (-b +- sqrt(b^2-4ac)) / 2a', 60, 150);
    var pdfBlob = pdf.output('blob');
    var pdfFile = new File([pdfBlob], 'fixture.pdf', { type: 'application/pdf' });
    var r3 = await InkImport.capture([pdfFile]);
    res.pdf = { len: r3.length, hasTitle: r3.indexOf('Quadratic') >= 0, hasEq: r3.indexOf('sqrt') >= 0 || r3.indexOf('bx') >= 0, head: r3.slice(0, 160) };

    /* ---- 4) 图片 OCR ---- */
    var cv = document.createElement('canvas');
    cv.width = 760; cv.height = 220;
    var cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.fillStyle = '#000';
    cx.font = '44px "Microsoft YaHei", sans-serif';
    cx.fillText('求解 2x + 3 = 11', 30, 80);
    cx.font = '40px Arial, sans-serif';
    cx.fillText('x = 4', 30, 150);
    var imgBlob = await new Promise(function (r) { cv.toBlob(r, 'image/png'); });
    var imgFile = new File([imgBlob], 'fixture.png', { type: 'image/png' });
    var r4 = await InkImport.capture([imgFile]);
    res.ocr = { len: r4.length, head: r4.slice(0, 160) };
  } catch (e) {
    res.errors.push(String(e && e.stack || e).slice(0, 300));
  }
  out.textContent = 'IMPORT:' + JSON.stringify(res);
})();
