#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync_generators_from_json.py
Synchronizes generate_ch43.py through generate_ch51.py with the refactored blocks in public/novels/yuxi-gongci.json.
"""

import json

NOVEL_PATH = "public/novels/yuxi-gongci.json"

def main():
    with open(NOVEL_PATH, "r", encoding="utf-8") as f:
        novel = json.load(f)

    for ch_idx in range(42, 51):
        ch_num = ch_idx + 1
        ch = novel["chapters"][ch_idx]
        file_path = f"scripts/novel_expansion/generate_ch{ch_num}.py"
        blocks_formatted = json.dumps(ch["blocks"], ensure_ascii=False, indent=4)
        
        script_content = f'''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import re
import os

NOVEL_PATH = 'public/novels/yuxi-gongci.json'

def clean_len(text):
    return len(re.sub(r'\\s+', '', text))

def main():
    with open(NOVEL_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    existing_texts = set()
    for c_idx, c in enumerate(data['chapters']):
        if c_idx == {ch_idx}:
            continue
        for b in c['blocks']:
            existing_texts.add(b['text'].strip())

    blocks = {blocks_formatted}

    vis_len = clean_len("".join(b["text"] for b in blocks))
    print(f"Total blocks: {{len(blocks)}}, Total visible characters: {{vis_len}}")

    dups = 0
    for b in blocks:
        t = b["text"].strip()
        if t in existing_texts:
            print(f"DUPLICATE DETECTED: {{t[:30]}}...")
            dups += 1
    if dups > 0:
        print(f"ERROR: {{dups}} duplicates found! Aborting.")
        return

    print("SUCCESS: 0 duplicates found!")

    if vis_len < 10000:
        print(f"WARNING: visible length {{vis_len}} < 10000! Need more text.")
        return

    ch = data['chapters'][{ch_idx}]
    print(f"Updating Chapter {ch_num}: {{ch['title']}}")
    ch['blocks'] = blocks
    ch['wordCount'] = vis_len

    data['totalWords'] = sum(c['wordCount'] for c in data['chapters'])
    print(f"New totalWords: {{data['totalWords']}}")

    with open(NOVEL_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Successfully written Chapter {ch_num} to {{NOVEL_PATH}}!")

if __name__ == '__main__':
    main()
'''
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(script_content)
        print(f"Synchronized {file_path} (Chapter {ch_num}, {len(ch['blocks'])} blocks, {ch['wordCount']} words)")

if __name__ == "__main__":
    main()
