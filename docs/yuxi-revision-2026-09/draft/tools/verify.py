"""全文残留搜索。用法：python3 tools/verify.py step2|step3|all  → 列出命中，零命中即通过。"""
import sys, re, os
sys.path.insert(0, os.path.dirname(__file__)); import draftlib as L
CHECKS = {
 'step2': {
  '写作流程': r'总字数|累计字数|全书.{0,6}字数|字数(?:正式|突破|跨越)|万字|重复率|无重复|Batch|第[一二三]部[·《（]|明幕第一部|前[一二三四五六七八九十百\d]+章|后一百章|第\s*\d+\s*至\s*\d+\s*[章幕]|[一二]百(?:二十)?章|第一百章|四十卷|九十卷|第\s*\d+\s*幕|完成进度|全剧终|(?:明幕|星幕|营幕)篇(?:第|·|进阶|母舰|序列|通道)|百万字',
  'LaTeX': r'\$|\\[a-zA-Z]+|\^\{|_\{|\x0c|rac\{',
  '占位符': r'20[0-9]X|19[0-9]X|20XX|XXXX',
  '拼音错字': r'[一-鿿](?:jie|luo|ji|ye|wen|dao|wei|ling|ke|cheng|xin)(?![a-zA-Z])',
  'Markdown': r'\*\*',
 },
 'step3': {
  '旧人名': r'白道伟|常令可|常梦云|(?<![天命指号法政])道伟(?![力大])|(?<![常命指号法政])令可(?!以|能)|梦云',
  '前史': r'太医世家|医学世家|御医世家|杏林世家|常家(?:数代|世代|先祖|唯一的传人)|世代相传、边缘磨损|数世轮回|历经数世|两世|前世|崇祯十六年|一八八八|1888(?![万\d,])|钟表匠|钟表铺|钟表行|老钟表|皇家展览馆|墨尔本世博会|百年纪念国际博览会|维多利亚雾都|蒸汽时代|第一场工业革命|玉犀宫|因果试炼|三重试炼|三阶段试炼|第[一二三]重试炼|试炼场|四百年试炼|青年药童|海防要塞|格式化封印|四百年前在墨尔本|四百年前墨尔本',
 },
}
# 白名单：合法用法（与前史无关），逐条说明
ALLOW = {
 ('step3', '前史', 77, 50): '白道微以崇祯十六年李自成破西安作历史类比，是史实引用，不是前史',
}
def run(names):
    total = 0
    for name in names:
        for label, pat in CHECKS[name].items():
            rx = re.compile(pat); hits = []
            for n in L.all_ids():
                ch = L.read(n)
                for m in rx.finditer(ch['title']): hits.append(f"ch{n} 标题: {ch['title']}")
                for b in ch['blocks']:
                    if (name, label, n, b['n']) in ALLOW: continue
                    for m in rx.finditer(b['text']):
                        hits.append(f"ch{n} b{b['n']}: …{b['text'][max(0,m.start()-20):m.end()+20]}…")
            total += len(hits)
            print(f'[{name}] {label}: {len(hits)}'); print('\n'.join(hits[:15]))
    return total
def step4():
    bad = []
    for n in [88, 89, 90] + list(range(99, 121)):
        ch = L.read(n)
        if not ch['meta'].get('status', '').startswith('待重写'): bad.append(f'ch{n} meta')
        bad += [f"ch{n} b{b['n']}" for b in ch['blocks'] if not b.get('flag', '').startswith('待重写')]
    print('[step4] 错位章未标记:', len(bad)); print('\n'.join(bad[:15])); return len(bad)
def step5():
    import glob, json
    bad = []
    for f in glob.glob(os.path.join(L.ROOT, 'logs', 'step5_decisions', '*.json')):
        if 'coverage' in f: continue
        for g in json.load(open(f, encoding='utf-8')):
            if not g.get('ch') or (g.get('cross_chapter') and not g.get('delete')): continue
            ch = {b['n']: b['text'] for b in L.read(g['ch'])['blocks']}
            bad += [f"ch{g['ch']} b{b} 应删未删" for b in g.get('delete') or [] if b in ch]
            bad += [f"ch{g['ch']} b{t['block']} 重复段仍在" for t in g.get('trim') or [] if t['remove_text'] in ch.get(t['block'], '')]
    print('[step5] 重复稿残留:', len(bad)); print('\n'.join(bad[:15])); return len(bad)
if __name__ == '__main__':
    args = sys.argv[1:] or ['all']
    names = list(CHECKS) if args == ['all'] else [a for a in args if a in CHECKS]
    t = run(names)
    if args == ['all'] or 'step4' in args: t += step4()
    if args == ['all'] or 'step5' in args: t += step5()
    print('TOTAL', t); sys.exit(1 if t else 0)
