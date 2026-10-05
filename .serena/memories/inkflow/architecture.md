# InkFlow 架构

## 渲染管线
Markdown+LaTeX → `js/parser.js` → `js/renderer.js` 行布局 → 手写化 → 分页 → `js/exporter.js` 导出 PNG/PDF。

## 脚本加载顺序（index.html，务必保持）
vendor/jspdf.umd.min.js, vendor/mathjax/tex-svg.js, vendor/mammoth.browser.min.js, vendor/pdf.min.js, vendor/tesseract.min.js, js/prng.js, js/parser.js, js/mathrender.js, js/paper.js, js/renderer.js, js/exporter.js, js/importers.js, js/queue.js, js/samples.js, js/app.js

## 公式手写化（核心：js/mathrender.js 的 InkMath）
- MathJax(tex-svg) 生成矢量 SVG → 隐藏离屏容器真实布局 → `getBoundingClientRect()` 读每个字形位置 → **在 canvas 上用手写字体重画字形**。
- 关键原因：**SVG 以 `<img>`/data-url 载入处于隔离环境，读不到页面 Web 字体**，所以 `<text>` 放进 SVG 永远不是手写体 → 必须 canvas 画。
- **字号推导**：沿 `use → g → … → svg` 累积 2×2 矩阵 M，`字号 = fontPx × sc`，`sc = sqrt(|det M|)`；基线 `baseY = (M.f − vbY) × uScale`。**不要用「墨迹包围盒高度」反推字号**——会把被 MathJax 拉长的括号/根号画得过大。`EX_RATIO=0.5`、`SS=2`。上下标自然得到 0.707×。
- **字体链** `MATH_FALLBACK`（js/renderer.js）：当前正文字体 → MPLUSRounded1c → Zen Kurenaido → PottaOne → ZenMaruGothic → Yomogi → Klee One → MaShanZheng → LongCang → ZhiMangXing → LiuJianMaoCao；仍缺字符则保留 MathJax 原字形兜底（内容绝不丢失）。

## 字体
- **20 款内置（11 中文 + 9 英文）**，`fonts/` 共 47.3MB。中文默认 `Zen Kurenaido`，拉丁默认 `Caveat`；中英双下拉分别选。
- 字体文件清单：`js/app.js` 的 `FONT_FILES`（20 条）；字体定义：`js/renderer.js` 的 `FONTS`。

## 左栏（Word 式工具栏，互斥不并排）
`[编辑|预览]` 视图切换 ｜ `B I U · 字色 · 字号`（编辑视图专属） ｜ `[单篇|批量]` 队列模式（编辑视图子模式）。

## 状态
全部内存态；队列结果按 `settingsHash` 缓存（`js/queue.js`）；刷新即清空。