# 部署到 Vercel

InkFlow 是**纯静态站点**：没有后端、没有构建步骤、没有环境变量、没有服务端函数。
理论上任何静态托管都能直接跑（Vercel / Netlify / Cloudflare Pages / GitHub Pages / 对象存储）。

---

## 为什么可以直接部署

| 检查项 | 状态 |
|---|---|
| 入口文件 | `index.html` 位于**仓库根目录**（Vercel 默认根目录即输出目录） |
| 构建命令 | **不需要**（Framework Preset 选 `Other`，Build Command 留空，Output Directory 留空/填 `.`） |
| 资源路径 | 全部为**相对路径**（`css/`、`js/`、`fonts/`、`vendor/`），根目录或子路径部署都能定位 |
| 字体定位 | `FONT_BASE` 由 `document.currentScript.src` 推导，部署在任意域名/子路径下都能正确加载字体 |
| 模块系统 | 全部为**经典 script**（无 ES Module），因此没有 MIME / CORS 的额外要求 |
| 运行时网络 | **零**：不发 fetch / XHR / Beacon / WebSocket |
| 本地存储 | **零**：不写 localStorage / sessionStorage / cookie（刷新即清空，符合隐私承诺） |
| 字体跨域 | 同源加载，无 CORS 问题 |

---

## 方式一：GitHub 导入（推荐）

```bash
cd D:/转手写字体
git init
git add .
git commit -m "InkFlow: 数学答案转手写体（纯前端）"
git branch -M main
git remote add origin https://github.com/<你的账号>/inkflow.git
git push -u origin main
```

然后：

1. 打开 <https://vercel.com/new>；
2. **Import Git Repository** 选中该仓库；
3. Framework Preset 选 **Other**；
4. Build Command / Output Directory **全部留空**；
5. 点 **Deploy**，约 10 秒后拿到 `https://<项目名>.vercel.app`。

> 之后每次 `git push` 都会自动重新部署。

---

## 方式二：Vercel CLI（不建仓库）

```bash
npm i -g vercel
cd D:/转手写字体
vercel          # 首次：登录 + 按提示创建项目（一路回车，全部默认即可）
vercel --prod   # 发布到生产环境
```

CLI 会自动识别为静态站点并直接上传整个目录，**不会**执行构建。

---

## 方式三：网页拖拽（最快，无需 Git / CLI）

把整个项目文件夹直接拖到 <https://vercel.com/new> 的上传区域即可。

> 注意：拖拽上传**不要**包含 `node_modules` 与 `.git`；本项目二者都没有，直接拖即可。

---

## 仓库根目录会暴露的文件

Vercel 会把仓库根目录下的所有文件公开。以下文件是**文档/测试**，不影响应用运行，
但如果不希望被访问，可在 Vercel 项目里加 **Ignored Build Step** 或改用子目录部署：

```
计划书.md  README.md  tests/  samples/
```

如需精简，最省事的做法是新建一个空仓库，只提交这些：

```
index.html  css/  js/  fonts/  vendor/  vercel.json
```

---

## 自定义域名 / 子路径

- **自定义域名**：Vercel 项目 → Settings → Domains → 添加并在 DNS 处按提示解析；
- **子路径部署**（如 `example.com/inkflow/`）：由于所有引用都是相对路径，**无需改任何代码**，直接可用。

---

## 关于「图片识别」

浏览器**不允许 `file://` 页面创建 Worker 并 `importScripts`**，因此：

| 访问方式 | PDF / Word / 文本导入 | 图片 OCR |
|---|---|---|
| 双击 `index.html`（file://） | ✅ 可用 | ❌ 按钮置灰并提示 |
| 部署到 Vercel（https） | ✅ 可用 | ✅ 可用 |

所有依赖（pdf.js / mammoth / tesseract.js + 中英语言包）都已 vendor 到 `vendor/`，OCR 不访问任何外部网络。

---

## 部署后自检清单

打开 `https://<你的域名>/`，确认：

- [ ] 右上角两个徽章变为「字体已就绪 / 公式引擎已就绪」；
- [ ] 点「方程示例」，右侧出现带手写扭曲的公式；
- [ ] 切换字体（马善政 / 龙藏 / Caveat …）后中文与英文各自正常；
- [ ] 「导出 PNG」「导出 PDF」能下载文件；
- [ ] 刷新页面后内容全部消失（内存态，符合隐私设计）；
- [ ] DevTools → Network 面板：除本站资源外**没有任何第三方请求**；
- [ ] DevTools → Application：**没有** localStorage / sessionStorage / cookie 写入。

---

## 常见疑问

**Q：需要设置 `VERCEL_FORCE_NO_BUILD` 之类的环境变量吗？**
不需要。没有构建步骤，Vercel 检测不到 `package.json` 时会当作纯静态目录直接发布。

**Q：字体 21MB（WOFF2 压缩后）会不会超限？**
不会。Vercel 单次部署体积上限远大于此；且 `vercel.json` 已给 `/fonts`、`/vendor` 设了 7 天缓存，
首访之后不再重复下载。字体已全部转为 **WOFF2**（整包 47MB → 21MB），且**首屏只加载默认中英各一款（约 1.4MB）**，
其余字体后台补齐；PDF / Word / OCR 等重型组件按需加载。

**Q：还需要保留 `file://` 双击运行的能力吗？**
需要，且**已保留**：项目没有任何 ES Module 与运行时 fetch，双击 `index.html` 依然可用。
部署到 Vercel 只是多了一种分发方式，不改变本地用法。
