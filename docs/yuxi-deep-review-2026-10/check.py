"""Compare style metrics between orig/chNNN.md and chNNN.md. Usage: python3 check.py 1 2 3"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
WORDS = ["如同", "宛如", "仿佛", "轻轻", "缓缓", "微微", "彻底", "绝对", "死死", "冰冷",
         "在这一刻", "这一瞬间", "大幕", "千古", "因果", "轰然"]
BANNED = ["白道伟", "常令可", "常梦云", "拾遗", "先见", "观微", "素问", "光幕", "前世", "今生",
          "命中注定", "四百年", "挚爱", "第七幕", "十支红烛", "大行皇帝"]


def body(path):
    text = path.read_text()
    return re.sub(r"<!--.*?-->", "", text)


def metrics(text):
    chars = len(re.sub(r"\s", "", text))
    narr = re.sub(r"[“「][^”」]*[”」]", "", text)
    return {
        "字数": chars,
        "！": text.count("！"),
        "叙述！": narr.count("！"),
        **{w: text.count(w) for w in WORDS},
    }


for n in sys.argv[1:]:
    name = f"ch{int(n):03}.md"
    new_path = HERE / name
    o = metrics(body(HERE / "orig" / name))
    nw = metrics(body(new_path)) if new_path.exists() else None
    print(f"== {name}")
    for k in o:
        if nw is None or o[k] or nw[k]:
            print(f"  {k}: {o[k]} -> {nw[k] if nw else '-'}")
    if nw:
        text = body(new_path)
        hits = [w for w in BANNED if w in text]
        print("  违禁词:", hits or "无")
        tail = text.strip().splitlines()[-1]
        print("  章末:", tail[-80:])
