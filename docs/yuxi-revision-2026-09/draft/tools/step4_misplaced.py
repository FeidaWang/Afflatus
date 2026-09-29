"""工序 4：第 88–90、99–120 章章题与正文错位。正文整章标“待重写”（块注释 flag + meta.status），好段落抽出存档。
用法：python3 tools/step4_misplaced.py [--apply]"""
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__)); import draftlib as L
APPLY = '--apply' in sys.argv
CHS = [88, 89, 90] + list(range(99, 121))
TARGET = {88: '整章删（中途回墨尔本）', 89: '星 31 黄金时代', 90: '整章删（中途结算）', 99: '星 32 阶梯（程心、公投）',
          100: '星 32 阶梯（公投）；结算部分删', 101: '整章删（中途回墨尔本）', 102: '星 33 最后一次饭（罗辑）／星 34 交接'}
for n in range(103, 108): TARGET[n] = '星 34 交接'
for n in range(108, 112): TARGET[n] = '星 35 迁徙令'
for n in (112, 113): TARGET[n] = '星 36 墨尔本'
TARGET[114] = '星 37 霍乱'
for n in range(115, 119): TARGET[n] = '星 38 取水口'
for n in (119, 120): TARGET[n] = '星 39 广播'
# 好段落：（章, [块号], 去处, 依据）
KEEP = [
 (89, [9, 10], '星 31 分场 1', '星幕分场大纲引用：树状城市、孩子追机械蜂鸟、老人下围棋'),
 (89, [50], '星 31 分场 3', '星幕分场大纲引用：老兵被指责'),
 (90, [57, 58, 59, 60], '星 34', '星幕分场大纲引用：罗辑松手、不回头（改转述，删“六十一年”等数字）'),
 (90, [73, 74], '星 36 分场 2', '星幕分场大纲引用：抢半片发霉的面包（写简短）'),
 (90, [75], '星 35', '星幕分场大纲引用：罗辑递半碗清水（转述）'),
 (105, list(range(13, 21)) + list(range(75, 81)), '星 54', '星幕分场大纲引用：石屋、辘轳、碳化种子、手稿（原属错位稿）'),
 (109, [66, 67], '星 59 或星 55（备用）', '审稿报告亮点：程心童年祖母家水缸与小金鱼；块 68 总结句不收'),
 (112, [3, 4], '备用', '审稿报告：四维视角看见自己的心脏，意象可留，删感叹'),
 (112, list(range(29, 48)), '备用', '审稿报告：魔戒残骸在“涨潮”时的回应，本段原创度最高'),
 (114, [40, 42, 46], '备用', '审稿报告：五公斤生态球反转为“对称性破缺之种”'),
 (118, [52, 53], '备用', '审稿报告：童话作为跨维度记忆载体'),
 (119, [53, 54, 55, 56], '星 42 分场 3', '星幕分场大纲引用：智子点茶细节'),
]
keepset = {(n, b): tgt for n, bs, tgt, _ in KEEP for b in bs}
arch = ['# 错位章好段落存档（工序 4）', '', '来源：第 88–90、99–120 章（旧章号，工作稿经工序 2–3 清理后的文本；未清理原文见 _orig/）。块号为 json 原始块号。', '']
idx = ['# 错位章章题与正文对照（工序 4）', '', '| 旧章 | 章题 | 正文实际写的是 | 块数 | 新去处 |', '| --- | --- | --- | --- | --- |']
for n in CHS:
    ch = L.read(n)
    idx.append(f"| {n} | {ch['title']} | {ch['blocks'][0]['text'][:40]}… | {len(ch['blocks'])} | {TARGET[n]} |")
    ch['meta']['status'] = f'待重写（工序 4：章题与正文错位）→ {TARGET[n]}'
    for b in ch['blocks']:
        k = (n, b['n'])
        b['flag'] = f'待重写 · 已存档→{keepset[k]}' if k in keepset else '待重写'
    if APPLY: L.write(ch)
for n, bs, tgt, why in KEEP:
    ch = {b['n']: b['text'] for b in L.read(n)['blocks']}
    missing = [b for b in bs if b not in ch]
    arch += [f'## 旧第 {n} 章 块 {bs[0]}–{bs[-1]} → {tgt}', '', f'依据：{why}' + (f'（块 {missing} 已在工序 2/3 删去）' if missing else ''), '']
    for b in bs:
        if b in ch: arch += [f'> 〔块 {b}〕 ' + ch[b].replace('\n', '\n> '), '>']
    arch.append('')
if APPLY:
    open(os.path.join(L.ROOT, 'archive', '错位章_好段落.md'), 'w', encoding='utf-8').write('\n'.join(arch) + '\n')
    open(os.path.join(L.ROOT, 'archive', '错位章_章题与正文对照.md'), 'w', encoding='utf-8').write('\n'.join(idx) + '\n')
print(len(CHS), 'chapters flagged;', sum(len(x[1]) for x in KEEP), 'blocks archived')
