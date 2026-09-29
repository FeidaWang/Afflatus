"""工作稿读写。每章一个文本文件 chapters/chNNN.md（旧章号）。
格式：头部 '# 标题' 与 '<!-- meta ... -->'；每个块前一行 '<!-- bN type -->'，N 为 json 里的原始块号（逐章问题清单的块号）。
块被删除时整块移除；块被标记时在注释里加 flag。"""
import json, re, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CH = os.path.join(ROOT, 'chapters')
HDR = re.compile(r'^<!-- b(\d+) (\S+)(?: (.*?))? -->$')

def path(n): return os.path.join(CH, f'ch{n:03d}.md')

def write(ch):
    out = [f"# {ch['title']}", f"<!-- meta {json.dumps(ch.get('meta', {}), ensure_ascii=False)} -->", '']
    for b in ch['blocks']:
        flag = (' ' + b['flag']) if b.get('flag') else ''
        out.append(f"<!-- b{b['n']} {b['type']}{flag} -->")
        out.append(b['text'])
        out.append('')
    open(path(ch['id']), 'w', encoding='utf-8').write('\n'.join(out))

def read(n):
    lines = open(path(n), encoding='utf-8').read().split('\n')
    title = lines[0][2:]
    meta = json.loads(lines[1][len('<!-- meta '):-4])
    blocks, cur = [], None
    for ln in lines[2:]:
        m = HDR.match(ln)
        if m:
            cur = {'n': int(m.group(1)), 'type': m.group(2), 'text': []}
            if m.group(3): cur['flag'] = m.group(3)
            blocks.append(cur)
        elif cur is not None:
            cur['text'].append(ln)
    for b in blocks:
        b['text'] = '\n'.join(b['text']).strip('\n')
    return {'id': n, 'title': title, 'meta': meta, 'blocks': blocks}

def all_ids():
    return sorted(int(os.path.basename(p)[2:5]) for p in glob.glob(os.path.join(CH, 'ch*.md')))
