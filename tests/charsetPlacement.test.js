import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Browsers only sniff <meta charset> inside the first 1024 bytes; later and the page can be decoded wrongly.
describe('document charset', () => {
  for (const file of readdirSync('.').filter((name) => name.endsWith('.html'))) {
    it(`${file} declares its charset within the first 1024 bytes`, () => {
      const head = readFileSync(file).subarray(0, 1024).toString('utf8');
      expect(head).toMatch(/<meta charset="utf-8"/i);
    });
  }
});
