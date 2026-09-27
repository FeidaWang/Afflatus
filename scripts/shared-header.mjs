import { readFileSync, writeFileSync } from 'node:fs';
import { BUILD_ROUTES } from '../src/config/siteManifest.js';
import { renderSharedHeader } from '../src/lib/sharedHeader.js';

export const HEADER_START = '<!-- shared-header:start -->';
export const HEADER_END = '<!-- shared-header:end -->';
export const headerBlockFor = () => `${HEADER_START}\n${renderSharedHeader()}\n${HEADER_END}`;
export const headerFiles = [...BUILD_ROUTES.map(route => route.file), 'public/404.html'];
const write = process.argv.includes('--write');
if (write) for (const file of headerFiles) {
  const headerBlock = headerBlockFor(file);
  let source = readFileSync(file, 'utf8');
  if (source.includes(HEADER_START)) source = source.replace(/<!-- shared-header:start -->[\s\S]*?<!-- shared-header:end -->/, headerBlock);
  else source = source.replace(/(<body\b[^>]*>)/, `$1\n${headerBlock}`);
  if (!source.includes('/styles/shared-header.css')) source = source.replace('</head>', '<link rel="stylesheet" href="/styles/shared-header.css">\n</head>');
  writeFileSync(file, source);
}
