"""工序 3：统一人名（白道伟/常令可/常梦云→白道微/常灵珂），删前史关键词所在句子。
用法：python3 tools/step3_names_prehistory.py [--apply]；日志 logs/step3.md（被删句子全文保留在日志里）"""
import sys, re, os
sys.path.insert(0, os.path.dirname(__file__)); import draftlib as L
APPLY = '--apply' in sys.argv
NAMES = [(r'白道伟', '白道微'), (r'常令可', '常灵珂'), (r'常梦云', '常灵珂'),
         (r'(?<![天命指号法政])道伟(?![力大])', '道微'), (r'(?<![命指号法政])令可(?!以|能)', '灵珂'), (r'梦云', '灵珂')]
PREHIST = re.compile(
 r'太医世家|医学世家|御医世家|杏林世家|常家(?:数代|世代|先祖|唯一的传人)|常家世代相传|世代相传、边缘磨损'
 r'|数世轮回|历经数世|两世|前世'
 r'|崇祯十六年的大疫|一八八八|1888(?![万\d,])'
 r'|钟表匠|钟表铺|钟表行|老钟表'
 r'|皇家展览馆|墨尔本世博会|百年纪念国际博览会|维多利亚雾都|蒸汽时代|第一场工业革命|玉犀宫'
 r'|因果试炼|三重试炼|三阶段试炼|第[一二三]重试炼|试炼场|四百年试炼'
 r'|青年药童|两百年前在海防要塞|格式化封印'
 r'|四百年前在墨尔本|四百年前墨尔本|四百年前从南半球|四百年前与他一同横穿|四百年前，当他第一次以凡人之躯在墨尔本')
SENT = re.compile(r'[^。！？!?…\n]*(?:[。！？!?…]+[”’」』】]*|\n|$)')
SPECIAL = {
 (72, 25): ('宛如由瑞士钟表匠手工打造的精密游标卡尺', '宛如精密的游标卡尺'),
 (165, 34): ('精确得如同瑞士钟表匠手中的擒纵轮', '精确得如同钟表里的擒纵轮'),
 (54, 22): ('，带着常家世代相传的冷静，', '，'),
 (161, 25): ('则是星幕之后第三重未尽的因果试炼', '则是星幕之后的下一幕'),
}
log = ['# 工序 3 统一人名、删前史日志', '', '', '## 删去的句子（全文保留）', '', '| 章 | 块 | 被删内容 |', '| --- | --- | --- |']
st = {'改名处数': 0, '删句': 0, '删块': 0, '特殊替换': 0}
unbal = []
for n in L.all_ids():
    ch = L.read(n); nb = []
    for b in ch['blocks']:
        t = b['text']; key = (n, b['n'])
        if key in SPECIAL:
            a, c = SPECIAL[key]; assert a in t, key; t = t.replace(a, c); st['特殊替换'] += 1
        for a, c in NAMES:
            t, k = re.subn(a, c, t); st['改名处数'] += k
        if PREHIST.search(t):
            parts = [p for p in SENT.findall(t) if p]
            kept = []
            for p in parts:
                if PREHIST.search(p):
                    st['删句'] += 1; log.append(f"| {n} | {b['n']} | {p.strip().replace('|', '｜').replace(chr(10), ' ')} |")
                else: kept.append(p)
            t2 = ''.join(kept).strip()
            if re.sub(r'[\s\W_]', '', t2) == '':
                st['删块'] += 1; log.append(f"| {n} | {b['n']} | （整块删除） |"); continue
            if t2.count('“') != t2.count('”'):
                unbal.append((n, b['n'], t2[:100])); b['flag'] = '待修-引号（删前史句后引号不配平，原文见 _orig/）'
            t = t2
        b['text'] = t; nb.append(b)
    ch['blocks'] = nb
    if APPLY: L.write(ch)
log[2] = '统计：' + '，'.join(f'{k} {v}' for k, v in st.items())
if APPLY:
    open(os.path.join(L.ROOT, 'logs', 'step3.md'), 'w', encoding='utf-8').write('\n'.join(log) + '\n')
print(st)
for u in unbal: print('UNBAL', u)
