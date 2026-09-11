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

def main():
    print("=== STARTING AUDIT FOR BATCH 39 (CHAPTERS 191 - 195) ===")
    with open(NOVEL_PATH, "r", encoding="utf-8") as f:
        novel = json.load(f)

    chapters = novel.get("chapters", [])
    print(f"Total chapters in novel: {len(chapters)}")
    errors = []

    # 1. Check Batch 39 chapter lengths (indices 190 to 194)
    print("\n--- 1. Checking Word Counts (>= 10,000 chars) ---")
    batch_indices = list(range(190, 195))
    for idx in batch_indices:
        c = chapters[idx]
        cid = c["id"]
        title = c["title"]
        blocks = c.get("blocks", [])
        cnt = count_visible_chars(blocks)
        recorded = c.get("wordCount", 0)
        print(f"Index {idx} | ID: {cid} | Title: {title}")
        print(f"  Blocks: {len(blocks)} | Visible Chars: {cnt} | Recorded WordCount: {recorded}")
        if cnt < 10000:
            errors.append(f"[ERROR] Chapter {cid} (Index {idx}) has only {cnt} visible chars (< 10000)!")
        if cnt != recorded:
            errors.append(f"[ERROR] Chapter {cid} (Index {idx}) calculated chars {cnt} != recorded wordCount {recorded}!")

    # 2. Check Forbidden Words
    print("\n--- 2. Checking Forbidden Words in Batch 39 ---")
    forbidden_found = 0
    for idx in batch_indices:
        c = chapters[idx]
        cid = c["id"]
        full_text = "".join(b.get("text", "") for b in c.get("blocks", []))
        for word in FORBIDDEN_WORDS:
            if word in full_text:
                errors.append(f"[ERROR] Forbidden word '{word}' found in Chapter {cid}!")
                forbidden_found += 1
    if forbidden_found == 0:
        print("PASS: 0 forbidden words found in Batch 39!")

    # 3. Duplicate checks
    print("\n--- 3. Cross-chapter Duplicate Check for Batch 39 against ALL 200 Chapters ---")
    all_blocks = {}
    for idx, c in enumerate(chapters):
        cid = c["id"]
        for b_idx, b in enumerate(c.get("blocks", [])):
            text = b.get("text", "").strip()
            if not text:
                continue
            if text in all_blocks:
                all_blocks[text].append((idx, cid, b_idx))
            else:
                all_blocks[text] = [(idx, cid, b_idx)]

    duplicate_count = 0
    for idx in batch_indices:
        c = chapters[idx]
        cid = c["id"]
        for b_idx, b in enumerate(c.get("blocks", [])):
            text = b.get("text", "").strip()
            if not text:
                continue
            occurrences = all_blocks.get(text, [])
            if len(occurrences) > 1:
                other_occs = [occ for occ in occurrences if not (occ[0] == idx and occ[2] == b_idx)]
                if other_occs:
                    duplicate_count += 1
                    preview = text[:35] + "..." if len(text) > 35 else text
                    errors.append(f"[ERROR] Duplicate found in Chapter {cid} Block {b_idx}: matches Chapter {other_occs[0][1]} Block {other_occs[0][2]}: '{preview}'")

    if duplicate_count == 0:
        print("PASS: 0 duplicate blocks for Batch 39 across all 200 chapters!")

    # 4. totalWords consistency
    print("\n--- 4. Checking totalWords Consistency ---")
    stored_total = novel.get("totalWords", 0)
    calculated_total = sum(c.get("wordCount", 0) for c in chapters)
    print(f"Stored totalWords: {stored_total}")
    print(f"Calculated sum of wordCounts: {calculated_total}")
    if stored_total != calculated_total:
        errors.append(f"[ERROR] Stored totalWords {stored_total} != calculated sum {calculated_total}!")
    else:
        print("PASS: totalWords metadata perfectly consistent!")

    print("\n=== AUDIT SUMMARY ===")
    if errors:
        print(f"FAILED with {len(errors)} errors:")
        for e in errors[:30]:
            print(f"  {e}")
        if len(errors) > 30:
            print(f"  ... and {len(errors) - 30} more errors.")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED PERFECTLY FOR BATCH 39!")
        sys.exit(0)

if __name__ == "__main__":
    main()
