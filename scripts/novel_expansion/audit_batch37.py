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
    print("=== STARTING AUDIT FOR BATCH 37 (CHAPTERS 181 - 185) ===")
    with open(NOVEL_PATH, "r", encoding="utf-8") as f:
        novel = json.load(f)

    chapters = novel["chapters"]
    total_chapters = len(chapters)
    print(f"Total chapters in novel: {total_chapters}")

    batch_indices = range(180, 185)
    batch_chapters = [chapters[i] for i in batch_indices]

    errors = []

    # 1. Check word counts for Batch 37
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

    # 2. Check forbidden words in Batch 37
    print("\n--- 2. Checking Forbidden Words in Batch 37 ---")
    for idx in batch_indices:
        ch = chapters[idx]
        full_text = "".join(b.get("text", "") for b in ch.get("blocks", []))
        for word in FORBIDDEN_WORDS:
            if word in full_text:
                errors.append(f"Chapter {ch.get('id')} (Index {idx}) contains forbidden word: '{word}'!")

    if not any("forbidden word" in e for e in errors):
        print("PASS: 0 forbidden words found in Batch 37!")

    # 3. Cross-chapter duplicate check for Batch 37 against all 200 chapters
    print("\n--- 3. Cross-chapter Duplicate Check for Batch 37 against ALL 200 Chapters ---")
    batch37_dups = []
    for idx in batch_indices:
        ch = chapters[idx]
        cid = ch["id"]
        for b_idx, blk in enumerate(ch.get("blocks", [])):
            t = blk.get("text", "").strip()
            if not t:
                continue
            # check within same chapter
            for b2_idx, blk2 in enumerate(ch.get("blocks", [])):
                if b2_idx > b_idx and blk2.get("text", "").strip() == t:
                    batch37_dups.append((cid, b_idx, cid, b2_idx, t[:30]))
            # check against all other chapters in the novel
            for o_idx, other_ch in enumerate(chapters):
                if o_idx == idx:
                    continue
                for ob_idx, oblk in enumerate(other_ch.get("blocks", [])):
                    ot = oblk.get("text", "").strip()
                    if t == ot:
                        batch37_dups.append((cid, b_idx, other_ch["id"], ob_idx, t[:30]))

    if batch37_dups:
        print(f"FAIL: Found {len(batch37_dups)} duplicate blocks for Batch 37!")
        for d in batch37_dups[:10]:
            print(f"  Ch {d[0]}[{d[1]}] duplicates with Ch {d[2]}[{d[3]}]: '{d[4]}...'")
            errors.append(f"Duplicate block between Ch {d[0]} and Ch {d[2]}")
    else:
        print("PASS: 0 duplicate blocks for Batch 37 across all 200 chapters!")

    # 4. Check totalWords metadata consistency
    print("\n--- 4. Checking totalWords Consistency ---")
    stored_total = novel.get("totalWords")
    calculated_total = sum(c.get("wordCount", 0) for c in chapters)
    print(f"Stored totalWords: {stored_total}")
    print(f"Calculated sum of wordCounts: {calculated_total}")

    if stored_total != calculated_total:
        errors.append(f"Metadata totalWords mismatch: stored {stored_total} != calculated {calculated_total}")
    else:
        print("PASS: totalWords metadata perfectly consistent!")

    print("\n=== AUDIT SUMMARY ===")
    if errors:
        print(f"FAIL: {len(errors)} errors found:")
        for err in errors:
            print("  - " + err)
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED PERFECTLY FOR BATCH 37!")

if __name__ == "__main__":
    audit()
