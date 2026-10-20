"""Assemble junction3d.html: the 3D template + the rules engine sliced verbatim from junction.html.

Usage: python3 tools3d/build.py junction.html tools3d/junction3d.template.html junction3d.html
"""
import sys
src = open(sys.argv[1]).read(); tpl = open(sys.argv[2]).read()
def cut(a, b):
    i = src.index(a); j = src.index(b, i)
    return src[i:j].rstrip() + "\n"
style = src[src.index("<style>") + 7:src.index("</style>")].strip()
data = cut("/* ===== data ===== */", "/* ===== state ===== */")
assert data.count("].map(shape);") == 1 and data.count("const BLACKSEA=shape(") == 1
data = data.replace("].map(shape);", "];").replace("const BLACKSEA=shape(", "const BLACKSEA=(")
parts = {
    "/*@@STYLE@@*/": style,
    "/*@@DATA@@*/": data,
    "/*@@PAYMENT@@*/": cut("/* ===== payment ===== */", "/* ===== turn flow ===== */"),
    "/*@@HUMAN@@*/": cut("function afterDraw(){", "/* ===== bots ===== */"),
    "/*@@WANTED@@*/": cut("function wanted(p){", "function botTurn(p){"),
    "/*@@BOTTICKETS@@*/": cut("function botTickets(p){", "function botDraw(p,want){"),
    "/*@@SCORING@@*/": cut("/* ===== scoring ===== */", "/* ===== sheets ===== */"),
    "/*@@SHEETS@@*/": cut("/* ===== sheets ===== */", "function rulesHTML(){"),
    "/*@@OPENROUTE@@*/": cut("function openRoute(i){", "document.addEventListener('keydown'"),
}
for k, v in parts.items():
    assert tpl.count(k) == 1, k
    tpl = tpl.replace(k, v)
open(sys.argv[3], "w").write(tpl)
print("wrote", sys.argv[3], len(tpl.splitlines()), "lines")
