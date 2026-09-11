# -*- coding: utf-8 -*-
import json

with open("public/novels/yuxi-gongci.json", "r", encoding="utf-8") as f:
    novel = json.load(f)

for cid in [159, 160, 161]:
    c = novel["chapters"][cid - 1]
    print(f"\n==================== Ch {cid}: {c['title']} ====================")
    blocks = c.get("blocks", [])
    for b in blocks[:4]:
        print(">>", b.get("text", "")[:120])
    print("...")
    for b in blocks[-3:]:
        print(">>", b.get("text", "")[:120])

