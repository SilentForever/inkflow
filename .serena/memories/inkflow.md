# InkFlow 墨流 · 数学/学科答案文档转手写体

纯前端静态 SPA，位于 `D:\转手写字体`。把数学/学科答案文档（Markdown+LaTeX、PDF、Word、图片）一键转成逼真手写体。

## 硬约束（不可违反）
- **纯浏览器本地处理**：无后端、无 fetch/XHR/Beacon/WebSocket、无 localStorage/sessionStorage/cookie；刷新即清空（有自动化断言）。
- **必须能双击 `index.html`（file://）运行** → 全部用经典 `<script>` + 全局命名空间；**禁 ES Module / 运行时 fetch / Worker**。图片 OCR（tesseract）需 http(s)，file:// 下按钮置灰。
- 字体只收 OFL / 免费可商用。

## 仓库与部署
- GitHub: https://github.com/SilentForever/inkflow （public, `main`）
- Vercel 项目 `inkflow`，id `prj_nS658ulLryf18tIbVvAGWELxYPib`
- 生产别名：`ink.1funnytime.xyz`、`inkflow-woad.vercel.app`
- **推 `main` 后 Vercel Git 集成自动部署**；线上核验：`vercel ls` / `vercel inspect <url>`。

## 文档
- `index.html` 应用入口；`计划书.md` 权威设计与逐轮记录（第二十三章为最新：加载提速 + 左栏一体化面板 + 右栏精修）；`README.md` 面向用户；`DEPLOY.md` 部署指南。
- `tools/ttf2woff2.py` 字体压缩脚本（构建期用，不入运行时）。

## 相关记忆
- `mem:inkflow/architecture`、`mem:inkflow/pitfalls`、`mem:inkflow/testing`