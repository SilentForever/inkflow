import os, sys, glob
from fontTools.ttLib import TTFont

fonts_dir = r"D:\转手写字体\fonts"
ttfs = sorted(glob.glob(os.path.join(fonts_dir, "*.ttf")))
tot_before = tot_after = 0
for p in ttfs:
    b = os.path.getsize(p)
    out = os.path.splitext(p)[0] + ".woff2"
    f = TTFont(p)
    f.flavor = "woff2"
    f.save(out)
    a = os.path.getsize(out)
    tot_before += b; tot_after += a
    print("%-40s %8.2fMB -> %7.2fMB  (%.0f%%)" % (os.path.basename(p), b/1e6, a/1e6, 100*a/b))
print("-" * 72)
print("TOTAL %.2fMB -> %.2fMB (%.0f%% of original, saved %.2fMB)" % (tot_before/1e6, tot_after/1e6, 100*tot_after/tot_before, (tot_before-tot_after)/1e6))
