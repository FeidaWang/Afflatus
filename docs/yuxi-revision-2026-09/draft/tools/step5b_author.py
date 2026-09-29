"""工序 5 补：作者 2026-09-30 对“待作者定”重复稿的答复。用法：python3 tools/step5b_author.py [--apply]；日志追加到 logs/step5b_author.md"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); import draftlib as L
APPLY = '--apply' in sys.argv
# (章, 操作, 块, 参数, 说明)
OPS = [
 (8, 'del', 70, None, '海瑞喂饥童两版：删第 8 章块 70，留第 9 章块 4–5（海瑞首次登场）'),
 (8, 'del', 52, None, '沙船抵达三处：删第 8 章块 52–54，首次露面放到第 9 章块 66–67、第 10 章'),
 (8, 'del', 53, None, '同上'),
 (8, 'del', 54, None, '同上'),
 (8, 'sub', 63, ('码头上的二十四条大船', '正往淳安来的二十四条大船'), '沙船尚未抵达，田掌事台词改为船在路上'),
 (26, 'flag', 92, '待改-腹稿', '写疏两次：第 26 章结尾改为风雪夜归、心里打下第一行腹稿；真正落笔只在第 27 章块 27–28'),
]
log = ['# 工序 5 补：作者答复（2026-09-30）', '', '| 章 | 块 | 操作 | 说明 |', '| --- | --- | --- | --- |']
for n in sorted({o[0] for o in OPS}):
    ch = L.read(n); by = {b['n']: b for b in ch['blocks']}
    drop = set()
    for (c, op, bn, arg, note) in OPS:
        if c != n: continue
        assert bn in by, (n, bn)
        b = by[bn]
        if op == 'del': drop.add(bn)
        elif op == 'sub':
            assert b['text'].count(arg[0]) == 1, (n, bn); b['text'] = b['text'].replace(*arg)
        elif op == 'flag': b['flag'] = arg
        log.append(f'| {n} | {bn} | {op}{("：" + arg[0] + " → " + arg[1]) if op == "sub" else (" " + arg if op == "flag" else "")} | {note} |')
    ch['blocks'] = [b for b in ch['blocks'] if b['n'] not in drop]
    if APPLY: L.write(ch)
log += ['', '另：第 15 章块 40–41（海瑞驳郑泌昌“为尊者讳”）作者定为保留，排进堂审交锋，正文不动，已写入《明幕分场大纲》第 15 章。']
if APPLY: open(os.path.join(L.ROOT, 'logs', 'step5b_author.md'), 'w', encoding='utf-8').write('\n'.join(log) + '\n')
print('\n'.join(log))
