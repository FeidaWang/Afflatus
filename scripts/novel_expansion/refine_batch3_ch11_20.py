# -*- coding: utf-8 -*-
import json
import re

def main():
    novel_path = 'public/novels/yuxi-gongci.json'
    with open(novel_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("=== REFINING BATCH 3: CHAPTERS 11 - 20 ===")

    # 1. Refine Chapter 13: B47 remove '娇躯'
    ch13 = data['chapters'][12]
    for b in ch13['blocks']:
        if '娇躯颤抖得如同一片暴风雨中的落叶' in b['text']:
            b['text'] = b['text'].replace('娇躯颤抖得如同一片暴风雨中的落叶', '消瘦的单薄身子颤抖得如同一片暴风雨中的落叶')

    # 2. Refine Chapter 18: B11 remove flowery cliches and '娇躯'
    ch18 = data['chapters'][17]
    for b in ch18['blocks']:
        if '常灵珂的娇躯猛然微不可察地颤动了一下' in b['text']:
            b['text'] = "常灵珂拢了拢身上厚重的藏青色棉大氅，帽檐压得很低，只露出被刀割般的风雪冻得发白的下颌。她指尖冻得发僵，死死攥着那只沉香木药箱的黄铜提梁，指节因为过度用力而隐隐泛白。脚下的羊皮皂靴踩在金水桥结冰的汉白玉石阶上，发出细碎危险的打滑微响。就在她抬头的瞬间，眼皮猛地一跳，浑身的神经骤然紧绷！"

    # 3. Refine Chapter 19: Sharpen deadpan biomedical dialogue facing Chen Hong in the East Depot dungeon
    ch19 = data['chapters'][18]
    for b in ch19['blocks']:
        if '陈公公若要查，奴婢随时奉陪' in b['text'] or '陈洪面色猛然一僵' in b['text']:
            pass
        if '你要的是一份能呈给万岁爷的签字供状' in b['text']:
            pass
    # Check block 30 in Ch 19
    b30 = ch19['blocks'][30]['text']
    if '陈洪面色猛然一僵' in b30:
        ch19['blocks'][29]['text'] = "常灵珂调配好手中的三棱银针，冷冷扫了陈洪一眼，语气没有半点波澜：“陈公公，再收紧半寸皮索，他的指骨就会造成不可逆的粉碎性骨折，神经源性休克会在两分钟内彻底摧毁他的脑干。你要的是一份能呈给万岁爷的亲笔供状，还是一具指骨粉碎连红泥都按不上的烂肉死尸？这不是商量，是人体解剖学的客观定律。”"

    # Verify visible characters for Chapters 11-20
    for i in range(10, 20):
        ch = data['chapters'][i]
        full_text = ''.join(b['text'] for b in ch['blocks'])
        vis_count = len(re.sub(r'\s', '', full_text))
        ch['wordCount'] = vis_count
        print(f"Chapter {i+1:02d}: {ch['title']} -> {vis_count} visible chars")
        if vis_count < 10000:
            raise ValueError(f"Chapter {i+1} has {vis_count} < 10000 chars!")

    # Update totalWords
    data['totalWords'] = sum(c['wordCount'] for c in data['chapters'])
    print(f"Updated totalWords: {data['totalWords']}")

    # Check duplicates across Ch 1-40
    all_paras = []
    for idx, ch in enumerate(data['chapters'][:40], 1):
        for b in ch['blocks']:
            t = b.get('text', '').strip()
            if t:
                all_paras.append((idx, t))

    texts = [p[1] for p in all_paras]
    if len(texts) != len(set(texts)):
        from collections import Counter
        counts = Counter(texts)
        dups = {k: v for k, v in counts.items() if v > 1}
        print(f"ERROR: Found {len(dups)} duplicate paragraphs!")
        for d, c in list(dups.items())[:5]:
            print(f"Count {c}: {d[:60]}")
        raise ValueError("Duplicates detected!")

    print("SUCCESS: 0 duplicates across Ch 1-40!")

    with open(novel_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("Refined Batch 3 (Chapters 11-20) written successfully!")

if __name__ == '__main__':
    main()
