// tests/sectorsCopyParity.test.js
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractCopy } from '../scripts/sectors-copy-parity.mjs';

// §2.3 deletions: strings that may disappear. Fill with the exact data-en values of the removed elements.
const ALLOWED_REMOVALS = JSON.parse(readFileSync('scripts/data/sectors-allowed-removals.json', 'utf8'));
const before = extractCopy(execSync('git show main:sectors.html', { encoding: 'utf8' }));
const after = extractCopy(readFileSync('sectors.html', 'utf8'));

describe('sectors copy parity', () => {
  it('drops only strings listed in the §2.3 deletion list', () => {
    const lost = [...before].filter((s) => !after.has(s) && !ALLOWED_REMOVALS.includes(s));
    expect(lost).toEqual([]);
  });
  it('keeps en/zh paired on every element', () => {
    const html = readFileSync('sectors.html', 'utf8');
    const en = (html.match(/\sdata-en="/g) ?? []).length;
    const zh = (html.match(/\sdata-zh="/g) ?? []).length;
    expect(en).toBe(zh);
  });
});
