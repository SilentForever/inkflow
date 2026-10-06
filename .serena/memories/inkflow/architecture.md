# InkFlow 架构

## 渲染管线
Markdown+LaTeX → `js/parser.js` → `js/renderer.js` 行布局 → 手写化 → 分页 → `js/exporter.js` 导出 PNG/PDF。

## 脚本加载顺序（index.html，务必保持）
首屏：`vendor/mathjax/tex-svg.js, js/loader.js, js/prng.js, js/parser.js, js/mathrender.js, js/paper.js, js/renderer.js, js/exporter.js, js/importers.js, js/queue.js, js/samples.js, js/app.js`
**重型组件（jsPDF / Mammoth / PDF.js / Tesseract）不再写死，改由 `js/loader.js` 按需注入 `<script>`**（`ensureJsPdf/ensureDocx/ensurePdf/ensureOcr`）。因此 `importers.js` / `exporter.js` 在真正用到时必须先 `await InkLoader.ensureXxx()` 再取全局对象。

## 加载提速（首屏关键）
- 字体已转 **WOFF2**（`tools/ttf2woff2.py`，需 fontTools+brotli）：fonts/ 47MB → **20.8MB**。
- `js/app.js` 的 `registerFonts` 拆分：`loadBootFonts()` 先加载默认中/英各一款（Zen Kurenaido + Caveat，约 1.4MB）→ 出首屏 → `loadRemainingFonts()` 后台补齐，补齐后按需重绘。字体徽标 `#fontBadge` 显示已加载数 `n/20`。
- 首屏关键资源：`index.html + css + 轻量本地 JS + MathJax + 1.4MB 字体`。

## 公式手写化（核心：js/mathrender.js 的 InkMath）
- MathJax(tex-svg) 生成矢量 SVG → 隐藏离屏容器真实布局 → `getBoundingClientRect()` 读每个字形位置 → **在 canvas 上用手写字体重画字形**。
- 关键原因：**SVG 以 `<img>`/data-url 载入处于隔离环境，读不到页面 Web 字体**，所以 `<text>` 放进 SVG 永远不是手写体 → 必须 canvas 画。
- **字号推导**：沿 `use → g → … → svg` 累积 2×2 矩阵 M，`字号 = fontPx × sc`，`sc = sqrt(|det M|)`；基线 `baseY = (M.f − vbY) × uScale`。**不要用「墨迹包围盒高度」反推字号**——会把被 MathJax 拉长的括号/根号画得过大。`EX_RATIO=0.5`、`SS=2`。上下标自然得到 0.707×。
- **字体链** `MATH_FALLBACK`（js/renderer.js）：当前正文字体 → MPLUSRounded1c → Zen Kurenaido → PottaOne → ZenMaruGothic → Yomogi → Klee One → MaShanZheng → LongCang → ZhiMangXing → LiuJianMaoCao；仍缺字符则保留 MathJax 原字形兜底（内容绝不丢失）。

## 字体
- **20 款内置（11 中文 + 9 英文）**，`fonts/` 为 WOFF2，共约 20.8MB。中文默认 `Zen Kurenaido`，拉丁默认 `Caveat`；中英双下拉分别选。
- 字体文件清单：`js/app.js` 的 `FONT_FILES`（20 条，`url` 均为 `*.woff2`）；字体定义：`js/renderer.js` 的 `FONTS`。
- **8 款系统手写字体**（`FONTS` 里标 `sys:true`，`family` 为本机字族名，不打包）：中文 `华文行楷(STXingkai)`、`Ink Free`；英文 `Segoe Script`、`Segoe Print`、`Comic Sans MS`、`Gabriola`（另原有 `系统楷体 KaiTi`）。**下拉总数：中文 13、英文 13**（`fontsByLang` 自动带出）。
- **字体按需加载**：`loadFontFamily(family)` 按 family 找到 `FONT_FILES` 条目并 `loadFontEntry`；系统字体返回 null（无需加载）。字体下拉 `pickFont()` 选到**尚未加载**的字体时先 `await loadFontFamily` 再 `scheduleRender(true)`。`registerFonts()`/`loadBootFonts()` 用 `_hasFamily(fam)`（前缀匹配）判重。

## 左栏（一体化导入面板 + WPS 式工具栏）
顶部工具栏（对应 WPS「开始」选项卡）**分两行**、分组排布，窄栏也不溢出：
- 第 1 行 `.tb-row`：中文字体下拉 + 英文字体下拉（`.font-select` 用 `flex:1 1 108px` 等宽并排）+ 字号数字框 + `px`。
- 第 2 行 `.tb-row`：B/I/U（`.fmt-btn`，带边框/圆角/`aria-pressed` 选中态）· `.tool-sep` · 字色 · `.tool-sep` · 缩放滑块 · 右端 `.queue-seg{margin-left:auto}` 的 `[单篇|批量]`。
- 外层 `.input-toolbar{flex-direction:column;overflow:hidden}`，每行 `.tb-row{flex-wrap:wrap}`。**切勿再把这些控件塞进单个不可换行的 flex 组**（历史坑：总宽 ≈600px > 左栏 ≈477px → 横向溢出到中栏）。
工具栏下方是 `[导入|编辑]` 页签：**默认停在「导入」页**，该页整块是**一体化导入面板** `#dropCard`（点卡片任意位置弹文件选择（多选）；`#dropzone` 整列可拖入；卡片下方「粘贴文本 / 识别图片」两个文字入口）。导入完成自动切到「编辑」页；「编辑」页是 Markdown/LaTeX 文本框，批量队列也挂在「编辑」页下。
- 面板可见性统一由 `js/app.js` 的 `syncPanels()` 单点控制 `hidden`（导入页 / 编辑器 `#editorWrap` / 队列 `#queuePanel`），避免作者样式的 `display` 覆盖 `[hidden]`。
- **字号是 `<input type="number">` 数字框**（12–96），由 `bindFontSize()` 绑定，**不是滑杆**。
- 旧的「只读预览」视图与三个并排导入按钮均已删除。
- 测试文件 `tests/e2e.html` 内嵌了一份**左栏 + 右栏 DOM 副本**：改 DOM 结构时必须同步改它，否则 e2e 与真实页面不一致。

## 右栏（预览列）
头部 `col-head` 只留 **状态徽标 `#busy` + 自动开关**；动作按钮全在底部 `.preview-foot`（翻页 `.pager` + `#regenerate` + `#exportPng` + `#exportPdf`）。画布区 `.preview-stage` 用点阵网格底纹；空状态 `.preview-empty` 分级（`.pe-ico/.pe-title/.pe-sub/.pe-hint`）。

## 状态
全部内存态；队列结果按 `settingsHash` 缓存（`js/queue.js`）；刷新即清空。