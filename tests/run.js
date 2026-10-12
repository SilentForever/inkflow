#!/usr/bin/env node
/* InkFlow · 一键测试运行器
 *
 * 依次跑三套 headless-Chrome 测试并解析结果，任一失败则退出码非零：
 *   node tests/run.js            # 全部
 *   node tests/run.js unit acc   # 只跑指定套件（unit / acc / e2e）
 *
 * 依赖：本机 Chrome（自动探测常见路径，或用环境变量 CHROME 指定）。
 * 说明：测试页是 file:// 下的经典脚本，故需 --allow-file-access-from-files。
 */
"use strict";
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, "tests", ".run");

const SUITES = {
  unit: { page: "tests/run-tests.html", marker: "RESULTS_JSON:", budget: 120000, label: "单元 / 集成" },
  acc:  { page: "tests/accuracy.html",  marker: "ACC_JSON:",     budget: 200000, label: "准确率审计" },
  e2e:  { page: "tests/e2e.html",       marker: "E2E_JSON:",     budget: 200000, label: "端到端 UI" },
  /* OCR 需要 http(s) 环境（Worker 限制）→ 交给专用 runner（自起静态服务器 + CDP），
     不能像上面三套那样直接 file:// dump-dom。 */
  ocr:  { runner: "tests/ocr-runner.js", marker: "OCR_JSON:", label: "图片 OCR" },
};

function findChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const cands = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return c;
  return null;
}

/* 从 dump-dom 输出里按平衡括号扫描出 marker 后的 JSON 对象。
   注意：marker（如 E2E_JSON:）也可能出现在页面自身的 <script> 源码里，
   且结果 <pre> 可能被 append 到 body 末尾 → 逐个出现位置尝试，返回首个能解析成对象的。 */
function extractJson(html, marker) {
  let from = 0;
  while (true) {
    const k = html.indexOf(marker, from);
    if (k < 0) return null;
    from = k + marker.length;
    const start = html.indexOf("{", k);
    if (start < 0) continue;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try { const o = JSON.parse(html.slice(start, i + 1)); if (o && typeof o === "object") return o; } catch (e) {}
          break;   /* 该处不是合法 JSON（多半是源码里的诱饵）→ 试下一个出现位置 */
        }
      }
    }
  }
}

function runRunner(chrome, key) {
  const s = SUITES[key];
  const runner = path.join(ROOT, s.runner);
  const r = spawnSync(process.execPath, [runner], {
    cwd: ROOT, encoding: "utf8", timeout: 300000,
    env: Object.assign({}, process.env, { CHROME: chrome }),
  });
  const out = (r.stdout || "") + (r.stderr || "");
  const j = extractJson(out, s.marker);
  if (!j) return { key, label: s.label, ok: false, err: "未解析到 " + s.marker + "（runner 可能超时）", total: 0, pass: 0, fail: 0 };
  const total = j.total != null ? j.total : 1, pass = j.pass ? 1 : 0, fail = j.pass ? 0 : 1;
  const extra = [];
  if (j.ocr) extra.push("OCR 识别到「" + String(j.ocr.head || "").replace(/\n/g, " / ").slice(0, 24) + "」");
  if (j.errors && j.errors.length) extra.push("err: " + String(j.errors[0]).slice(0, 80));
  return { key, label: s.label, ok: !!j.pass, total, pass, fail, extra: extra.join("  ") };
}

function runSuite(chrome, key) {
  const s = SUITES[key];
  if (s.runner) return runRunner(chrome, key);
  const url = "file:///" + path.join(ROOT, s.page).replace(/\\/g, "/");
  fs.mkdirSync(TMP, { recursive: true });
  const outFile = path.join(TMP, key + ".html");
  try { fs.rmSync(outFile, { force: true }); } catch (e) {}   /* 先删旧结果，避免崩溃后残留旧文件被误读为“通过” */
  /* 每次用独立 profile，避免与残留 Chrome 进程争用单例锁（否则 dump-dom 静默失败） */
  const profile = path.join(TMP, "profile-" + key + "-" + process.pid + "-" + Date.now());
  const args = [
    "--headless=new", "--disable-gpu", "--no-sandbox",
    "--user-data-dir=" + profile,
    "--allow-file-access-from-files", "--hide-scrollbars",
    "--virtual-time-budget=" + s.budget, "--dump-dom", url,
  ];
  /* 关键：把 chrome 的 stdout 直接写进文件（而非管道）。
     headless Chrome 已知在 dump-dom 后会挂起不退出；若用管道，被超时杀掉时缓冲区里的
     DOM 会一起丢失 → 表现为“无结果”。直写文件则数据已落盘，杀掉也无所谓。 */
  const outFd = fs.openSync(outFile, "w");
  try {
    spawnSync(chrome, args, { stdio: ["ignore", outFd, outFd], timeout: s.budget + 60000 });
  } finally {
    try { fs.closeSync(outFd); } catch (e) {}
  }
  let html = "";
  try { html = fs.readFileSync(outFile, "utf8"); } catch (e) {}
  /* 再清理 profile：Windows 上若 chrome 子进程尚未释放文件，rmSync 会抛 EPERM ——
     清理失败绝不能吞掉测试结果或让 runner 崩溃。 */
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch (e) {}
  const j = extractJson(html, s.marker);
  if (!j) return { key, label: s.label, ok: false, err: "未解析到 " + s.marker + "（套件可能超时或页面报错）", total: 0, pass: 0, fail: 0 };
  const total = j.total || 0, pass = j.pass || 0, fail = (j.fail != null ? j.fail : total - pass);
  const extra = [];
  if (j.acc != null) extra.push("准确率 " + j.acc + "%");
  if (Array.isArray(j.failures) && j.failures.length) extra.push("失败样例 " + j.failures.slice(0, 3).join(", "));
  return { key, label: s.label, ok: fail === 0 && total > 0, total, pass, fail, extra: extra.join("  ") };
}

function main() {
  const chrome = findChrome();
  if (!chrome) { console.error("找不到 Chrome，请设置环境变量 CHROME 指向 chrome 可执行文件"); process.exit(2); }
  const want = process.argv.slice(2).filter((a) => SUITES[a]);
  const keys = want.length ? want : Object.keys(SUITES);
  fs.mkdirSync(TMP, { recursive: true });
  const reportFile = path.join(TMP, "report.json");
  const flush = (results, done) => { try { fs.writeFileSync(reportFile, JSON.stringify({ chrome, done, results }, null, 2)); } catch (e) {} };
  flush([], false);
  console.log("Chrome: " + chrome + "\n");
  /* 清理上次崩溃残留的 profile（可能仍被僵尸 chrome 占用 → 逐个 try） */
  try { for (const d of fs.readdirSync(TMP)) if (/^profile-/.test(d)) { try { fs.rmSync(path.join(TMP, d), { recursive: true, force: true }); } catch (e) {} } } catch (e) {}
  const results = [];
  for (const k of keys) {
    process.stdout.write("▶ " + SUITES[k].label + " 运行中…");
    let res;
    try {
      res = runSuite(chrome, k);
    } catch (e) {
      /* 单套异常（如 profile 清理失败）不能中断其余套件，且必须记入报告 */
      res = { key: k, label: SUITES[k].label, ok: false, err: "runner 异常：" + (e && e.message || e), total: 0, pass: 0, fail: 0 };
    }
    results.push(res);
    flush(results, false);   /* 每套跑完即落盘：即便进程被杀，也能从 report.json 看出进度与结果 */
    console.log("\r" + (res.ok ? "✅" : "❌") + " " + res.label.padEnd(10, " ") +
      (res.err ? res.err : (res.pass + " / " + res.total + (res.extra ? "  " + res.extra : ""))));
  }
  const bad = results.filter((r) => !r.ok);
  flush(results, true);
  console.log("\n" + (bad.length ? ("❌ 有 " + bad.length + " 套未通过") : "🎉 全部通过"));
  process.exit(bad.length ? 1 : 0);
}

main();
