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
    print("=== STARTING AUDIT FOR BATCH 38 (CHAPTERS 186 - 190) ===")
    with open(NOVEL_PATH, "r", encoding="utf-8") as f:
        novel = json.load(f)

    chapters = novel["chapters"]
    total_chapters = len(chapters)
    print(f"Total chapters in novel: {total_chapters}")

    batch_indices = range(185, 190)
    batch_chapters = [chapters[i] for i in batch_indices]

    errors = []

    # 1. Check word counts for Batch 38
    print("\n--- 1. Checking Word Counts (>= 10,000 chars) ---")
    for idx in batch_indices:
        ch = chapters[idx]
        ch_id = ch.get("id")
        title = ch.get("title")
        blocks = ch.get("blocks", [])
        actual_chars = count_visible_chars(blocks)
        recorded_wc = ch.get("wordCount", 0)

        print(f"Index {idx} | ID: {ch_id} | Title: {title}")
        print(f"  Blocks: {len(blocks)} | Visible Chars: {actual_chars} | Recorded WordCount: {recorded_wc}")

        if actual_chars < 10000:
            errors.append(f"Chapter {ch_id} (Index {idx}) has only {actual_chars} visible chars (< 10000)!")
        if actual_chars != recorded_wc:
            errors.append(f"Chapter {ch_id} (Index {idx}) visible chars {actual_chars} != recorded wordCount {recorded_wc}!")

    # 2. Check forbidden words in Batch 38
    print("\n--- 2. Checking Forbidden Words in Batch 38 ---")
    for idx in batch_indices:
        ch = chapters[idx]
        full_text = "".join(b.get("text", "") for b in ch.get("blocks", []))
        for word in FORBIDDEN_WORDS:
            if word in full_text:
                errors.append(f"Chapter {ch.get('id')} (Index {idx}) contains forbidden word: '{word}'!")

    if not any("forbidden word" in e for e in errors):
        print("PASS: 0 forbidden words found in Batch 38!")

    # 3. Cross-chapter duplicate check for Batch 38 against all 200 chapters
    print("\n--- 3. Cross-chapter Duplicate Check for Batch 38 against ALL 200 Chapters ---")
    all_other_blocks = {}
    for idx, ch in enumerate(chapters):
        if idx in batch_indices:
            continue
        for b_idx, b in enumerate(ch.get("blocks", [])):
            txt = b.get("text", "").strip()
            if txt and len(txt) > 6:
                all_other_blocks[txt] = (idx, ch.get("id"), b_idx)

    dup_count = 0
    for idx in batch_indices:
        ch = chapters[idx]
        for b_idx, b in enumerate(ch.get("blocks", [])):
            txt = b.get("text", "").strip()
            if txt in all_other_blocks:
                orig_idx, orig_id, orig_b_idx = all_other_blocks[txt]
                errors.append(f"Duplicate found in Chapter {ch.get('id')} Block {b_idx}: matches Chapter {orig_id} Block {orig_b_idx}: '{txt[:30]}...'")
                dup_count += 1

    # Also check intra-batch duplicates
    intra_seen = {}
    for idx in batch_indices:
        ch = chapters[idx]
        for b_idx, b in enumerate(ch.get("blocks", [])):
            txt = b.get("text", "").strip()
            if not txt or len(txt) <= 6:
                continue
            if txt in intra_seen:
                prev_ch, prev_b = intra_seen[txt]
                errors.append(f"Intra-batch duplicate: Chapter {ch.get('id')} Block {b_idx} matches Chapter {prev_ch} Block {prev_b}: '{txt[:30]}...'")
                dup_count += 1
            else:
                intra_seen[txt] = (ch.get("id"), b_idx)

    if dup_count == 0:
        print("PASS: 0 duplicate blocks for Batch 38 across all 200 chapters!")

    # 4. Check totalWords metadata consistency
    print("\n--- 4. Checking totalWords Consistency ---")
    stored_total = novel.get("totalWords", 0)
    calculated_total = sum(c.get("wordCount", 0) for c in chapters)
    print(f"Stored totalWords: {stored_total}")
    print(f"Calculated sum of wordCounts: {calculated_total}")

    if stored_total != calculated_total:
        errors.append(f"totalWords mismatch: stored {stored_total} != calculated {calculated_total}")
    else:
        print("PASS: totalWords metadata perfectly consistent!")

    print("\n=== AUDIT SUMMARY ===")
    if errors:
        print(f"FAILED with {len(errors)} errors:")
        for err in errors:
            print(f"  [ERROR] {err}")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED PERFECTLY FOR BATCH 38!")
        sys.exit(0)

if __name__ == "__main__":
    audit()
