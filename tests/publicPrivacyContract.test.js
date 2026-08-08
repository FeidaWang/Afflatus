import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PUBLIC_EXTENSIONS = new Set(['.html', '.js', '.json', '.css', '.xml', '.txt']);
const PRIVATE_OWNER = ['feida', 'wang'].join('');
const PRIVATE_SOURCE_PATTERN = new RegExp(`(?:github\\.com/${PRIVATE_OWNER}|${PRIVATE_OWNER}/)`, 'i');

function collectFiles(path) {
  return readdirSync(path).flatMap((name) => {
    const target = join(path, name);
    return statSync(target).isDirectory() ? collectFiles(target) : [target];
  });
}

function publicRuntimeFiles() {
  const rootHtml = readdirSync(ROOT)
    .filter((name) => extname(name) === '.html')
    .map((name) => join(ROOT, name));
  const runtimeTrees = ['public', 'src']
    .flatMap((folder) => collectFiles(join(ROOT, folder)))
    .filter((file) => PUBLIC_EXTENSIONS.has(extname(file)));
  return [...rootHtml, ...runtimeTrees];
}

describe('public privacy contract', () => {
  it('never exposes the private owner or repository path in shipped pages and assets', () => {
    const leaks = publicRuntimeFiles()
      .filter((file) => PRIVATE_SOURCE_PATTERN.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));

    expect(leaks).toEqual([]);
  });

  it('pairs every public page carrying the Fable label with the 5.6 Sol Ultra audit label', () => {
    const unpairedPages = readdirSync(ROOT)
      .filter((name) => extname(name) === '.html')
      .filter((name) => {
        const source = readFileSync(join(ROOT, name), 'utf8');
        return /Fable/i.test(source) && !/5\.6 Sol Ultra/i.test(source);
      });

    expect(unpairedPages).toEqual([]);
  });

  it('keeps dynamically rendered Fable labels paired at the point of display', () => {
    const renderers = [
      'src/pages/games.js',
      'src/pages/league.js',
      'src/lib/trackRecord.js',
      'public/games-data.json',
      'public/leagues-data.json',
    ].map((name) => readFileSync(join(ROOT, name), 'utf8'));

    for (const source of renderers) {
      expect(source).toMatch(/FABLE 5 MAX · 5\.6 SOL ULTRA/i);
      expect(source).not.toMatch(/<b>Fable<\/b>/i);
      expect(source).not.toMatch(/FABLE (?:SERIES )?SCORE/);
      expect(source).not.toMatch(/FABLE TRACK RECORD/);
    }
  });
});
