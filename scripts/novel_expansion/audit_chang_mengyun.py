#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit_chang_mengyun.py
Full quality assurance audit for the Chang Huansen -> Chang Mengyun refactoring.
Checks:
1. 0 occurrences of '常唤森' or '唤森' in entire novel.
2. Word count >= 10,000 pure characters for chapters 43-51.
3. 0 duplicate blocks in Chapters 43-51 against all chapters, and 0 duplicate blocks in Ch 1-140.
4. 0 forbidden cultivation words in chapters 43-51.
5. No residual male markers ('老子', '烟蒂', etc.) on Chang Mengyun.
6. totalWords matches sum of all 200 chapters' wordCount.
"""

import json
import re
import sys

NOVEL_PATH = "public/novels/yuxi-gongci.json"

FORBIDDEN_CULTIVATION_WORDS = [
    "法宝", "元婴", "金丹", "灵气", "修仙", "修真", 
    "仙人", "仙界", "神识", "魔道", "宗门", "洞府", 
    "飞升", "天劫", "渡劫", "道友"
]

def clean_len(text):
    return len(re.sub(r'\s+', '', text))

def main():
    print("=== STARTING CHANG MENGYUN AUDIT ===")
    with open(NOVEL_PATH, "r", encoding="utf-8") as f:
        novel = json.load(f)

    chapters = novel["chapters"]
    total_chapters = len(chapters)
    print(f"Total chapters loaded: {total_chapters}")

    errors = []

    # 1. Total words check
    computed_total = sum(c["wordCount"] for c in chapters)
    stored_total = novel.get("totalWords", 0)
    if computed_total != stored_total:
        errors.append(f"totalWords mismatch: stored={stored_total}, computed={computed_total}")
    else:
        print(f"[PASS] totalWords matches sum of all chapters: {stored_total}")

    # 2. Check entire novel for '常唤森' or '唤森'
    entire_text = "".join(b["text"] for c in chapters for b in c["blocks"])
    if "常唤森" in entire_text:
        errors.append("Found '常唤森' in novel text!")
    if "唤森" in entire_text:
        errors.append("Found '唤森' in novel text!")
    if "常唤森" not in entire_text and "唤森" not in entire_text:
        print("[PASS] 0 occurrences of '常唤森' or '唤森' in the entire novel.")

    # 3. Check Chapters 43-51 word counts
    for idx in range(42, 51):
        ch = chapters[idx]
        actual_len = clean_len("".join(b["text"] for b in ch["blocks"]))
        if actual_len < 10000:
            errors.append(f"Chapter {idx+1} ({ch['title']}) word count {actual_len} < 10,000!")
        else:
            print(f"[PASS] Chapter {idx+1} ({ch['title']}): {actual_len} chars (>= 10,000)")

    # 4. Check for duplicate blocks involving Chapters 43-51
    ch_43_51_dups = []
    for c_idx in range(42, 51):
        ch = chapters[c_idx]
        for b_idx, b in enumerate(ch['blocks']):
            t = b['text'].strip()
            if len(t) < 15:
                continue
            for other_c_idx, other_ch in enumerate(chapters):
                if other_c_idx == c_idx:
                    continue
                for other_b_idx, other_b in enumerate(other_ch['blocks']):
                    if t == other_b['text'].strip():
                        ch_43_51_dups.append((c_idx+1, b_idx, other_c_idx+1, other_b_idx, t[:30]))

    if ch_43_51_dups:
        for dup in ch_43_51_dups:
            errors.append(f"Duplicate block in Ch {dup[0]} B{dup[1]} matches Ch {dup[2]} B{dup[3]}: '{dup[4]}'")
    else:
        print("[PASS] 0 duplicate blocks in Chapters 43-51 across all 200 chapters.")

    # Check Ch 1-140 duplicates
    seen_140 = {}
    dups_140 = []
    for c_idx in range(140):
        ch = chapters[c_idx]
        for b_idx, b in enumerate(ch['blocks']):
            t = b['text'].strip()
            if len(t) < 15:
                continue
            if t in seen_140:
                dups_140.append((c_idx+1, b_idx, seen_140[t][0]+1, seen_140[t][1], t[:30]))
            else:
                seen_140[t] = (c_idx, b_idx)

    if dups_140:
        for dup in dups_140[:5]:
            errors.append(f"Duplicate block in Ch 1-140: Ch {dup[0]} B{dup[1]} matches Ch {dup[2]} B{dup[3]}")
    else:
        print(f"[PASS] 0 duplicate blocks across all expanded Chapters 1-140 ({len(seen_140)} blocks).")

    # 5. Check forbidden cultivation words in Chapters 43-51
    cultivation_hits = []
    for idx in range(42, 51):
        ch = chapters[idx]
        for b_idx, b in enumerate(ch["blocks"]):
            for fw in FORBIDDEN_CULTIVATION_WORDS:
                if fw in b["text"]:
                    cultivation_hits.append((idx + 1, b_idx, fw))
    if cultivation_hits:
        for hit in cultivation_hits:
            errors.append(f"Chapter {hit[0]} Block {hit[1]} contains forbidden cultivation word '{hit[2]}'")
    else:
        print("[PASS] 0 forbidden cultivation words in Chapters 43-51.")

    # 6. Check residual male markers on Chang Mengyun in Chapters 43-51
    male_markers = ["老子", "狗日", "大马金刀", "烟蒂", "粗汉"]
    marker_hits = []
    for idx in range(42, 51):
        ch = chapters[idx]
        for b_idx, b in enumerate(ch["blocks"]):
            t = b["text"]
            for m in male_markers:
                if m in t and ("梦云" in t or "常医生" in t or "常大夫" in t):
                    marker_hits.append((idx + 1, b_idx, m, t[:60]))
    if marker_hits:
        for hit in marker_hits:
            errors.append(f"Chapter {hit[0]} Block {hit[1]} has male marker '{hit[2]}': {hit[3]}")
    else:
        print("[PASS] 0 residual male markers around Chang Mengyun in Chapters 43-51.")

    print("=== AUDIT SUMMARY ===")
    if errors:
        print(f"FAILED with {len(errors)} errors:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("ALL QUALITY CHECKS PASSED PERFECTLY (100%)!")

if __name__ == "__main__":
    main()
