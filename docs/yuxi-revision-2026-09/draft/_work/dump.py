import sys, os
sys.path.insert(0,'tools'); import draftlib as L
def orig(n):
    save=L.CH; L.CH=os.path.join(L.ROOT,'_orig'); r=L.read(n); L.CH=save; return r
W=int(sys.argv[1]); specs=sys.argv[2:]
for s in specs:
    c,r=s.split(':'); c=int(c); a,b=(r.split('-')+[r])[:2]; a,b=int(a),int(b)
    d={x['n']:x for x in L.read(c)['blocks']}; o={x['n']:x for x in orig(c)['blocks']}
    print(f'=== ch{c} b{a}-{b}')
    for n in range(a,b+1):
        if n not in o: continue
        t=(d[n] if n in d else o[n])['text'].replace('\n',' ')
        st='' if n in d else '[已删]'
        fl=d[n].get('flag','') if n in d else ''
        print(f' b{n}{st}{fl}: {t[:W]}')
