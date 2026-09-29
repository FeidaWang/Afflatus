"""工序 5：合并重复稿。按 logs/step5_decisions/*.json（四个分段的决策）删块、块内删重复段。
用法：python3 tools/step5_apply.py [--apply]；日志 logs/step5.md"""
import sys, os, json, glob, collections
sys.path.insert(0, os.path.dirname(__file__)); import draftlib as L
APPLY = '--apply' in sys.argv
groups = []
for f in sorted(glob.glob(os.path.join(L.ROOT, 'logs', 'step5_decisions', '*.json'))):
    if 'coverage' in f: continue
    groups += json.load(open(f, encoding='utf-8'))
dels = collections.defaultdict(set); trims = collections.defaultdict(list)
for g in groups:
    if g.get('cross_chapter') and not g.get('delete'): continue
    for b in g.get('delete') or []: dels[g['ch']].add(b)
    for t in g.get('trim') or []: trims[g['ch']].append((t['block'], t['remove_text']))
log = ['# 工序 5 合并重复稿日志', '', '', '| 章 | 保留 | 删除 | 依据 | 说明 |', '| --- | --- | --- | --- | --- |']
nd = nt = 0
for n in L.all_ids():
    if n not in dels and n not in trims: continue
    ch = L.read(n); keep = []
    have = {b['n'] for b in ch['blocks']}
    assert dels[n] <= have, (n, dels[n] - have)
    for b in ch['blocks']:
        if b['n'] in dels[n]: nd += 1; continue
        for bn, txt in trims[n]:
            if bn == b['n']:
                assert b['text'].count(txt) == 1, (n, bn); b['text'] = b['text'].replace(txt, ''); nt += 1
        keep.append(b)
    ch['blocks'] = keep
    if APPLY: L.write(ch)
def rng(xs):
    xs = sorted(xs); out = []
    for x in xs:
        if out and x == out[-1][1] + 1: out[-1][1] = x
        else: out.append([x, x])
    return '、'.join(f'{a}' if a == b else f'{a}–{b}' for a, b in out)
for g in sorted(groups, key=lambda g: (g.get('ch') or 0)):
    d = rng(g.get('delete') or []) + ('；块内删 ' + '、'.join(str(t['block']) for t in g['trim']) if g.get('trim') else '')
    tag = '跨章·只记录' if g.get('cross_chapter') and not g.get('delete') else g.get('source', '')
    log.append(f"| {g.get('ch')} | {rng(g.get('keep') or [])} | {d or '—'} | {tag} | {g.get('group','')}；{g.get('reason','')}{('；可救细节：' + g['salvage']) if g.get('salvage') else ''} |".replace('\n', ' '))
log[2] = f'统计：{len(groups)} 条决策，整块删除 {nd} 块，块内删重复段 {nt} 处。被删原文见 _orig/ 同名文件（块号不变）。'
if APPLY: open(os.path.join(L.ROOT, 'logs', 'step5.md'), 'w', encoding='utf-8').write('\n'.join(log) + '\n')
print(log[2])
