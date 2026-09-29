"""一次性：从 public/novels/yuxi-gongci.json 导出工作稿（不改 json）。"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__)); import draftlib as L
src = os.path.join(L.ROOT, '..', '..', '..', 'public', 'novels', 'yuxi-gongci.json')
d = json.load(open(src, encoding='utf-8'))
os.makedirs(L.CH, exist_ok=True)
for c in d['chapters']:
    meta = {k: v for k, v in c.items() if k not in ('id', 'title', 'blocks')}
    blocks = []
    for i, b in enumerate(c['blocks']):
        assert '\n<!-- b' not in b['text']
        extra = {k: v for k, v in b.items() if k not in ('type', 'text')}
        if extra: meta.setdefault('blockExtra', {})[str(i)] = extra
        blocks.append({'n': i, 'type': b['type'], 'text': b['text'].strip('\n')})
    L.write({'id': c['id'], 'title': c['title'], 'meta': meta, 'blocks': blocks})
print(len(d['chapters']), 'chapters exported')
