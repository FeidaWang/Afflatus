// scripts/subset-cjk-fonts.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';

const SRC = 'scripts/fonts-src/NotoSerifSC-SemiBold.ttf';
const OUT = 'public/assets/fonts/noto-serif-sc-subset.woff2';
if (!existsSync(SRC)) { console.log('subset-cjk-fonts: source font missing, keeping committed subset'); process.exit(0); }
const files = ['sectors.html', 'src/sectors/observatory/data.json', 'src/sectors/observatory/controller.js', 'scripts/data/sectors-cjk-font-coverage.txt', ...readdirSync('public/data/sectors-industry').map((f) => `public/data/sectors-industry/${f}`)];
const chars = new Set();
for (const f of files) for (const ch of readFileSync(f, 'utf8')) if (/[　-鿿＀-￯]/.test(ch)) chars.add(ch);
writeFileSync('scripts/fonts-src/chars.txt', [...chars].join(''));
execFileSync('pyftsubset', [SRC, '--text-file=scripts/fonts-src/chars.txt', '--flavor=woff2', `--output-file=${OUT}`]);
console.log(`subset-cjk-fonts: ${chars.size} glyphs`);
