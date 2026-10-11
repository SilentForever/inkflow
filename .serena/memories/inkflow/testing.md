# InkFlow 测试

三套测试均用 headless Chrome 跑，结果写在 `<pre>` 的 JSON 里。

## 一键运行（首选）
```bash
node tests/run.js            # 全部三套；任一失败退出码非零
node tests/run.js unit acc   # 只跑指定套件（unit / acc / e2e）
```
`tests/run.js` 自动探测 Chrome（或读 `CHROME` 环境变量），跑完按**平衡括号扫描**解析 `RESULTS_JSON:`/`ACC_JSON:`/`E2E_JSON:`，把原始 DOM 存到 `tests/.run/<key>.html`（已 gitignore）。**每套用独立 `--user-data-dir`**——否则残留 Chrome 争用单例锁会让 `--dump-dom` 静默失败（stdout 只有 updater 噪声、无 marker）。遇此现象先 `Stop-Process -Name chrome -Force`。
> **解析陷阱**：`E2E_JSON:` 这个串**也出现在 e2e 页自身的 `<script>` 源码里**（拼结果那行），而结果 `<pre>` 被 append 到 body 末尾 → 必须**逐个 marker 出现位置尝试、取首个能 `JSON.parse` 成对象的**；只取第一个 `indexOf` 会命中源码诱饵而解析失败（unit/acc 因 `<pre>` 在脚本之前而侥幸没踩）。
> **`report.json`**：runner 每跑完一套就把 `{chrome,done,results}` 落盘到 `tests/.run/report.json`（每套后、结束时各写一次）→ 即使进程被杀/输出被吞，也能从该文件读出进度与结论。
> **后台包装层假象**：本机 shell 用 `background=true` 跑 `node … > log 2>&1` 时，**node 的 stdout 会被吞掉、`$?` 被污染成 1**（实测：纯 `node -e 'console.log(...)'` 后台跑也得到 `EXIT=1` 且日志只有 `stdin is not a tty`，但副作用文件照写）。所以**不要**用 `FULL_EXIT=1` 判断 runner 失败——**只信 `report.json` / 前台运行的输出**。
> **profile 清理 EPERM（曾致 runner 静默 exit 1）**：Windows 上若 chrome 子进程未释放文件，`fs.rmSync(profile)` 会抛 EPERM。**已修**：runner 改为**先写结果 `<key>.html`、再 try 清理 profile**，并对每套加 `try/catch`（异常记入 `report.json` 而不中断）→ 清理失败再也不会吞掉结果。另：**别在后台 runner 运行期间并发 `rm -rf tests/.run`**——会删掉它正在写的 `report.json`。

## 手动运行（单套）
```bash
CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
# 单元/集成（50 项）
"$CHROME" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --dump-dom --virtual-time-budget=100000 "file:///D:/转手写字体/tests/run-tests.html"
# 准确率审计（42 篇 × 9 项 = 378）
"$CHROME" ... --virtual-time-budget=200000 "file:///D:/转手写字体/tests/accuracy.html"
# 端到端 UI（31 项）—— 需 ~520s，用 --virtual-time-budget=460000
"$CHROME" ... --virtual-time-budget=460000 "file:///D:/转手写字体/tests/e2e.html"
```

## 结果标记
- 单元：`<pre id="results">` 的 `RESULTS_JSON:` `{total,pass,fail,results:[{name,pass,detail}]}`（字段是 **pass** 不是 ok）。
- 准确率：`<pre id="r">` 的 `ACC_JSON`。
- e2e：追加 `<pre id="e2e-results">`，前缀 `E2E_JSON:`。

## e2e 主体同步
`tests/e2e.html` 内嵌一份 index.html 的 body。**改了 index.html 的 DOM 必须重新同步 e2e 的 body**，否则结构断言失准。同步法：截取 `index.html` 的 `<body>…<script>` 之间内容，按 `[...idx.matchAll(/<script src="([^"]+)"/g)]` 原顺序重发 `<script src="../…">`。

## 最近一次基线（本轮，全绿）
单元 **50/50**、e2e **31/31**、准确率 **378/378（100%）**；网络请求/本地存储 **0/0**。

> **根号回归（新增 2 例，共 50）**：①「勾不被缩小、与上横线相接、横线覆盖被开方数」——
> 断言 `hook.size > fontPx*1.05`（旧 bug 会把勾缩到 ~0.6×）、`lines.length===1`、
> `line.x0 ≤ hook.cx + hook.size*0.5`、`line.x1 ≥ 被开方数右缘`；②「缺 √ 字形回退时保留字形路径」——
> 断言 `fallbackSvg` 含 `<defs>` 与 `<path>`（旧版把 defs 里的 path 一并删掉 → 回退字形空白）。
> 注意：`InkMath.clearCache()` 现同时清 `_cov`（字形覆盖探测缓存）；`InkApp.registerFonts()`
> 结束后会调用它 —— 否则字体加载前渲染的公式会被永久缓存成印刷体。
> 字体改 WOFF2 + 分批加载后，「徽标」断言改为轮询等待 `20/20`（默认字体先到，其余后台补齐）。

## 本轮（加载提速 / 左栏一体化 / 右栏精修）附加自检
- `index.html` headless 冒烟：`#fontBadge` 收敛到 `字体 20/20`、`#mathBadge`=`公式引擎就绪`、无控制台报错。
- 懒加载探针：`InkLoader.ensurePdf/ensureDocx/ensureJsPdf/ensureOcr` 四个入口均成功注入全局（`pdfjsLib`/`mammoth`/`jspdf.jsPDF`/`Tesseract`）。
- 临时探针页放 `D:\tmp\`，**不要留库**。

## 截图
`tests/out/*.png`（本地复核用，大部分 gitignore；只保留少量入库）。临时探针页用完即删，不要留库。