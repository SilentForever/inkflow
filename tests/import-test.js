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

/* ================= 按原文大小：DOCX / PDF 字号提取回归 ================= */
var SIZED_DOCX_B64 = "UEsDBBQAAAAIAJdWRl3wSsJ/+AAAACwCAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbK2Ru07DMBSGX8U6a5U4MCCEknbgMgJDeYAj+ySx8E0+bmneHqcpHVCBhdH+L98vu90cnBV7SmyC7+CqbkCQV0EbP3Twtn2qbkFwRq/RBk8dTMSwWbfbKRKLkvXcwZhzvJOS1UgOuQ6RfFH6kBzmckyDjKjecSB53TQ3UgWfyecqzx2wbh+ox53N4vFQrpcdiSyDuF+MM6sDjNEahbnocu/1N0p1ItQlefTwaCKvigHkRcKs/Aw45V7KwySjSbxiys/oikt+hKSlDmrnSrL+vebCztD3RtE5P7fFFBQxlxd3tj4rDo1f/bWD82SJ/3/F0vuFl8ffXn8CUEsDBBQAAAAIAJdWRl1g5jVovgAAAK0BAAALAAAAX3JlbHMvLnJlbHOtkE0LwjAMhv9Kyd117iAi63YRYVeZP6C02QdubWnqx/69BRWc7ODBY94kTx6Sl/dxYFf01FsjYJ2kwNAoq3vTCjjVh9UWGAVptBysQQETEpRFfsRBhrhCXe+IRYYhAV0Ibsc5qQ5HSYl1aGKnsX6UIZa+5U6qs2yRZ2m64f6TAXMmq7QAX+k1sHpy+AvbNk2vcG/VZUQTFk58TUSy9C0GATfrNdevOIlY4Ms22T9tKExDfObc4hm+HfjszcUDUEsDBBQAAAAIAJdWRl00Sf+yRAEAADkDAAARAAAAd29yZC9kb2N1bWVudC54bWzNks9LwzAUx/+VkrtLN4aM0nY3zx70D4ht3AZtEpLaOk9TkF2m3nQIgjhhl1U9KOi2/8b+0NP+BdNVGROKzpOXvIT3fd/3SfL0+r7rKD7mokWJAcolFSiYWNRukYYBtrc21mpAER4iNnIowQZoYwHqph5oNrX2XEw8RRoQoQUGaHoe0yAUVhO7SJQow0Tmdil3kSePvAEDym3GqYWFkP6uAyuqug5d1CIgs9yhdjuLbL5s8izwPIgDJdB85BigqgJo6vAzAxfCX6gDbY6rCYYseRfGscDcx8BMrrvvN/3Z9DIa9+KTw3RwHN8O4/Aiq/Ty+rzXj3iV6ip4y+pivHCQnHfT0Sh67iR3T7NpBilRJedr5+jfQY573yDlPp0M00n4J9pybRXaZXUhbfxwJv/37f4x6Z9KvOjlqvAx4ddkwsXUmx9QSwMEFAAAAAgAl1ZGXWhYUeymAAAA8AAAAA8AAAB3b3JkL3N0eWxlcy54bWxdjssOgjAQRX+lmb0MEmMMobAxrl3oBzQwPJI+SKdS8esFgwtdnty5505RPY0WE3kenJWwT1IQZGvXDLaTcL9ddicQHJRtlHaWJMzEUJVFzDnMmlgsdct5lNCHMOaIXPdkFCduJLtkrfNGhQV9h9H5ZvSuJubFbjRmaXpEowYLq7Bx9Zla9dCBV/RXv+FGn9GXiPmktITsAFgWuCX4e49/Nvy+W74BUEsBAhQAFAAAAAgAl1ZGXfBKwn/4AAAALAIAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAUAAAACACXVkZdYOY1aL4AAACtAQAACwAAAAAAAAAAAAAAgAEpAQAAX3JlbHMvLnJlbHNQSwECFAAUAAAACACXVkZdNEn/skQBAAA5AwAAEQAAAAAAAAAAAAAAgAEQAgAAd29yZC9kb2N1bWVudC54bWxQSwECFAAUAAAACACXVkZdaFhR7KYAAADwAAAADwAAAAAAAAAAAAAAgAGDAwAAd29yZC9zdHlsZXMueG1sUEsFBgAAAAAEAAQA9gAAAFYEAAAAAA==";
var SIZED_PDF_B64 = "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAxOTcgPj4Kc3RyZWFtCkJUIC9GMSAyNCBUZiA3MiA3MDAgVGQgKEJpZyBUaXRsZSBIZXJlKSBUaiBFVApCVCAvRjEgMTIgVGYgNzIgNjYwIFRkIChCb2R5IHRleHQgbGluZSBvbmUpIFRqIEVUCkJUIC9GMSAxMiBUZiA3MiA2NDAgVGQgKEJvZHkgdGV4dCBsaW5lIHR3bykgVGogRVQKQlQgL0YxIDggVGYgNzIgNjEwIFRkIChGb290bm90ZSBzbWFsbCBwcmludCkgVGogRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDA0ODggMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo1NTgKJSVFT0YK";
function pctsOf(text){
  return text.split("\n").filter(function(l){return l.trim();}).map(function(l){
    var m = l.match(/^\u0001F(\d+)\u0001/); return m ? Number(m[1]) : 0;
  });
}
(async function(){
  var out = document.getElementById('out');
  var res = { docxSizes: null, pdfSizes: null, docxClean: null, pdfClean: null, errors: [] };
  try {
    var df = b64ToFile(SIZED_DOCX_B64, 'sized.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    var t1 = await InkImport.capture([df]);
    res.docxSizes = pctsOf(t1);
    var c1 = t1.replace(/\u0001F\d+\u0001/g, "");
    res.docxClean = (c1.indexOf('\u0001') < 0) && (c1.indexOf('标题：二十磅大字') >= 0) && (c1.indexOf('小字说明，九磅。') >= 0);

    var pf = b64ToFile(SIZED_PDF_B64, 'sized.pdf', 'application/pdf');
    var t2 = await InkImport.capture([pf]);
    res.pdfSizes = pctsOf(t2);
    var c2 = t2.replace(/\u0001F\d+\u0001/g, "");
    res.pdfClean = (c2.indexOf('\u0001') < 0) && (c2.indexOf('Big Title Here') >= 0) && (c2.indexOf('Footnote small print') >= 0);

    var ok = true;
    if (!res.docxSizes || res.docxSizes.length !== 4) ok = false;
    else {
      if (Math.abs(res.docxSizes[0]-167) > 5) ok = false;
      if (Math.abs(res.docxSizes[1]-100) > 5 || Math.abs(res.docxSizes[2]-100) > 5) ok = false;
      if (Math.abs(res.docxSizes[3]-75) > 5) ok = false;
      if (!(res.docxSizes[0] > res.docxSizes[1] && res.docxSizes[1] > res.docxSizes[3])) ok = false;
    }
    if (!res.pdfSizes || res.pdfSizes.length !== 4) ok = false;
    else {
      if (Math.abs(res.pdfSizes[0]-200) > 8) ok = false;
      if (Math.abs(res.pdfSizes[1]-100) > 5 || Math.abs(res.pdfSizes[2]-100) > 5) ok = false;
      if (Math.abs(res.pdfSizes[3]-67) > 8) ok = false;
      if (!(res.pdfSizes[0] > res.pdfSizes[1] && res.pdfSizes[1] > res.pdfSizes[3])) ok = false;
    }
    if (!res.docxClean || !res.pdfClean) ok = false;
    res.pass = ok;
  } catch (e) {
    res.errors.push(String(e && e.stack || e).slice(0, 300));
    res.pass = false;
  }
  var pre = document.createElement('pre'); pre.id = 'sizefixture';
  pre.textContent = 'SIZEFIX:' + JSON.stringify(res);
  out.parentNode.appendChild(pre);
})();
