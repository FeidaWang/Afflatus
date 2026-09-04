# -*- coding: utf-8 -*-
import json
import re

def main():
    novel_path = 'public/novels/yuxi-gongci.json'
    with open(novel_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("=== REFINING BATCH 2: CHAPTERS 1 - 10 ===")

    # Refine Chapter 2: Fix spatial leap (Yellow River gallop -> stay in Beijing for mission dispatch), inject Kaleidoscope gallows humor
    ch2 = data['chapters'][1]

    # Block 35: Replace Yongdingmen departure with Board of Revenue dispatch notice
    ch2['blocks'][35]['text'] = "户部主事房外，寒风裹着细碎冰冷的冻雪，噼噼啪啪地抽打着破损发黄的窗纸。白道微站在值房昏暗的回廊阴影下，双手拢在宽大的袖袍里，看着几个面容麻木的差役役夫，抬着用破烂草席粗糙裹卷着的周云逸尸身，脚步凌乱地穿过长街。地面上被拖曳出一道长达数丈的暗红血痕，热血混杂着脏污的雪泥，在零下十数度的极寒中刚刚淌出，便迅速凝结成一层带着腥臭味的黑红坚冰。空气中弥漫着劣质生石炭辛辣呛鼻的黑烟，呛得人肺管生疼。他低头翻阅着吏部刚刚加急下发的一卷公牒文移——因江南推行改稻为桑在即，户部需遣派通晓度支核算的官员随同新任淳安知县王用汲南下浙江。这一纸盖着鲜红朱印的调令，看似升迁差遣，实则是严党在京师剪除异己、将眼中钉推向地方死局的生死勘合。"

    # Block 38: Replace horse riding snow plains with midnight corridor encounter in Beijing
    ch2['blocks'][38]['text'] = "深夜三更，朔风愈发狂暴，吹得紫禁城巍峨高耸的角楼铜铃发出凄厉刺耳的破响。常灵珂手捧着一只盛满御药底封的雕花漆盘，穿过文渊阁外漫长而幽暗的穿堂回廊。回廊两侧没有点灯，唯有惨白的雪光从青灰色的地砖上反射上来，勾勒出森冷如骨的阴影。走到长廊尽头的避风拐角处，一个清瘦挺拔的身影正裹着一件半旧的石青色长袍立在阴影里，正是白道微。长廊外的汉白玉雕花石栏上堆积着半尺厚的残雪，一阵冷风扑面卷过，冰冷的雪沫子直往两人的衣领与脖颈里钻，冻得人骨节隐隐作痛。"

    # Block 39: Replace Yellow River gallop with Kaleidoscope deadpan banter and frozen corn bun
    ch2['blocks'][39]['text'] = "常灵珂在距离他三步远的地方停下脚步，没有上前，只是吸了吸被冻得通红发僵的鼻尖，语气里带着惯有的冷淡与尖刻：“白首席大半夜不睡，特意站在这穿堂风口里受冻，是打算提前用肉身做低温生物学冷冻实验？”白道微缓缓抬起眼皮，镜片后的黑眸在雪光映照下清冷沉静。他呼出一大口白茫茫的热气，修长但微颤的手指伸入衣襟内侧，摸出一个用粗糙油纸层层包裹的硬邦邦的黑面窝头，递到了她的面前：“吃吧。胃酸分泌过多容易引发急性应激性溃疡。在你想出怎么用青蒿素和柳叶刀拯救大明之前，先保证自己别在零下十五度的暴风雪里冻成硬邦邦的标本。”常灵珂垂眸看着那半个窝头，伸手接了过来，指腹捏了捏坚硬如铁的粗砺表皮，冷笑道：“这东西的抗压强度堪比花岗岩，拿去午门能直接当钝器把陈洪开瓢。”白道微面无表情地看着她：“能砸死人，说明密度大、碳水化合物含量极高。户部大厨房的值班火夫贪墨克扣，能在蒸笼底抢到这半个尚带余温的窝头，我至少动用了三道博弈树与百分之八十的算力，常大夫别不知好歹。”"

    # Block 40: Bridge to tomorrow's Tongzhou departure
    ch2['blocks'][40]['text'] = "雪落无声，廊下深沉的阴影将两人的身形彻底掩蔽。雪花落在大明朝廷染血的汉白玉金砖上，洗不掉周云逸留在石缝深处的殷红血迹，反倒像是一层惨白冰冷的裹尸布，将整座帝国的腐朽与狰狞暂时遮掩。按照吏部的严苛勘合，明日卯时初刻，白道微就要离开京师，前往通州张家湾码头，登上一艘破旧官造乌篷快船，随同那位刚直古板的新知县王用汲南下。等待他的，将是九千顷即将被淹没的良田、数万嗷嗷待哺的饥民，以及严党在东南盘根错节的滔天杀阵。"

    # Block 41: Deadpan survival odds exchange
    ch2['blocks'][41]['text'] = "常灵珂靠在冰冷的朱红廊柱上，低头咬了一小口冰硬的窝头，粗粝的杂粮碎屑划过喉咙，带着一丝呛人的麦麸涩味，却迅速在胃里化为一缕珍贵的热流。她看着漫天翻滚的狂风暴雪，清澈的眼眸在雪光中明亮得宛如手术刀的锋芒：“南边是大水、贪官和倭寇，京里是丹炉、太监和诏狱。白道微，你用你那台无所不能的大脑算一算，我们在这个时空活过这个夏天的概率究竟有多大？”白道微低头轻轻拍去袖口沾染的细碎冰屑，嘴角扯出一抹极淡却极其冷峻的弧度：“如果不引入外部变量，在系统默认的死局模型里，生存概率是百分之四点三；但只要常大夫在后方别把御药房的砒霜当白糖吃了，这个概率就能直接飙升到百分之八十七点六。”常灵珂将剩下的半块硬窝头塞进袖中，迎着风雪轻嗤一声：“放心，白算学家。在你被严世蕃扔进新安江喂王八之前，我一定先给你备一副涂满防腐蜂蜡的薄皮棺材。”两人站在风雪呼啸的紫禁城深处，相视无言，唯有刺骨的风声在廊柱间发出犹如哭号的轰鸣，将两个异乡灵魂的命运死死缠绕在一起。"

    # Verify visible characters for Chapters 1-10
    for i in range(10):
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

    print("Refined Batch 2 (Chapters 1-10) written successfully!")

if __name__ == '__main__':
    main()
