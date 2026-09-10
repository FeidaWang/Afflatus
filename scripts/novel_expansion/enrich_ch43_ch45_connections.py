#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
enrich_ch43_ch45_connections.py
Connects Chapter 43 and Chapter 45 with Chapter 44's intimate night and memory erasure lore.
"""

import json
import re

NOVEL_PATH = "public/novels/yuxi-gongci.json"

def clean_len(text):
    return len(re.sub(r'\s+', '', text))

def main():
    print("Loading novel data...")
    with open(NOVEL_PATH, "r", encoding="utf-8") as f:
        novel = json.load(f)

    # 1. Update Chapter 43 (index 42)
    ch43 = novel["chapters"][42]
    
    # Update B30: Add memory fog & physical resonance
    for b in ch43["blocks"]:
        if "药膏虽凉，但被常梦云那温润柔嫩却手法精湛的玉指轻轻揉化" in b["text"]:
            b["text"] = (
                "药膏虽凉，但被常梦云那温润柔嫩却手法精湛的玉指轻轻揉化，裂口处顿时泛起一阵舒缓的温热。"
                "白道微低头看着近在咫尺的常梦云，看着她那长而卷翘的睫毛、白皙如凝脂的侧颜，以及微微抿起的诱人红唇，鼻端缭绕着她发丝间极淡的幽兰冷香。"
                "不知为何，当两人的指节温热相触的一瞬，白道微心底深处猛地掠过一丝触电般的悸动。"
                "那种深入骨髓的熟悉与战栗，仿佛源自四百年前大明的某场滔天风雨；可每当他试图循着记忆去捕捉那个曾在西苑大火中与他死生契阔的女子身影时，识海深处却只有一片冰冷茫然的虚无灰雾——"
                "属于主线女主“常灵珂”的一切容貌与名字，在此刻被时空跃迁机制彻底格式化封印，唯独眼前常梦云那双带着桀骜贵气却又无微不至的绝美凤眸，真真切切地倒映在他眼底。"
                "他喉结轻微滑动了一下，低声吐出两个字：“谢谢。”"
            )
        elif "少自作多情，真想谢我，就离那座该死的天线远点。" in b["text"] and "耳根微不可察地浮起一丝淡淡的薄红" in b["text"]:
            b["text"] = (
                "“脉搏跳得这么急，少在这儿自作多情。”常梦云似乎从他腕间的寸关尺中敏锐捕捉到了那一瞬失序的剧烈搏动，触电般松开他的手腕，别过俏脸将药瓶收回抽屉，耳根微不可察地浮起一丝淡淡的薄红，声音依旧冷傲如霜，"
                "“真想谢我，就离那座该死的天线远点。别到时候你们发射部立了功，我的特勤档案里却多了一具代号四十二的技术员尸体。我可丢不起这个人。”"
            )

    # Check if Ch 43 has the closing atmospheric bridge
    last_block = ch43["blocks"][-1]
    if "我们站在这里，不是为了留名，是为了活着看到它究竟把什么招引到了人间。" in last_block["text"]:
        # Append an extra closing block to Ch 43 to bridge smoothly into the freezing night of Ch 44
        new_ch43_block = {
            "id": f"ch43-b{len(ch43['blocks'])+1:02d}",
            "type": "paragraph",
            "text": (
                "常梦云合上折叠手术刀，美眸在火光跳动间深深凝视着对面的青年。窗外的夜色已深，零下三十度的寒流正自绝壁裂隙狂暴灌入，整座雷达峰在政治狂热的高压与极北风雪的夹击下，宛如一座悬在万丈深渊之上的黑色孤舟。"
                "两颗在冰冷宇宙前同样清醒而孤独的灵魂，在微弱的火光中无声对峙，空气中弥漫着草药与柴火交织的温热暗流。"
                "谁也没有料到，这场极寒与高压并存的冰冷黑夜，正在将他们一步步推向即将失控的炽烈边缘。"
            )
        }
        ch43["blocks"].append(new_ch43_block)
        print("Appended transitional block to Chapter 43.")

    new_text_43 = "".join(b["text"] for b in ch43["blocks"])
    ch43["wordCount"] = clean_len(new_text_43)
    print(f"Chapter 43 updated: {len(ch43['blocks'])} blocks, {ch43['wordCount']} chars")

    # 2. Update Chapter 45 (index 44)
    ch45 = novel["chapters"][44]
    for b in ch45["blocks"]:
        if "卫生所的值班室里，常梦云正优雅地摇晃着一只透明的玻璃量筒" in b["text"]:
            b["text"] = (
                "卫生所的值班室里，常梦云正优雅地摇晃着一只透明的玻璃量筒，熟练地调配着高能电磁辐射拮抗剂。"
                "她身穿一袭量身定制的军装长裙与修身白大褂，领口严严实实地扣到最顶端的一颗风纪扣，将白皙修长的脖颈遮掩得密不透风，唯有耳后一缕微卷的青丝垂落。"
                "高挑挺拔的身姿在日光灯下曲线毕露，成熟女性的迷人风韵与世家千金的清冷气场完美交融，只是在微微转身间，修长双腿隐隐透出一丝尚未完全消退的僵硬酸楚。"
                "白道微推门走进来，身上裹挟着一股冰冷的雪汽：“检修已经完成，试机操作定在下午三点半。主控室只有两个打瞌睡的技术员。”"
            )
        elif "“手伸出来。”常梦云头也不抬地冷冷吩咐" in b["text"]:
            b["text"] = (
                "常梦云手中的玻璃量筒微微顿了半秒，随即若无其事地搁在桌上。她缓缓转过绝美清冷的面庞，眸光在白道微苍白而严谨的脸上停留了一瞬，眼底掠过一丝极难察觉的微澜与暗火，冷冷吩咐：“手伸出来。”"
                "白道微依言伸出手腕。常梦云修长白皙的三根青葱玉指稳稳搭了上去，指腹直接贴着他脉门微凉的皮肉——仅仅数小时前，这只大掌曾粗暴而滚烫地扣着她的纤腰，在逼仄的单人行军床上数度掀起翻江倒海的狂潮。"
                "她双眼微闭，指尖甚至能感受到他腕间残留的属于自己的那一缕幽微药香。寸关尺三脉的搏动极其平缓、匀速，稳定在每分钟六十六次，像一具上了上等机油的发条机械表。"
            )
        elif "“心率正常，血压八十到一百一十五，植物神经连一根都没哆嗦。”常梦云收回手" in b["text"]:
            b["text"] = (
                "“心率六十六，血压八十到一百一十五，植物神经连一根都没哆嗦。”常梦云收回手指，狭长的凤眸半眯，眼底透出一抹刻骨的冷艳嘲弄与极度隐秘的娇嗔。"
                "她微微俯身，在刺鼻的酒精与药水气味掩盖下，用只有两人能听见的气声冷笑了一声：“白首席果然天生缺了一根恐惧神经。昨晚在行军床上折腾得快把生铁架子给摇散了，现在倒装得像个四大皆空的得道高僧？你到底知不知道下午这是要掉脑袋的勾当？”"
            )
        elif "“掉脑袋是生物学死亡，物理定律的验证是信息论收敛。”白道微面无表情地回答" in b["text"]:
            b["text"] = (
                "白道微面无表情地收回手，指尖在袖口内侧轻轻抚平被捏皱的布料。他的目光平静地掠过常梦云严密扣死的衬衫领口，低声回答："
                "“昨晚的承诺依然有效，走出那扇门，概率论高于一切情绪。掉脑袋是生物学死亡，物理定律的验证是信息论收敛。我算过天线机械俯仰的转角速率，从测试假负载切换到主天线波导，只需要两分四十秒。但主控室外的两班流动哨每十分钟巡逻一次，需要四分钟的盲区。”"
            )
        elif "嘴里嚼着一根干草棍" in b["text"]:
            b["text"] = b["text"].replace(
                "嘴里嚼着一根干草棍，冷笑了一声",
                "修长玉指间轻巧把玩着一枚银色解剖针，冷笑了一声"
            )
        elif "常梦云吐掉嘴里的草棍，嗤笑了一声" in b["text"]:
            b["text"] = b["text"].replace(
                "常梦云吐掉嘴里的草棍，嗤笑了一声",
                "常梦云收起解剖针，嗤笑了一声"
            )
        elif "常梦云低笑了一声，抬手在白道微的后颈上轻轻按了一下" in b["text"]:
            b["text"] = (
                "常梦云低笑了一声，抬手在白道微的后颈上轻轻按了一下。她温润修长的指腹若有若无地摩挲过昨夜自己在那里留下的淡淡牙印，掌心的温存穿透衣领印在冰冷的肌肤上：“那就活着，活到看清楚究竟是神明垂怜，还是恶魔敲门。”"
            )

    new_text_45 = "".join(b["text"] for b in ch45["blocks"])
    ch45["wordCount"] = clean_len(new_text_45)
    print(f"Chapter 45 updated: {len(ch45['blocks'])} blocks, {ch45['wordCount']} chars")

    # Recalculate totalWords
    novel["totalWords"] = sum(c["wordCount"] for c in novel["chapters"])
    print(f"Novel totalWords: {novel['totalWords']}")

    with open(NOVEL_PATH, "w", encoding="utf-8") as f:
        json.dump(novel, f, ensure_ascii=False, indent=2)

    print("Successfully updated Chapter 43 and Chapter 45!")

if __name__ == "__main__":
    main()
