// scripts/fetch-official-logos.mjs
// Usage: node scripts/fetch-official-logos.mjs [--only=id,id] [--import=dir]
// Reads LOGO_SOURCES; downloads each asset URL (or, with --import, takes <dir>/<id>.<ext> saved from the
// official page by a browser), checks the page host belongs to the company's official domain and that the
// bytes match the recorded sha256, writes the file and a manifest row.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { COMPANIES } from './data/sectors-industry-seed.mjs';
import { dominantSvgColor } from './lib/svg-color.mjs';

const DIR = 'public/assets/sectors/logos';
const OUT = `${DIR}/official`;
const TODAY = new Date().toISOString().slice(0, 10);
// Official brand-guide colours, where the company publishes one (id → { hex, url }).
// Fill in only from a page on the official domain; otherwise leave the id out and the logo file decides.
const BRAND_GUIDE = {};
// id → { page, asset, kind, sha256?, retrieved_on?, background? }: page = official page showing the logo
// (must be on the official domain); asset = the file URL that page loads (may sit on the company's CDN),
// or the page itself when the logo is inline SVG.
const LOGO_SOURCES = JSON.parse(readFileSync('scripts/data/logo-sources.json', 'utf8'));

const manifestPath = `${DIR}/manifest.json`;
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const importDir = process.argv.find((a) => a.startsWith('--import='))?.slice(9);
mkdirSync(OUT, { recursive: true });

for (const [id, , , , nameEn, , , , , , , , , domain] of COMPANIES) {
  if (only && !only.includes(id)) continue;
  const entry = LOGO_SOURCES[id];
  if (!entry?.page || !entry?.asset) { manifest[id] = { ...(manifest[id] ?? {}), status: 'needs_manual' }; continue; }
  const host = new URL(entry.page).hostname;
  if (!(host === domain || host.endsWith(`.${domain}`))) { console.error(`${id}: page ${host} is not under ${domain}`); process.exitCode = 1; continue; }
  let buf;
  let ext;
  if (importDir) {
    const name = readdirSync(importDir).find((n) => n.startsWith(`${id}.`) && /\.(svg|png|webp)$/.test(n));
    if (!name) { manifest[id] = { ...(manifest[id] ?? {}), status: 'needs_manual' }; continue; }
    buf = readFileSync(`${importDir}/${name}`);
    ext = name.split('.').pop();
  } else {
    const res = await fetch(entry.asset, { headers: { 'user-agent': 'Mozilla/5.0 AFFLATUS logo provenance' } });
    if (!res.ok) { manifest[id] = { ...(manifest[id] ?? {}), status: 'needs_manual', last_error: res.status }; continue; }
    buf = Buffer.from(await res.arrayBuffer());
    const e = entry.asset.split('?')[0].split('.').pop().toLowerCase();
    ext = ['svg', 'png', 'webp'].includes(e) ? e : 'svg';
  }
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (entry.sha256 && entry.sha256 !== sha256) { console.error(`${id}: sha256 differs from logo-sources.json`); process.exitCode = 1; continue; }
  const file = `${id}.${ext}`;
  writeFileSync(`${OUT}/${file}`, buf);
  const guide = BRAND_GUIDE[id];
  const fromFile = ext === 'svg' ? dominantSvgColor(buf.toString('utf8')) : null;
  // Keep the hand-checked web crop (public/assets/sectors/logos/web) while the source bytes are unchanged.
  const prev = manifest[id] ?? {};
  const web = prev.sha256 === sha256 ? Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith('web_'))) : {};
  manifest[id] = {
    name: nameEn, file: `/assets/sectors/logos/official/${file}`, source_page: entry.page, source_url: entry.asset,
    kind: entry.kind ?? 'file', retrieved_on: entry.retrieved_on ?? TODAY, sha256,
    brand_color: guide?.hex ?? fromFile ?? '#141413',
    color_basis: guide ? 'brand_guide' : fromFile ? 'logo_file' : 'fallback',
    color_source_url: guide?.url ?? entry.page, background: entry.background ?? 'light', status: 'ok', ...web,
  };
}
writeFileSync(manifestPath, `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2)}\n`);
