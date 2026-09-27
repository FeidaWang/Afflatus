// scripts/build-sectors-industry.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { COMPANIES, EDGES, FACTS, SOURCES } from './data/sectors-industry-seed.mjs';
import { validateIndustry } from '../src/sectors/industry/industry-core.js';

const DATE = '2026-09-27';
const data = {
  schema_version: 1, snapshot_id: `industry-${DATE}`, retrieved_on: DATE,
  companies: COMPANIES.map(([id, ticker, exchange, listing, nameEn, nameZh, country, cityEn, cityZh, lat, lon, layer, tier, domain, roleEn, roleZh]) => ({
    id, ticker, exchange, listing, name: { en: nameEn, zh: nameZh }, country,
    hq: { city: { en: cityEn, zh: cityZh }, lat, lon }, layer, tier,
    role: { en: roleEn, zh: roleZh }, official_domain: domain,
  })),
  edges: EDGES.map(([id, source, target, type, as_of, amount_usd_b, status, en, zh, source_ids]) => ({
    id, source, target, type, as_of, amount_usd_b, status, label: { en, zh }, source_ids,
  })),
  facts: FACTS,
  sources: SOURCES.map(([id, title, url, publisher, published_at]) => ({ id, title, url, publisher, published_at })),
};
const errors = validateIndustry(data);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
mkdirSync('public/data/sectors-industry', { recursive: true });
writeFileSync(`public/data/sectors-industry/${DATE}.json`, `${JSON.stringify(data, null, 2)}\n`);
console.log(`wrote ${data.companies.length} companies, ${data.edges.length} edges`);
