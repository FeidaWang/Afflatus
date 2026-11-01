import fs from 'node:fs';
const M = new URL('.', import.meta.url).pathname;
const parts = { 'header-a': fs.readFileSync(M + '_header-a.html', 'utf8'), 'footer': fs.readFileSync(M + '_footer.html', 'utf8') };
for (const f of fs.readdirSync(M).filter(f => f.endsWith('.src.html'))) {
  let s = fs.readFileSync(M + f, 'utf8');
  s = s.replace(/<!--@([a-z-]+)-->/g, (_, k) => parts[k] || '');
  fs.writeFileSync(M + f.replace('.src.html', '.html'), s);
  console.log('built', f.replace('.src.html', '.html'));
}
