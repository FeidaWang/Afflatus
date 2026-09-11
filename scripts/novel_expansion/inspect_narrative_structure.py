# -*- coding: utf-8 -*-
import json, re

with open("public/novels/yuxi-gongci.json", "r", encoding="utf-8") as f:
    novel = json.load(f)

chapters = novel["chapters"]
print("Total chapters:", len(chapters), "Total words:", novel.get("totalWords"))

# Check all chapter titles and word counts
under_10k = []
for idx, c in enumerate(chapters):
    cid = c.get("id")
    wc = c.get("wordCount", 0)
    title = c.get("title", "")
    if wc < 10000:
        under_10k.append((cid, title, wc))

print("Chapters under 10k words:", len(under_10k))
if under_10k:
    print("Under 10k sample:", under_10k[:5])

# Print representative titles across the 200 chapters
print("\n--- Key Milestone Chapters ---")
milestones = [1, 10, 25, 50, 75, 100, 125, 150, 175, 185, 190, 195, 196, 197, 198, 199, 200]
for m in milestones:
    if m <= len(chapters):
        c = chapters[m - 1]
        print("Ch {}: {} ({} words)".format(c.get("id"), c.get("title"), c.get("wordCount")))

