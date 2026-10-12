#!/usr/bin/env node
/* InkFlow · 图片 OCR 回归测试（需要 http(s) 环境，故自起本地静态服务器 + CDP）
 *
 * 背景：OCR 曾因 workerPath 指向主 bundle（而非专用的 worker.min.js）而**永久挂起**，
 * 表现为「点了识别图片一直卡住」。此脚本跑真实的 InkImport.capture() 路径，
 * 断言能识别出图片文字，防止该问题回归。
 *
 * 用法：node tests/ocr-runner.js   → 成功打印 OCR_JSON:{...} 并 exit 0，失败 exit 1。
 * run.js 的 ocr 套件会调用它。
 */
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP_PORT = 9410 + (process.pid % 50);
const HTTP_PORT = 5300 + (process.pid % 50);

const get = (u) => new Promise((res, rej) => http.get(u, (r) => { let d = ""; r.on("data", c => d += c); r.on("end", () => res(d)); }).on("error", rej));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json",
  ".woff2": "font/woff2", ".png": "image/png", ".gz": "application/gzip", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".otf": "font/otf" };

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
      fs.readFile(path.join(ROOT, p), (e, d) => {
        if (e) { res.writeHead(404); res.end("404"); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
        res.end(d);
      });
    });
    srv.listen(HTTP_PORT, "127.0.0.1", () => resolve(srv));
  });
}

async function main() {
  const server = await startServer();
  const profile = path.join(ROOT, "tests", ".run", "ocr-runner-profile");
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--allow-file-access-from-files",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    "about:blank"], { stdio: "ignore" });

  const finish = (code) => { try { chrome.kill(); } catch (e) {} try { server.close(); } catch (e) {} try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {} process.exit(code); };

  let version = null;
  for (let i = 0; i < 80; i++) { try { version = JSON.parse(await get("http://127.0.0.1:" + CDP_PORT + "/json/version")); break; } catch (e) { await sleep(250); } }
  if (!version) { console.log("OCR_JSON:" + JSON.stringify({ pass: false, err: "Chrome CDP 未就绪" })); return finish(1); }

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  let id = 0; const pend = {}; const cons = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString("utf8"));
    if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; return; }
    if (m.method === "Runtime.exceptionThrown") { const d = m.params.exceptionDetails || {}; cons.push("EXC " + ((d.exception && d.exception.description) || d.text)); }
  });
  const raw = (method, params, sid) => new Promise((res) => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params: params || {}, sessionId: sid })); });
  const evalRaw = async (expr, sid) => { const r = await raw("Runtime.evaluate", { expression: expr, returnByValue: true }, sid); return r.result && r.result.result ? r.result.result.value : undefined; };
  await new Promise(r => ws.addEventListener("open", r));
  const ct = await raw("Target.createTarget", { url: "about:blank" });
  const at = await raw("Target.attachToTarget", { targetId: ct.result.targetId, flatten: true });
  const sessionId = at.result.sessionId;
  await raw("Runtime.enable", {}, sessionId); await raw("Page.enable", {}, sessionId);
  await raw("Page.navigate", { url: "http://127.0.0.1:" + HTTP_PORT + "/tests/import-test.html" }, sessionId);

  let txt = "";
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    txt = await evalRaw("(function(){var o=document.getElementById('out');var s=document.getElementById('sizefixture');var p=document.getElementById('pgfixture');return (o?o.textContent:'')+' ||| '+(s?s.textContent:'')+' ||| '+(p?p.textContent:'');})()", sessionId) || "";
    if (/IMPORT:/.test(txt) && /SIZEFIX:/.test(txt) && /PGFIX:/.test(txt)) break;
  }
  ws.close();

  let res = { pass: false, err: "超时未取到 import-test 结果", raw: txt.slice(0, 200) };
  /* 平衡括号扫描出 marker 后的完整 JSON 对象（JSON 有嵌套，非贪婪正则会截断） */
  function afterMarker(str, marker) {
    const k = str.indexOf(marker);
    if (k < 0) return null;
    const start = str.indexOf("{", k);
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < str.length; i++) {
      const ch = str[i];
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(str.slice(start, i + 1)); } catch (e) { return null; } } }
    }
    return null;
  }
  try {
    const imp = afterMarker(txt, "IMPORT:");
    const sz = afterMarker(txt, "SIZEFIX:");
    const pg = afterMarker(txt, "PGFIX:");
    const ocrHead = (imp.ocr && imp.ocr.head) || "";
    const ocrOk = imp.ocr && imp.ocr.len > 0 && /求解/.test(ocrHead) && /4/.test(ocrHead);
    res = {
      pass: !!(ocrOk && sz.pass && pg.pass && imp.errors.length === 0),
      ocr: imp.ocr, docx: imp.docx && imp.docx.hasHeading && imp.docx.hasBody, pdf: imp.pdf && imp.pdf.hasTitle,
      sizePass: sz.pass, pagePass: pg.pass, errors: imp.errors.concat(cons),
    };
  } catch (e) { res = { pass: false, err: "解析失败：" + (e && e.message), raw: txt.slice(0, 300) }; }

  console.log("OCR_JSON:" + JSON.stringify(res));
  finish(res.pass ? 0 : 1);
}
main();
