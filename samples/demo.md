# 一元二次方程 求解与验证

## 一、求根公式推导

对于一般形式 $ax^2+bx+c=0\ (a\neq 0)$，两边同除以 $a$：

$$x^2+\frac{b}{a}x+\frac{c}{a}=0$$

配方得 $\left(x+\dfrac{b}{2a}\right)^2=\dfrac{b^2-4ac}{4a^2}$，于是：

$$x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}$$

其中 $\Delta=b^2-4ac$ 称为判别式。

## 二、例题

求解 $2x^2-4x-6=0$。

1. 计算判别式：$\Delta=(-4)^2-4\times 2\times(-6)=16+48=64>0$
2. 代入求根公式：$x=\dfrac{4\pm\sqrt{64}}{4}=\dfrac{4\pm 8}{4}$
3. 得 $x_1=3,\ x_2=-1$

## 三、结论

当 $\Delta>0$ 时有两个不等实根；$\Delta=0$ 时有两个相等实根；$\Delta<0$ 时无实根。
