# -*- coding: utf-8 -*-
import json

with open("public/novels/yuxi-gongci.json", "r", encoding="utf-8") as f:
    novel = json.load(f)

for idx, c in enumerate(novel["chapters"]):
    print("{:03d} | ID {:03d} | {} | {} words".format(idx, c.get("id"), c.get("title"), c.get("wordCount")))
