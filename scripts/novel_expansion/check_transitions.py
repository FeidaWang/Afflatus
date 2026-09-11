# -*- coding: utf-8 -*-
import json

with open("public/novels/yuxi-gongci.json", "r", encoding="utf-8") as f:
    novel = json.load(f)

chapters = novel["chapters"]

def show_summary(idx):
    c = chapters[idx]
    print(f"\n=== Chapter {c['id']}: {c['title']} ===")
    blocks = c.get("blocks", [])
    if blocks:
        print("Start:", blocks[0].get("text", "")[:150])
        print("End:  ", blocks[-1].get("text", "")[:150])

# Inspect transitions
show_summary(39)   # Ch 40
show_summary(40)   # Ch 41
show_summary(158)  # Ch 159
show_summary(159)  # Ch 160
show_summary(160)  # Ch 161
show_summary(194)  # Ch 195
show_summary(195)  # Ch 196
show_summary(199)  # Ch 200

