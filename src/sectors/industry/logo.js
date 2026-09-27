// src/sectors/industry/logo.js — which asset to draw for a company's logo, shared by the globe and the graph.
import { escapeHtml } from '../content.js';

// Prefer the cropped/recoloured web_file; fall back to the original official file, and
// when that fallback is a dark-background asset, flag it for an ink chip.
export function logoAsset(c, manifest) {
  const m = manifest[c.id];
  const initials = escapeHtml((c.ticker ?? c.name.en).slice(0, 2));
  const brand = m?.brand_color ?? null;
  if (m?.web_file) return { src: m.web_file, chip: false, initials, brand };
  if (m?.file) return { src: m.file, chip: m.background === 'dark', initials, brand };
  return { src: null, chip: false, initials, brand };
}
