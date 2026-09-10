#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit_batch29.py
Audit Batch 29 (Chapters 141 to 145) and novel integrity.
"""
import json, re, sys

NOVEL_PATH = "public/novels/yuxi-gongci.json"

FORBIDDEN_WORDS = [
    "法宝", "元婴", "金丹", "灵气", "修仙", "修真", 
    "仙人", "仙界", "神识", "魔道", "宗门", "洞府", 
    "飞升", "天劫", "渡劫", "道友"
]

def count_visible_chars(blocks):
    text = "".join(b.get("text", "") for b in blocks if isinstance(b, dict))
    return len(re.sub(r"\s+", "", text))

def main():
    print("=== STARTING AUDIT FOR BATCH 29 (Chapters 141 - 145) ===")
    with open(NOVEL_PATH, "r", encoding="utf-8") as f:
        novel = json.load(f)

    chapters = novel["chapters"]
    print(f"Total chapters in novel: {len(chapters)}")

    # 1. Audit Batch 29 Metrics
    print("\n--- BATCH 29 (Chapters 141 - 145) METRICS ---")
    batch_total = 0
    for idx in range(140, 145):
        ch = chapters[idx]
        cid = ch.get("id")
        title = ch.get("title")
        blocks = ch.get("blocks", [])
        stored_wc = ch.get("wordCount", 0)
        calc_wc = count_visible_chars(blocks)
        batch_total += calc_wc
        print(f"Chapter {cid} (Index {idx}): {title}")
        print(f"  Blocks: {len(blocks)}, Stored WC: {stored_wc}, Calculated WC: {calc_wc}")
        if calc_wc < 10000:
            print(f"  [ERROR] Chapter {cid} word count {calc_wc} < 10,000!")
            sys.exit(1)
        if stored_wc != calc_wc:
            print(f"  [ERROR] Chapter {cid} stored WC ({stored_wc}) != calculated WC ({calc_wc})!")
            sys.exit(1)

    print(f"Batch 29 Total Visible Characters: {batch_total} (Average {batch_total/5:.1f} per chapter)")

    # 2. Check forbidden words
    print("\n--- FORBIDDEN WORDS CHECK (Batch 29) ---")
    for idx in range(140, 145):
        ch = chapters[idx]
        text = "".join(b.get("text", "") for b in ch.get("blocks", []))
        for word in FORBIDDEN_WORDS:
            if word in text:
                print(f"[ERROR] Forbidden word '{word}' found in Chapter {ch.get('id')}!")
                sys.exit(1)
    print("Zero forbidden words found in Batch 29!")

    # 3. Cross-chapter duplicate check for Batch 29 against all 200 chapters
    print("\n--- BATCH 29 DUPLICATE CHECK ACROSS ALL 200 CHAPTERS ---")
    batch29_indices = set(range(140, 145))
    batch29_dups = []
    for idx in batch29_indices:
        ch = chapters[idx]
        cid = ch["id"]
        for b_idx, blk in enumerate(ch.get("blocks", [])):
            t = blk.get("text", "").strip()
            if not t:
                continue
            for o_idx, other_ch in enumerate(chapters):
                if o_idx == idx:
                    continue
                for ob_idx, oblk in enumerate(other_ch.get("blocks", [])):
                    ot = oblk.get("text", "").strip()
                    if t == ot:
                        batch29_dups.append((cid, b_idx, other_ch["id"], ob_idx, t[:30]))

    if batch29_dups:
        print(f"[ERROR] Batch 29 has {len(batch29_dups)} duplicate blocks:")
        for d in batch29_dups:
            print(f"  Ch {d[0]} block {d[1]} duplicates with Ch {d[2]} block {d[3]}: '{d[4]}...'")
        sys.exit(1)
    print("Zero duplicates found for Batch 29 across all 200 chapters!")

    # 4. Total words consistency check
    print("\n--- TOTAL WORDS CONSISTENCY CHECK ---")
    calc_total = sum(c.get("wordCount", 0) for c in chapters)
    stored_total = novel.get("totalWords", 0)
    print(f"Stored totalWords: {stored_total}")
    print(f"Sum of chapter wordCounts: {calc_total}")
    if calc_total != stored_total:
        print(f"[ERROR] totalWords mismatch: {stored_total} != {calc_total}")
        sys.exit(1)
    print("Total words perfectly consistent!")

    print("\n=== AUDIT 100% PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    main()
