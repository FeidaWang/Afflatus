"""工序 2：清写作流程残留、LaTeX 残片、200X 占位符、拼音错字、Markdown 加粗残片。
用法：python3 tools/step2_residue.py [--apply]；日志写 logs/step2.md"""
import sys, re, os
sys.path.insert(0, os.path.dirname(__file__)); import draftlib as L
APPLY = '--apply' in sys.argv
META = re.compile(r'总字数|累计字数|全书.{0,6}字数|字数(?:正式|突破|跨越)|万字|重复率|无重复|Batch|第[一二三]部[·《（]|第[一二三]部(?:明|星|营)幕|明幕第一部|前[一二三四五六七八九十百\d]+章|后一百章|第\s*\d+\s*至\s*\d+\s*[章幕]|[一二]百(?:二十)?章|第一百章|百章|四十卷|九十卷|全\s*40\s*幕|第\s*\d+\s*幕|第\s*\d+\s*阶段|完成进度|全剧终|(?:明幕|星幕|营幕)篇(?:第|·|进阶|母舰|序列|通道)|第 ?40 ?章终章|第一部终幕|营幕篇预载|百万字|百万雄文')
SENT = re.compile(r'[^。！？!?…]*(?:[。！？!?…]+[”’」』】]*|$)')
# 手工决定：整块删除（句子删除后引号不配平或整块都是元叙述）
FORCE_DEL = {(90,90),(90,92),(90,95),(90,109),(100,34),(100,44),(100,45),(100,46),(100,47),(100,67),(100,68),(100,88),(100,89),(100,26),(100,48),(100,51),(100,61),(100,66),(100,79),(100,86),(120,29),(120,51),(120,67),(120,71),(105,96)}
FORCE_KEEP = set()
SPECIAL = {(65,91): ('“道微，第二部《星幕篇·黑暗森林》的四十年序幕，在今天正式铺开了。', '“道微，')}
LATEX_BLOCK = {
 (142,50): "t′ = t / √(1 − v²/c²)",
 (142,59): "lim(v→c⁻) 1 / √(1 − v²/c²) = +∞",
 (142,64): "dτ = √g₀₀ · dt",
}
def latex(s):
    s = s.replace('$\\Omega，', 'Ω大于一的宇宙里，')  # ch150 b14 断掉的公式
    def inner(m):
        t = m.group(1)
        rep = [(r'\\\\Omega','Ω'),(r'\\Omega','Ω'),(r'\\infty','∞'),(r'\\dot\{P\}','Ṗ'),(r'_\{00\}','₀₀'),(r'_\{0\}','₀'),(r'_0','₀'),(r'\^2','²'),(r'\\tau','τ'),(r'\\,',' ')]
        for a,b in rep: t = re.sub(a, b, t)
        return t.strip()
    s = re.sub(r'\$([^$\n]{1,80})\$', inner, s)
    return s
def fix_misc(s):
    s = s.replace('叶文jie', '叶文洁')
    s = s.replace('（200X-2208）', '')
    s = s.replace('**', '')
    return s
def strip_meta(s):
    s2 = re.sub(r'【[^【】]*】', lambda m: '' if META.search(m.group(0)) else m.group(0), s)
    parts = [p for p in SENT.findall(s2) if p]
    kept = [p for p in parts if not META.search(p)]
    return ''.join(kept)
log = ['# 工序 2 清残留日志', '', '| 章 | 块 | 处理 | 原文摘录 |', '| --- | --- | --- | --- |']
stats = {'删块':0,'删句/删括注':0,'LaTeX':0,'其他':0}
for n in L.all_ids():
    ch = L.read(n); newb = []
    for b in ch['blocks']:
        t0 = b['text']; key = (n, b['n'])
        if key in FORCE_DEL:
            stats['删块'] += 1; log.append(f"| {n} | {b['n']} | 删块（元叙述） | {t0[:60]} |"); continue
        t = t0
        if key in SPECIAL: t = t.replace(*SPECIAL[key]); assert t != t0, key
        if key in LATEX_BLOCK:
            t = LATEX_BLOCK[key]
        else:
            t = latex(t)
        if t != t0: stats['LaTeX'] += 1; log.append(f"| {n} | {b['n']} | LaTeX→纯文本 | {t0[:40]} → {t[:40]} |")
        t1 = fix_misc(t)
        if t1 != t: stats['其他'] += 1; log.append(f"| {n} | {b['n']} | 错字/占位符/加粗 | {t[:40]} |")
        t = t1
        if META.search(t) and key not in FORCE_KEEP:
            t2 = strip_meta(t)
            if re.sub(r'[\s\W_]', '', t2) == '':
                stats['删块'] += 1; log.append(f"| {n} | {b['n']} | 删块（写作流程） | {t[:60]} |"); continue
            if t2 != t:
                stats['删句/删括注'] += 1; print('  META', n, b['n'], [m.group(0) for m in META.finditer(t)]); log.append(f"| {n} | {b['n']} | 删句 | {t[:50]} ⇒ {t2[:50]} |")
                if t2.count('“') != t2.count('”'): print('QUOTE-UNBALANCED', n, b['n'], t2[:120])
            t = t2
        b['text'] = t; newb.append(b)
    ch['blocks'] = newb
    if APPLY: L.write(ch)
log.insert(2, '统计：' + '，'.join(f'{k} {v}' for k, v in stats.items()))
os.makedirs(os.path.join(L.ROOT, 'logs'), exist_ok=True)
if APPLY: open(os.path.join(L.ROOT, 'logs', 'step2.md'), 'w', encoding='utf-8').write('\n'.join(log) + '\n')
print(stats); print('\n'.join(log[5:]) if not APPLY else 'applied')
