#!/usr/bin/env node
/* Local preview of the built site with a private snapshot store behind it, on
   127.0.0.1 only. It is the one way a browser sees collected data today. It adds
   the feed address to each page here and never changes a built file.
     node scripts/elections/serve-local.mjs --store <private folder> [--port 4180] */
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { store: { type: 'string' }, port: { type: 'string', default: '4180' }, dist: { type: 'string', default: 'dist' } } });
if (!values.store) {
  console.error('Usage: serve-local.mjs --store <private folder> [--port 4180]');
  process.exit(2);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif' };
const FEED_PREFIX = '/elections-feed/';
const HOOK = `<script>window.__ELECTION_FEED_BASE__=${JSON.stringify(FEED_PREFIX)};</script>`;
const distRoot = resolve(values.dist);
const storeRoot = resolve(values.store);

// Only the pointer and the snapshots are served. private/ holds collector state and quarantined errors.
const feedPath = (pathname) => (/^[\w-]+\/(latest\.json|snapshots\/[\w.-]+\.json)$/.test(pathname) ? join(storeRoot, pathname) : null);

async function resolveFile(pathname) {
  const path = resolve(distRoot, `.${pathname}`);
  if (path !== distRoot && !path.startsWith(distRoot + sep)) return null;
  for (const candidate of [path, join(path, 'index.html'), `${path}.html`]) {
    if ((await stat(candidate).catch(() => null))?.isFile()) return candidate;
  }
  return null;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://127.0.0.1');
  const decoded = decodeURIComponent(pathname);
  const file = decoded.startsWith(FEED_PREFIX) ? feedPath(decoded.slice(FEED_PREFIX.length)) : await resolveFile(decoded);
  if (!file || !(await stat(file).catch(() => null))?.isFile()) {
    response.writeHead(404).end();
    return;
  }
  const type = TYPES[extname(file)] || 'application/octet-stream';
  if (extname(file) === '.html') {
    const html = await readFile(file, 'utf8');
    response.writeHead(200, { 'content-type': type }).end(html.replace('<head>', `<head>${HOOK}`));
    return;
  }
  response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  createReadStream(file).pipe(response);
}).listen(Number(values.port), '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${values.port}/en/elections.html?event=vic-2026  (store: ${storeRoot})`);
});
