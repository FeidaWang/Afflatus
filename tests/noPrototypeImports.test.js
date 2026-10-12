import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { expect, it } from 'vitest';

// Design prototypes hold fictional data. Production code and pages must copy
// what they need into src/ instead of importing from prototypes/.
const root = resolve(import.meta.dirname, '..');
const SOURCE = /\.(?:[cm]?js|jsx|tsx?|css|html)$/;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : SOURCE.test(name) ? [path] : [];
  });
}

it('production sources never import from prototypes/', () => {
  const sources = [
    ...files(join(root, 'src')),
    ...files(join(root, 'api')),
    ...readdirSync(root).filter((name) => name.endsWith('.html')).map((name) => join(root, name)),
    join(root, 'vite.config.js'),
  ];
  const offenders = sources
    .filter((path) => /(?:from|import|url)\s*\(?\s*['"][^'"]*prototypes\//.test(readFileSync(path, 'utf8')))
    .map((path) => relative(root, path));
  expect(offenders).toEqual([]);
});
