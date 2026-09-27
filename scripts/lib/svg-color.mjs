// scripts/lib/svg-color.mjs
const NEUTRAL = new Set(['#000000', '#FFFFFF', '#FFF', '#000']);
export function dominantSvgColor(svg) {
  const counts = new Map();
  for (const [, hex] of svg.matchAll(/(?:fill|stop-color|stroke)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g)) {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
    const key = full.toUpperCase();
    if (NEUTRAL.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}
