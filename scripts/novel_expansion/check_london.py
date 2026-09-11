# -*- coding: utf-8 -*-
import json, re

with open("public/novels/yuxi-gongci.json", "r", encoding="utf-8") as f:
    novel = json.load(f)

for idx, c in enumerate(novel["chapters"]):
    text = "".join(b.get("text", "") for b in c.get("blocks", []))
    m = re.findall(r"(伦敦|雾都|维多利亚|泰晤士|蒸汽时代)", text)
    if m and idx < 195:
        print(f"Ch {c['id']} (idx {idx}): found {len(m)} matches: {set(m)}")

