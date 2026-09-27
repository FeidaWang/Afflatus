export function extractCopy(html) {
  const out = new Set();
  for (const [, v] of html.matchAll(/\sdata-(?:en|zh)="([^"]*)"/g)) if (v.trim()) out.add(v.trim());
  return out;
}
