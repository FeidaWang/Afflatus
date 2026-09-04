# -*- coding: utf-8 -*-
import json
import re

def main():
    novel_path = 'public/novels/yuxi-gongci.json'
    with open(novel_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("=== REFINING BATCH 4: CHAPTERS 21 - 35 ===")

    # 1. Refine Chapter 22 B63
    ch22 = data['chapters'][21]
    for b in ch22['blocks']:
        if '心念与白道微紧紧相拥' in b['text']:
            b['text'] = b['text'].replace('心念与白道微紧紧相拥', '心神与白道微的思维终端瞬息咬合')

    # 2. Refine Chapter 24
    ch24 = data['chapters'][23]
    # B36: replace '娇躯' with '身形'
    for b in ch24['blocks']:
        if '足尖在结霜的药案边缘轻轻一点，娇躯宛如' in b['text']:
            b['text'] = b['text'].replace('足尖在结霜的药案边缘轻轻一点，娇躯宛如', '足尖在结霜的药案边缘轻轻一点，身形宛如')

    # B63 - B67: Replace melodramatic hug with 70-li horse ride, broken stirrup, deadpan banter, and wind shielding
    ch24['blocks'][63]['text'] = "白道微快步跨过断裂焦黑的木栏，径直走到常灵珂面前。他胸膛剧烈起伏，长途策马狂奔七十里灌入喉管的刺骨寒风让他嗓音沙哑粗粝。他死死盯着眼前完好无损的女人，原本紧绷得泛青的面颊线条终于微不可察地松动了一下。他一把扯下自己身上那领浸透了风雪与马汗的厚重黑呢大氅，不由分说地劈头罩在常灵珂单薄的肩头上。"
    ch24['blocks'][64]['text'] = "大氅沉甸甸地裹在身上，混杂着皮毛的腥味、雪水泥泞的冷气，以及他身上滚烫的体温。常灵珂被大氅兜头罩住，抬手将领子拉开一线，看着眼前这个平日里连衣襟褶皱都要拿尺子量平整的量化大师——此刻他发冠微斜，几缕被冷汗浸透的碎发凌乱地贴在额角，甚至连右侧皮质马镫断裂磨破了皮靴都没发觉。"
    ch24['blocks'][65]['text'] = "常灵珂吸了一口带着焦糊味的冷空气，挑眉看着他，语气带着惯常的冷面刻薄：“白首席狂奔七十里，连官靴都跑丢了一只底，难不成也是为了给大明户部节约差旅折宿费？”"
    ch24['blocks'][66]['text'] = "白道微面无表情地别过脸去，避开她那双洞若观火的明眸，死鸭子嘴硬地冷哼道：“按照概率模型，严世蕃在除夕夜调集死士突袭药典阁的成功率只有百分之十二点四。我只是恰好在通州核算完最后三道漕粮平衡表，顺路回城抓你回去复核账册而已。大明太医院要是少了一个首席毒理主治医，明天早朝的重金属中毒弹劾奏折就没人替我背书了。”"
    ch24['blocks'][67]['text'] = "常灵珂嗤笑一声，眼底深处却掠过一抹被大火灼痛般的温热。她拢紧了大氅，双手抄在袖中，淡淡反唇相讥：“顺路回城？顺路能把大明驿站的三匹快马活活跑脱力？白首席的导航算法看来还得再做两次卡尔曼滤波校准。”白道微抿紧了唇线，没有接话，只是在风雪彻底平息的废墟前，下意识地侧身跨了半步，用高大挺拔的身躯替她挡住了拂晓时分最冷的那一阵穿堂夜风。"

    # 3. Refine Chapter 35 B86: Sit side by side on stone steps
    ch35 = data['chapters'][34]
    for b in ch35['blocks']:
        if '将她温柔地揽入怀中' in b['text']:
            b['text'] = "白道微坐在青石台阶上，手肘支在膝头，转头看了看坐在身旁的常灵珂，唇角微扬：“是啊，张铁匠的儿子明日一早要来换药，孙大娘的孙子要来学九九乘法，南街书肆的掌柜还要来问复式借贷总账……市井长巷，烟火升腾，这便是最踏实的人间，也是我们替大明守住的天下。”"

    # Verify visible characters for Chapters 21-35
    for i in range(20, 35):
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

    print("Refined Batch 4 (Chapters 21-35) written successfully!")

if __name__ == '__main__':
    main()
