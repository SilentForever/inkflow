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
  e2e:  { page: "tests/e2e.html",       marker: "E2E_JSON:",     budget: 600000, label: "端到端 UI" },
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

/* 从 dump-dom 输出里按平衡括号扫描出 marker 后的 JSON 对象 */
function extractJson(html, marker) {
  const k = html.indexOf(marker);
  if (k < 0) return null;
  const start = html.indexOf("{", k);
  if (start < 0) return null;
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
    else if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch (e) { return null; } } }
  }
  return null;
}

function runSuite(chrome, key) {
  const s = SUITES[key];
  const url = "file:///" + path.join(ROOT, s.page).replace(/\\/g, "/");
  fs.mkdirSync(TMP, { recursive: true });
  /* 每次用独立 profile，避免与残留 Chrome 进程争用单例锁（否则 dump-dom 静默失败） */
  const profile = path.join(TMP, "profile-" + key + "-" + process.pid + "-" + Date.now());
  const args = [
    "--headless=new", "--disable-gpu", "--no-sandbox",
    "--user-data-dir=" + profile,
    "--allow-file-access-from-files", "--hide-scrollbars",
    "--virtual-time-budget=" + s.budget, "--dump-dom", url,
  ];
  const r = spawnSync(chrome, args, { encoding: "utf8", timeout: s.budget + 60000, maxBuffer: 128 * 1024 * 1024 });
  const html = (r.stdout || "") + (r.stderr || "");
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  fs.writeFileSync(path.join(TMP, key + ".html"), html);
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
  console.log("Chrome: " + chrome + "\n");
  const results = [];
  for (const k of keys) {
    process.stdout.write("▶ " + SUITES[k].label + " 运行中…");
    const res = runSuite(chrome, k);
    results.push(res);
    console.log("\r" + (res.ok ? "✅" : "❌") + " " + res.label.padEnd(10, " ") +
      (res.err ? res.err : (res.pass + " / " + res.total + (res.extra ? "  " + res.extra : ""))));
  }
  const bad = results.filter((r) => !r.ok);
  console.log("\n" + (bad.length ? ("❌ 有 " + bad.length + " 套未通过") : "🎉 全部通过"));
  process.exit(bad.length ? 1 : 0);
}

main();
