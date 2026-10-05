/* 自动生成的准确率测试语料 */
window.InkCorpus = [
 {
  "name": "quadratic",
  "md": "# 一元二次方程\n\n对于 $ax^2+bx+c=0\\ (a\\neq 0)$，求根公式为：\n\n$$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$\n\n判别式 $\\Delta=b^2-4ac$。"
 },
 {
  "name": "frac-inline",
  "md": "分数 $\\frac{1}{2}$ 与 $\\dfrac{3}{4}$ 以及 $\\tfrac{5}{6}$ 混排。"
 },
 {
  "name": "frac-nested",
  "md": "嵌套分式 $\\frac{\\frac{a}{b}}{\\frac{c}{d}}$ 与 $\\cfrac{1}{1+\\cfrac{1}{1+x}}$。"
 },
 {
  "name": "sqrt",
  "md": "根式 $\\sqrt{2}$、$\\sqrt[3]{x+1}$、$\\sqrt{x^2+y^2}$、$\\sqrt{\\sqrt{a}}$。"
 },
 {
  "name": "scripts",
  "md": "上下标 $x_1^2$、$a_{n+1}^{m-1}$、$x^{y^{z}}$、${}_nC_k$。"
 },
 {
  "name": "bigop",
  "md": "求和 $\\sum_{i=1}^{n} i^2$，连乘 $\\prod_{k=1}^{m} k$，极限 $\\lim_{x\\to 0}\\frac{\\sin x}{x}=1$。"
 },
 {
  "name": "integral",
  "md": "积分 $\\int_0^1 x^2\\,\\mathrm{d}x=\\frac{1}{3}$，二重 $\\iint_D f\\,\\mathrm{d}A$，环路 $\\oint_C \\vec{F}\\cdot\\mathrm{d}\\vec{r}$。"
 },
 {
  "name": "matrix",
  "md": "矩阵 $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$，行列式 $\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}=-2$。"
 },
 {
  "name": "cases",
  "md": "分段函数 $f(x)=\\begin{cases} x^2 & x>0 \\\\ 0 & x\\le 0 \\end{cases}$。"
 },
 {
  "name": "greek",
  "md": "希腊字母 $\\alpha\\beta\\gamma\\delta\\epsilon\\theta\\lambda\\mu\\pi\\sigma\\phi\\omega\\Delta\\Omega$。"
 },
 {
  "name": "relation",
  "md": "关系符 $a\\neq b$，$x\\leq y$，$z\\geq w$，$p\\approx q$，$m\\equiv n$，$s\\propto t$。"
 },
 {
  "name": "arrow",
  "md": "箭头 $a\\to b$，$c\\Rightarrow d$，$e\\Leftrightarrow f$，$g\\mapsto h$。"
 },
 {
  "name": "textmath",
  "md": "文本 $\\text{当 } x>0 \\text{ 时}$，$\\mathrm{d}x$，$\\mathbf{v}$，$\\mathbb{R}$。"
 },
 {
  "name": "operator",
  "md": "算子 $\\sin\\theta$、$\\cos 2x$、$\\log_a b$、$\\ln x$、$\\max\\{a,b\\}$。"
 },
 {
  "name": "binom",
  "md": "组合数 $\\binom{n}{k}=\\frac{n!}{k!(n-k)!}$，阶乘 $5!=120$。"
 },
 {
  "name": "accent",
  "md": "向量 $\\vec{F}=m\\vec{a}$，导数 $\\dot{x}$，$\\hat{y}$，均值 $\\bar{x}$，$\\overline{AB}$。"
 },
 {
  "name": "bigdelim",
  "md": "大括号 $\\left(\\frac{a}{b}\\right)$，$\\left[\\frac{1}{2}\\right]$，$\\left\\{\\frac{x}{y}\\right\\}$。"
 },
 {
  "name": "aligned",
  "md": "$$\\begin{aligned} a &= b+c \\\\ &= d+e \\end{aligned}$$"
 },
 {
  "name": "longformula",
  "md": "$$S=\\frac{1}{2}at^2+v_0t+s_0=\\frac{1}{2}\\cdot 9.8\\cdot 3^2+12\\cdot 3+5=44.1+36+5=85.1$$"
 },
 {
  "name": "cjk-mixed",
  "md": "已知 $\\Delta=b^2-4ac$，当 $\\Delta>0$ 时方程有两个不相等的实数根，此时 $x_1+x_2=-\\frac{b}{a}$。"
 },
 {
  "name": "md-head",
  "md": "# 一级标题\n\n## 二级标题\n\n### 三级标题\n\n正文内容。"
 },
 {
  "name": "md-list",
  "md": "- 第一项\n- 第二项\n  - 嵌套项\n\n1. 有序一\n2. 有序二"
 },
 {
  "name": "md-code",
  "md": "代码如下：\n\n```python\ndef f(x):\n    return x**2\n```\n\n结束。"
 },
 {
  "name": "md-table",
  "md": "| 符号 | 含义 |\n|---|---|\n| $\\Delta$ | 判别式 |\n| $\\pi$ | 圆周率 |"
 },
 {
  "name": "md-hr",
  "md": "上文\n\n---\n\n下文"
 },
 {
  "name": "edge-empty",
  "md": ""
 },
 {
  "name": "edge-space",
  "md": "   \n\n  \n"
 },
 {
  "name": "edge-onlymath",
  "md": "$$E=mc^2$$"
 },
 {
  "name": "edge-consec",
  "md": "$a$$b$$c$$d$"
 },
 {
  "name": "edge-longword",
  "md": "这是一个超长英文单词 supercalifragilisticexpialidociousandmore 用于测试换行行为。"
 },
 {
  "name": "edge-manyinline",
  "md": "设 $a=1$，$b=2$，$c=3$，$d=4$，$e=5$，$f=6$，$g=7$，$h=8$，求 $a+b+c+d+e+f+g+h$ 的值。"
 },
 {
  "name": "unicode",
  "md": "符号 ° ± × ÷ ≠ ≤ ≥ ∞ ∑ ∫ √ π Ω 与 emoji 🎯 混排。"
 },
 {
  "name": "physics",
  "md": "# 物理\n\n牛顿第二定律 $\\vec{F}=m\\vec{a}$，动能 $E_k=\\frac{1}{2}mv^2$，势能 $E_p=mgh$。"
 },
 {
  "name": "chem",
  "md": "# 化学\n\n反应 $2H_2+O_2\\to 2H_2O$，浓度 $c=\\frac{n}{V}$，$K_a=\\frac{[H^+][A^-]}{[HA]}$。"
 },
 {
  "name": "geometry",
  "md": "# 几何\n\n勾股定理 $a^2+b^2=c^2$，圆面积 $S=\\pi r^2$，球体积 $V=\\frac{4}{3}\\pi r^3$。"
 },
 {
  "name": "stats",
  "md": "# 统计\n\n均值 $\\bar{x}=\\frac{1}{n}\\sum_{i=1}^{n}x_i$，方差 $\\sigma^2=\\frac{1}{n}\\sum(x_i-\\bar{x})^2$。"
 },
 {
  "name": "linalg",
  "md": "# 线代\n\n$A\\mathbf{x}=\\lambda\\mathbf{x}$，$\\det(A-\\lambda I)=0$，$A^{-1}=\\frac{1}{\\det A}A^{*}$。"
 },
 {
  "name": "series",
  "md": "# 级数\n\n$$e^x=\\sum_{n=0}^{\\infty}\\frac{x^n}{n!}=1+x+\\frac{x^2}{2!}+\\cdots$$"
 },
 {
  "name": "trig",
  "md": "# 三角\n\n$\\sin^2\\theta+\\cos^2\\theta=1$，$\\sin(\\alpha\\pm\\beta)=\\sin\\alpha\\cos\\beta\\pm\\cos\\alpha\\sin\\beta$。"
 },
 {
  "name": "ineq",
  "md": "# 不等式\n\n$a^2+b^2\\geq 2ab$，$\\frac{a+b}{2}\\geq\\sqrt{ab}$，$|x+y|\\leq|x|+|y|$。"
 },
 {
  "name": "mixed",
  "md": "# 综合练习\n\n1. 求解 $x^2-5x+6=0$\n2. 计算 $\\int_0^{\\pi}\\sin x\\,\\mathrm{d}x$\n3. 证明 $\\sum_{k=1}^{n}k=\\frac{n(n+1)}{2}$\n\n$$\\lim_{n\\to\\infty}\\left(1+\\frac{1}{n}\\right)^n=e$$"
 },
 {
  "name": "multipage",
  "md": "第 1 题：设 $x_0^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 2 题：设 $x_1^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 3 题：设 $x_2^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 4 题：设 $x_3^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 5 题：设 $x_4^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 6 题：设 $x_5^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 7 题：设 $x_6^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 8 题：设 $x_7^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 9 题：设 $x_8^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 10 题：设 $x_9^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 11 题：设 $x_10^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 12 题：设 $x_11^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 13 题：设 $x_12^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 14 题：设 $x_13^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 15 题：设 $x_14^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 16 题：设 $x_15^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 17 题：设 $x_16^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 18 题：设 $x_17^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 19 题：设 $x_18^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 20 题：设 $x_19^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 21 题：设 $x_20^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 22 题：设 $x_21^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 23 题：设 $x_22^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 24 题：设 $x_23^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 25 题：设 $x_24^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 26 题：设 $x_25^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 27 题：设 $x_26^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 28 题：设 $x_27^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 29 题：设 $x_28^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 30 题：设 $x_29^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 31 题：设 $x_30^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 32 题：设 $x_31^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 33 题：设 $x_32^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 34 题：设 $x_33^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 35 题：设 $x_34^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 36 题：设 $x_35^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 37 题：设 $x_36^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 38 题：设 $x_37^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 39 题：设 $x_38^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 40 题：设 $x_39^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 41 题：设 $x_40^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 42 题：设 $x_41^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 43 题：设 $x_42^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 44 题：设 $x_43^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 45 题：设 $x_44^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 46 题：设 $x_45^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 47 题：设 $x_46^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 48 题：设 $x_47^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 49 题：设 $x_48^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 50 题：设 $x_49^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 51 题：设 $x_50^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 52 题：设 $x_51^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 53 题：设 $x_52^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 54 题：设 $x_53^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 55 题：设 $x_54^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 56 题：设 $x_55^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 57 题：设 $x_56^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 58 题：设 $x_57^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 59 题：设 $x_58^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。\n\n第 60 题：设 $x_59^2+y^2=r^2$，求 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}$。"
 }
];
