"""Splice revised chapters (chNNN.md) with the remaining old chapters into the live novel json.

Usage: python3 build_live.py <revised_count> <first_old_kept>
  e.g. python3 build_live.py 66 93  -> new 1..66 from chNNN.md, then old 93..200 renumbered 67..
Writes public/novels/yuxi-gongci.json in the repo root and prints the old->new id map for redirects.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
ROOT = HERE.parent.parent
LIVE = ROOT / "public/novels/yuxi-gongci.json"


def visible(text):
    return len(re.sub(r"\s", "", text))


def md_chapter(n):
    lines = (HERE / f"ch{n:03}.md").read_text(encoding="utf-8").strip().split("\n")
    title = lines[0].lstrip("#").strip()
    body = "\n".join(lines[1:])
    blocks = []
    for para in re.split(r"\n\s*\n", body):
        para = re.sub(r"<!--.*?-->", "", para, flags=re.S).strip()
        if not para:
            continue
        if para == "---":
            para = "＊　＊　＊"
        blocks.append({"type": "p", "text": para})
    return title, blocks


def main():
    revised, first_old = int(sys.argv[1]), int(sys.argv[2])
    old = json.loads(LIVE.read_text(encoding="utf-8"))
    chapters = []
    for n in range(1, revised + 1):
        title, blocks = md_chapter(n)
        chapters.append({"id": n, "title": title, "blocks": blocks})
    mapping = {}
    for c in old["chapters"]:
        if c["id"] < first_old:
            continue
        new_id = len(chapters) + 1
        mapping[c["id"]] = new_id
        title = re.sub(r"^第\d+章", f"第{new_id}章", c["title"])
        chapters.append({"id": new_id, "title": title, "blocks": c["blocks"]})
    for c in chapters:
        c["wordCount"] = sum(visible(b.get("text", "")) for b in c["blocks"])
    out = {"id": old["id"], "chapters": chapters, "totalWords": sum(c["wordCount"] for c in chapters)}
    LIVE.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"chapters": len(chapters), "totalWords": out["totalWords"], "map": mapping}, ensure_ascii=False))


if __name__ == "__main__":
    main()
