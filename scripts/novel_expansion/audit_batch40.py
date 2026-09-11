# -*- coding: utf-8 -*-
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

def audit():
    print("=== STARTING AUDIT FOR BATCH 40 (CHAPTERS 196 - 200) ===")
    with open(NOVEL_PATH, "r", encoding="utf-8") as f:
        novel = json.load(f)

    chapters = novel.get("chapters", [])
    total_chapters = len(chapters)
    print(f"Total chapters in novel: {total_chapters}")
    if total_chapters != 200:
        print(f"Error: expected 200 chapters, got {total_chapters}")
        sys.exit(1)

    batch_indices = list(range(195, 200))
    failed = False

    print("\n--- 1. Checking Word Counts (>= 10,000 chars) ---")
    for idx in batch_indices:
        c = chapters[idx]
        cid = c.get("id")
        title = c.get("title")
        blocks = c.get("blocks", [])
        cnt = count_visible_chars(blocks)
        recorded = c.get("wordCount", 0)

        print(f"Index {idx} | ID: {cid} | Title: {title}")
        print(f"  Blocks: {len(blocks)} | Visible Chars: {cnt} | Recorded WordCount: {recorded}")

        if cnt < 10000:
            print(f"  FAILED: Visible chars {cnt} < 10000!")
            failed = True
        if cnt != recorded:
            print(f"  FAILED: Visible chars {cnt} != recorded wordCount {recorded}!")
            failed = True

    print("\n--- 2. Checking Forbidden Words in Batch 40 ---")
    for idx in batch_indices:
        c = chapters[idx]
        cid = c.get("id")
        full_text = "".join(b.get("text", "") for b in c.get("blocks", []))
        found = []
        for word in FORBIDDEN_WORDS:
            if word in full_text:
                found.append(word)
        if found:
            print(f"  FAILED: Chapter {cid} contains forbidden words: {found}")
            failed = True
    if not failed:
        print("PASS: 0 forbidden words found in Batch 40!")

    print("\n--- 3. Cross-chapter Duplicate Check for Batch 40 against ALL 200 Chapters ---")
    all_blocks = {}
    for idx, c in enumerate(chapters):
        cid = c.get("id")
        for b_idx, blk in enumerate(c.get("blocks", [])):
            t = blk.get("text", "").strip()
            if not t:
                continue
            if t in all_blocks:
                all_blocks[t].append((idx, cid, b_idx))
            else:
                all_blocks[t] = [(idx, cid, b_idx)]

    batch_duplicates = []
    for t, occurrences in all_blocks.items():
        if len(occurrences) > 1:
            in_batch = any(occ[0] in batch_indices for occ in occurrences)
            if in_batch:
                batch_duplicates.append((t[:30], occurrences))

    if batch_duplicates:
        print(f"  FAILED: Found {len(batch_duplicates)} duplicate block texts involving Batch 40:")
        for snippet, occs in batch_duplicates[:10]:
            print(f"    '{snippet}...' appeared in: {occs}")
        failed = True
    else:
        print("PASS: 0 duplicate blocks for Batch 40 across all 200 chapters!")

    print("\n--- 4. Checking totalWords Consistency ---")
    sum_words = sum(c.get("wordCount", 0) for c in chapters)
    stored_total = novel.get("totalWords", 0)
    print(f"Stored totalWords: {stored_total}")
    print(f"Calculated sum of wordCounts: {sum_words}")
    if sum_words != stored_total:
        print(f"  FAILED: totalWords mismatch! sum={sum_words}, stored={stored_total}")
        failed = True
    else:
        print("PASS: totalWords metadata perfectly consistent!")

    print("\n=== AUDIT SUMMARY ===")
    if failed:
        print("AUDIT FAILED! See above errors.")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED PERFECTLY FOR BATCH 40!")

if __name__ == "__main__":
    audit()
