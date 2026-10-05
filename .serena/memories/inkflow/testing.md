# InkFlow 测试

三套测试均用 headless Chrome 跑，结果写在 `<pre>` 的 JSON 里。

## 运行命令
```bash
CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
# 单元/集成（36 项）
"$CHROME" --headless=new --disable-gpu --no-sandbox --dump-dom --virtual-time-budget=100000 "file:///D:/转手写字体/tests/run-tests.html"
# 准确率审计（42 篇 × 9 项 = 378）
"$CHROME" ... --virtual-time-budget=200000 "file:///D:/转手写字体/tests/accuracy.html"
# 端到端 UI（29 项）—— 需 ~520s，用 --virtual-time-budget=460000
"$CHROME" ... --virtual-time-budget=460000 "file:///D:/转手写字体/tests/e2e.html"
```

## 结果标记
- 单元：`<pre id="results">` JSON `{total,pass,fail,results:[{name,pass,detail}]}`（字段是 **pass** 不是 ok）。
- 准确率：`<pre id="r">` 的 `ACC_JSON`。
- e2e：追加 `<pre id="e2e-results">`，前缀 `E2E_JSON:`。

## e2e 主体同步
`tests/e2e.html` 内嵌一份 index.html 的 body。**改了 index.html 的 DOM 必须重新同步 e2e 的 body**，否则结构断言失准。同步法：截取 `index.html` 的 `<body>…<script>` 之间内容，按 `[...idx.matchAll(/<script src="([^"]+)"/g)]` 原顺序重发 `<script src="../…">`。

## 最近一次基线（本轮，全绿）
单元 **36/36**、e2e **29/29**、准确率 **378/378（100%）**；网络请求/本地存储 **0/0**。
> e2e 自本轮起包含「导入页 / 编辑器 / 队列 三者互斥」与「导入 / 编辑 页签切换 + 字号为数字框」两条结构断言。

## 截图
`tests/out/*.png`（本地复核用，大部分 gitignore；只保留少量入库）。临时探针页用完即删，不要留库。