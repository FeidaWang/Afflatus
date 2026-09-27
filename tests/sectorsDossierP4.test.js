import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';
import { data, updatePage } from '../scripts/sectors-dossier.mjs';

describe('P4 issuer and thesis evidence contract', () => {
 it('groups counters and receipts by issuer without scores or valuations', () => {
  expect(data.issuers.map(i => i.id)).toEqual(['broadcom','micron','alibaba','xiaomi']);
  const baba = data.issuers.find(i => i.id === 'alibaba');
  expect(baba.instruments.map(i => i.symbol)).toEqual(['BABA','9988','89988']);
  expect(baba.instruments[0].kind.en).toContain('8 ordinary shares');
  expect(data.issuers.find(i => i.id === 'micron').roles).toEqual(['supplier','investor','customer']);
  for (const i of data.issuers) {
   expect(i).not.toHaveProperty('score'); expect(i).not.toHaveProperty('price');
   expect(i.materiality.en).toContain('Unknown');
   for (const id of i.source_ids) expect(data.sources.find(s => s.id === id)?.verification).toBe('read_primary_on_2026-09-23');
  }
 });
 it('preserves all eight supplied theses and resolves every evidence and issuer cross-reference', () => {
  const supplied = JSON.parse(readFileSync('docs/Afflatus-Sectors-Frontier-V2/data/theses.json'));
  expect(data.theses).toHaveLength(8);
  for (const [index,t] of data.theses.entries()) {
   expect(t).toMatchObject(supplied[index]);
   expect(t.uncertainty.en).toBeTruthy(); expect(t.uncertainty.zh).toBeTruthy();
   for (const id of t.source_ids) expect(data.sources.some(s => s.id === id)).toBe(true);
  }
  for (const i of data.issuers) for (const id of i.thesis_ids) expect(data.theses.some(t => t.id === id)).toBe(true);
 });
 it('ships complete static bilingual content with unique IDs and resolvable anchors', () => {
  const html=readFileSync('sectors.html','utf8'); expect(updatePage(html)).toBe(html);
  const nodes=[]; const visit=n=>{nodes.push(n);n.childNodes?.forEach(visit);};visit(parse(html));
  const attr=(n,key)=>n.attrs?.find(a=>a.name===key)?.value;
  const ids=nodes.map(n=>attr(n,'id')).filter(Boolean);
  expect(new Set(ids).size).toBe(ids.length);
  for (const n of nodes) {
   const href=attr(n,'href'); if(href?.startsWith('#p4-')||href?.startsWith('#thesis-')) expect(ids).toContain(href.slice(1));
  }
  const current=html.slice(html.indexOf('<section id="issuers"'),html.indexOf('<details id="researchArchive"'));
  expect(current).not.toMatch(/US10|CN10|10 US|10 China/);
 });
});
