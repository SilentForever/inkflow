# InkFlow 坑与教训（都踩过）

## 运行/测试环境
- **虚拟时间陷阱**：headless Chrome `--virtual-time-budget` 下 `Date.now()` 不随 `await` 前进；`while(Date.now()-t0<500){}` 忙等会**死循环**（整轮超时无输出）→ 必须用 `await sleep(ms)`。
- headless Chrome 跑完长测试（e2e）后**可能不自动退出**（挂住 15min+，但 DOM 结果其实已生成）。判断方法：采样 `wmic process ... UserModeTime`，CPU 归零 = 已卡住；杀掉进程后管道会 flush 出结果。用 `--dump-dom` 取 `<pre>` 里的 JSON。
- 本机 `file://` 下 `@font-face`/classic `<script>`/Canvas/Blob URL 可用；**ES Module、fetch/XHR、Worker 被禁**。

## CSS
- `hidden` 属性会被作者样式 `display:flex` 覆盖 → 全局 `[hidden]{display:none !important;}`。
- 网格行必须确定高度：`.main{grid-template-rows:minmax(0,1fr)}`，否则 flex:1 子项塌成 0。
- 窄屏（≤820px）单栏堆叠时左栏会塌成 0 高度 → 给 `.col` 确定高度 `min(82vh,760px)`。
- **左栏工具栏溢出**：若把「字体×2+字号+B/I/U+字色+缩放+模式」塞进**一个不可换行的 flex 组**，子项总宽 ≈600px > 左栏 ≈477px → 整组横向溢出到中栏、字号框被压、字色/缩放换行。正解：外层 `flex-direction:column` 拆两行 `.tb-row`，每行各自 `flex-wrap:wrap`。自查：`toolbar.scrollWidth > toolbar.clientWidth`。

## 字体
- **分批加载后选非默认字体不生效**：`boot()` 后台补齐回调曾用错键名 `state.fontCJK`（真名 `state.fontKeyCJK`）→ 条件永假不重绘，选到未加载字体就画成回退字体。改键名后修复。
- **按需加载**：字体下拉 `pickFont()` 选到未加载字体时先 `await loadFontFamily(fam)` 再重绘，不要假设全部字体首屏已就绪。
- **`document.fonts.check("16px X")` 不可靠**（对未注册家族也返回 true）；要枚举用 `Array.from(document.fonts).map(f=>f.family+"/"+f.status)`（`[].map.call` 对 FontFaceSet 无效，它没有 `length`）。**可靠的存在性探测**：把族名与 `monospace`/`sans-serif` 并排测量同串文本，两者宽度都与通用族完全一致 ⇒ 未安装（见 `fontAvailable`）。
- **系统字体不一定装了**：如本机无 `STXINGKA.TTF`，选「华文行楷」会静默回退到 CSS 链里的 `KaiTi`，看起来"选了没反应"。→ 下拉必须过滤掉 `!fontAvailable` 的系统字体。
- **公式字体链曾只挂中文字体**：公式里全是数字/拉丁，导致「换英文字体时公式纹丝不动」。正解：`mathFontsOf` 顺序 = 英文字体 → 中文字体 → 拉丁兜底 → 中文兜底；`formulaScaleOf` 也用 `fontKeyLat`。
- **探针脚本必须放在项目目录内**（如 `D:\转手写字体\_probe.html`），放 `D:\tmp\` 会让相对 `src="../js/..."` 404，页面不 boot。

## 公式
- 旧实现用墨迹高度反推字号 → 括号/根号被拉大；已改为变换矩阵推导（见 `mem:inkflow/architecture`）。
- 公式墨色必须与正文一致（`textColorOf(s)`）；有回归断言。
- `$'`/`$&` 等替换串会破坏代码 → 用 `split().join()`。
- MathJax SVG 里的 transform 必须**追加**在原有 transform 之后，不能覆盖（否则丢失字形定位）。

## 本机网络/凭据（Windows 主机 ARTlab）
- 本地代理 `127.0.0.1:7897` 经常未启动 → 走代理的请求全挂；可直连（example.com 可通）。
- **`github.com` / `api.github.com` 本机 DNS 解析失败**（npm registry 正常）。绕过：`curl --resolve api.github.com:443:140.82.112.6`；`git` 走 SSH（见下）。
- **推送 GitHub**：gh token 会失效；SSH 走 IP 可用（已认证 `SilentForever`）。已写 `~/.ssh/config` 的 `Host github.com → HostName 140.82.112.3` + `git config url."git@github.com:".insteadOf "https://github.com/"`。
- **Vercel**：`%APPDATA%\com.vercel.cli\Data\auth.json` 的 token 直连 API 报 `invalidToken`，但 **CLI 会自动刷新** → 用 `vercel ls/inspect` 而非直连 API。
- Vercel 边缘 IP（`76.76.21.x`）直连 TLS 被重置；`ink.1funnytime.xyz` 等域名本机不可直访。
- 云浏览器后端不可达（超时）→ 线上核验改用 Vercel API/CLI 对比 commit。

## 文档维护
- 改字体/字号后要同步 README/DEPLOY/计划书里的数字（字体数、加载体积、符号覆盖率），历史轮次记录不要改。