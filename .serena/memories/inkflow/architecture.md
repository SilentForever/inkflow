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
- **字体链** `mathFontsOf`（js/renderer.js）：**英文字体 → 中文字体 → 拉丁兜底(LATIN_FALLBACK) → 中文兜底(CJK_FALLBACK)**。公式里的数字/拉丁字形优先用**英文**字体，中文用中文字体；仍缺字符则保留 MathJax 原字形兜底（内容绝不丢失）。公式字号 `formulaScaleOf(s.fontKeyLat||s.fontKey)` 随**英文**字体自适应。**历史坑**：早期只挂中文字体链 → 换英文字体时公式纹丝不动。

## 字体
- **20 款内置（11 中文 + 9 英文）**，`fonts/` 为 WOFF2，共约 20.8MB。中文默认 `Zen Kurenaido`，拉丁默认 `Caveat`；中英双下拉分别选。
- 字体文件清单：`js/app.js` 的 `FONT_FILES`（20 条，`url` 均为 `*.woff2`）；字体定义：`js/renderer.js` 的 `FONTS`。
- **系统手写字体**（`FONTS` 里标 `sys:true`，`family` 为本机字族名，不打包）：英文 `Segoe Script`、`Segoe Print`、`Comic Sans MS`、`Gabriola`、`Ink Free`；中文 `华文行楷(STXingkai)`、`系统楷体(KaiTi)`。**下拉会隐藏本机没装的系统字体**（`fontsByLang` 里 `sys && !fontAvailable(family)` 跳过），避免"选了没反应"的静默回退。`fontAvailable(family)`：族名与 `monospace`/`sans-serif` 并排测量同串文本，两者宽度都与通用族完全一致 ⇒ 未安装。
- **字体按需加载**：`loadFontFamily(family)` 按 family 找到 `FONT_FILES` 条目并 `loadFontEntry`；系统字体返回 null（无需加载）。字体下拉 `pickFont()` 选到**尚未加载**的字体时先 `await loadFontFamily` 再 `scheduleRender(true)`。`registerFonts()`/`loadBootFonts()` 用 `_hasFamily(fam)`（前缀匹配）判重。
- 本机实测下拉：中文 11（内置 11，华文行楷未装被隐藏）、英文 14（内置 9 + 系统 5）。

## 左栏（导入面板：空态卡片 ↔ 文档列表 + WPS 式工具栏）
顶部工具栏（对应 WPS「开始」选项卡）**分两行**、分组排布，窄栏也不溢出：
- 第 1 行 `.tb-row`：**中文**字体下拉 + **英文**字体下拉（每个 `.font-select` 包在 `.font-field` 里、前面有可见的 `.font-lbl`「中文 / 英文」小标签——**两个下拉必须带可见标签**，不能只靠位置/`aria-label` 区分）+ 字号数字框 + `px`。
- 第 2 行 `.tb-row`：字色 · `.tool-sep` · 缩放滑块 · `.tool-sep` · 「**按原文大小**」开关 `#sizeFromSource`（`.sfs-toggle`，默认开） · `.tool-sep` · 「**按原页分页**」开关 `#pageAnchor`（`.sfs-toggle`，默认开）。**B/I/U 按钮已随编辑器一并移除**（它们只作用于编辑器，导入内容不带加粗/斜体/下划线）。
- 外层 `.input-toolbar{flex-direction:column;overflow:hidden}`，每行 `.tb-row{flex-wrap:wrap}`。**切勿再把这些控件塞进单个不可换行的 flex 组**（历史坑：总宽 ≈600px > 左栏 ≈477px → 横向溢出到中栏）。
**左栏只有「导入」一种输入方式**（「编辑」页签与单篇编辑器已移除），面板**随有无文档自动切换两种形态**：
- **空态**：只显示 `#dropCard`（虚线拖放卡片；点它任意位置弹文件选择（多选）；卡片下方「粘贴文本 / 识别图片」两个文字入口）；列表 `#queuePanel` 隐藏。
- **列表态**：`#dropCard` 收起（`.dropzone-card[hidden]{display:none!important}` 抵消其 `display:flex`），换成 `#queuePanel` 文档列表——`.queue-head`（标题 + `#queueCount` + 右侧 `.queue-add`「＋ 添加」按钮）+ `.queue-bar`（全部转写/停止/全选/导出选中/清空）+ `#queueList`（每行可勾选/移除，点某行 = `showQueueItem` 切换右侧预览）+ `.drop-hint`「拖拽文件到此处可继续添加」。
- **面板可见性由 `js/app.js` 的 `syncPanels()` 单点控制** `hidden`（`hasDocs = InkQueue.items().length>0` → 显示列表、隐藏卡片；否则反之）；`InkQueue.onChange` → `syncPanels()+renderQueueList()`。**切勿让作者样式的 `display` 覆盖 `[hidden]`**。
- **拖拽光效反馈**：`#dropzone` 拖入时加 `.over.dragging` → `#dropzone.dragging` 脉冲发光 `@keyframes drop-glow`（inset 描边+柔光），卡片/列表/`.drop-hint` 同步高亮；`drop`/`dragleave`/window `dragend`/`blur` 都要清类，避免残留。
- **字号是 `<input type="number">` 数字框**（12–96），由 `bindFontSize()` 绑定，**不是滑杆**。
- 旧的「只读预览」视图与三个并排导入按钮均已删除。
- 测试文件 `tests/e2e.html` 内嵌了一份**左栏 + 右栏 DOM 副本**：改 DOM 结构时必须同步改它，否则 e2e 与真实页面不一致。

## 输入与字号（唯一输入源 = `state.docText`）
- **没有编辑器**：`js/app.js` 用 `state.docText`（字符串）作唯一文档来源，`loadDocText(text)` 写入并 `scheduleRender(true)`；`clearAll`/`loadDemo` 都走它。
- **按原文大小转写**：导入器把「块字号 ÷ 文档正文字号 × 100」编码成块首标记 `\u0001F<pct>\u0001`（`InkParser.szMark`）；`InkParser.parse` 用 `/^\u0001F(\d+)\u0001/` 剥离并挂到块 `px`；`renderer.layoutBlocks` 用 `factor(b)=clamp(px/100,.5,2.4)` 定块字号，**行高/基线/内边距随 `ln.size` 缩放**（`metricsOf`/`lineHeightFor` 以 `ln.size` 为基准，勿再写死 `s.fontSize`）。开关 `state.sizeFromSource===false` 时 `doRender` 把块 `px` 清零 → 统一字号。
- **字号来源**：DOCX 解 ZIP 读 `word/document.xml` 的 `w:sz`（半磅）+ `styles.xml`；PDF 用 pdf.js `getTextContent()` 的 `transform[3]` 按行取最大字号；两者都以**全文字号众数当正文**再按比例打标记。Markdown/TXT 无字号信息。

## 多页 PDF / Word：按原页分页（页码锚定）
- 需求：多页 PDF/Word 导入后，右侧转写须**按原文档页码排序布局**，不把多页压成连续流。
- **同一套隐藏标记机制**新增**分页标记** `\u0001PG<n>\u0001`（`InkParser.pgMark(n)`）：导入器在**每页首个块前**写入；`InkParser.parse` 剥离后挂到块的 `pageStart`（1 基；0=无锚点）。**仅多页文档写标记，单页/Markdown/TXT 不写 → 保持旧行为**。
- `renderer.layoutBlocks`：把当前块的 `pageStart` 存到 `pageSt` 并随 `pushLine` 传到每行；`paginate(lines,s)` 遇 `ln.pageStart>0`（且 `s.pageAnchor!==false`）**先换新纸张再落笔**；`drawFurniture(...,srcPage)` 页码取该页首行的 `pageStart`（锚定原页号，否则用顺序页码）。
- **Word 分页**依据：`<w:br w:type="page"/>`、`<w:lastRenderedPageBreak/>`（Word 渲染分页）、段属性 `<w:pageBreakBefore/>`；**PDF 分页**依据 pdf.js 真实页边界（逐页 `getTextContent`）。计数存于 `paras[i].page`，文本用 `\n\n` 连接。
- 开关 `state.pageAnchor`（默认开）→ `toSettings()` → `paginate`；`hashSettings` 纳入 `pageAnchor`。队列项带 `pageCount`（`InkParser.pageMarks(text).length`），列表显示「（原文 N 页）」。

## 右栏（预览列）
头部 `col-head` 只留 **状态徽标 `#busy` + 自动开关**；动作按钮全在底部 `.preview-foot`（翻页 `.pager` + `#regenerate` + `#exportPng` + `#exportPdf`）。画布区 `.preview-stage` 用点阵网格底纹；空状态 `.preview-empty` 分级（`.pe-ico/.pe-title/.pe-sub/.pe-hint`）。

## 渲染：prepare（布局，一次）→ rasterizePage（按需光栅化）——懒渲染
- `renderer` 拆成两个 API：`prepare(blocks, s)` 只做**布局 + 公式预处理**（与分辨率无关，返回 `{lines,pages,mathMap,s,stats}`，**不含任何 canvas**）；`rasterizePage(layout, p, K)` 把**第 p 页**画成 canvas（K 倍超采样）。
- `render(blocks, s, opts)` 保留为兼容包装（prepare + 循环 rasterizePage，支持 `opts.scale`/`opts.onlyPage`），测试/准确率仍用它。
- **懒渲染动机**：A4 一页 canvas ≈ 8.7MB（1240×1754×4）；旧实现整篇常驻。现在**预览只光栅化当前页**（`app.paintPage` → `rasterizePage(curLayout, currentPage, 1)`），**队列只缓存 `layout`**（`queue.renderOne` 调 `prepare`，不再存 canvas）。实测 54 页文档常驻从 ~470MB 降到 ~9MB（-98%）。
- **导出仍整篇**（PDF 要全部页），但导出走 `renderHiRes`（`render(...,{scale:2})`）逐页高分辨率重绘——此时 canvas 数组是临时变量，导出后可回收。
- **坑**：`app.js` 的 `pages` 现在是**行数组的数组**（`layout.pages`），不是 canvas 数组；`paintPage` 必须经 `rasterizePage`。队列项字段由 `it.pages`（canvas 数组）改为 `it.layout`；`allPagesOf` 已删除（页数用 `it.layout.pages.length`）。**改这些名字时记得同步 `tests/e2e.html` 的 `Q.items()[0].layout` 断言**。

## 导出：超采样重渲染（真正高清，非拉伸）
- 预览画布固定 1240×1754（A4，K=1）；**导出时不复用预览画布**，而是 `InkRender.render(blocks, toSettings(), {scale:K})` 重新光栅化：画布尺寸 ×K、整体 `ctx.scale(K,K)`。**布局仍在基础坐标系计算 → 换行/分页与预览逐字一致**，只是位图真正更清晰。
- `js/app.js` 新增 `renderHiRes(text, opts)`；PNG 用 `{scale:3, onlyPage:currentPage}`（只画当前页，`renderer` 的 `opts.onlyPage` 跳过其余页，`stats.pages` 仍报总页数），PDF/批量用 `{scale:2}` + `exportPDF(..., {dpi:300})`。
- **坑**：旧实现是 `exportPNG(cv, …, 2)` 把 1240px 画布 `drawImage` 放大到 2480 → 只是变糊。实测同一最终分辨率下，超采样的拉普拉斯方差（高频能量）约为拉伸法的 **7.9×**（43 → 340）。
- 画布像素↔物理尺寸：`exportPDF` 按「画布像素 ÷ dpi」得物理尺寸，故 `dpi` 越高页面越清晰、物理大小不变；`renderer` 的 `K` 与 `exporter` 的 `dpi` 必须匹配（K=2 ↔ dpi=300）。

## 状态
全部内存态；队列结果按 `settingsHash` 缓存（`js/queue.js`）；刷新即清空。