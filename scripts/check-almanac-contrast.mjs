#!/usr/bin/env node
/* check-almanac-contrast.mjs — checks the almanac tokens shipped in
 * public/styles/horoscope-almanac.css against the contrast table in
 * docs/horoscope-almanac-2026-10-22/DESIGN.md §4.1 (WCAG 2.x ratios).
 * Fails if a text pair drops below 4.5:1 or drifts from the documented ratio.
 *
 * Usage: node scripts/check-almanac-contrast.mjs */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// [foreground, background, documented day ratio, documented night ratio, is text]
// null means DESIGN.md gives no figure for that theme; the pair is still measured.
export const ALMANAC_PAIRS = [
  ['panel', 'paper', 1.11, 1.10, false],
  ['ink', 'paper', 14.7, 15.7, true],
  ['mid', 'paper', 5.60, 7.32, true],
  ['mid', 'panel', 5.06, null, true],
  ['lit-ink', 'paper', 5.23, 7.25, true],
  ['on-lit', 'lit', 5.18, 6.01, true],
  ['wood', 'paper', 4.52, 8.51, true],
  ['fire', 'paper', 4.68, 6.58, true],
  ['earth', 'paper', 4.53, 8.55, true],
  ['metal', 'paper', 4.51, 8.18, true],
  ['water', 'paper', 5.85, 7.41, true],
];

function luminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map((part) => parseInt(part, 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function tokens(block) {
  return Object.fromEntries([...block.matchAll(/--([a-z-]+):(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
}

export function almanacThemes(css) {
  const day = /html\[data-fx="almanac"\],\s*html\[data-fx="almanac"\] \.observatory-page\{([^}]*)\}/.exec(css);
  const night = /html\[data-fx="almanac"\]\[data-alm-theme="dark"\],\s*html\[data-fx="almanac"\]\[data-alm-theme="dark"\] \.observatory-page\{([^}]*)\}/.exec(css);
  if (!day || !night) throw new Error('Almanac token blocks not found in horoscope-almanac.css');
  return { day: tokens(day[1]), night: tokens(night[1]) };
}

export function almanacContrastReport(css, tolerance = 0.02) {
  const themes = almanacThemes(css);
  const rows = [];
  for (const [fg, bg, dayDoc, nightDoc, isText] of ALMANAC_PAIRS) {
    for (const [theme, documented] of [['day', dayDoc], ['night', nightDoc]]) {
      const colours = themes[theme];
      const ratio = contrast(colours[fg], colours[bg]);
      const problems = [];
      if (isText && ratio < 4.5) problems.push('below 4.5:1');
      if (documented != null && Math.abs(ratio - documented) > tolerance * Math.max(1, documented / 5)) problems.push(`documented ${documented}`);
      rows.push({ theme, pair: `--${fg} on --${bg}`, fg: colours[fg], bg: colours[bg], ratio: Math.round(ratio * 100) / 100, documented, ok: problems.length === 0, problems });
    }
  }
  return rows;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = almanacContrastReport(readFileSync('public/styles/horoscope-almanac.css', 'utf8'));
  console.log('| theme | pair | colours | ratio | DESIGN.md §4.1 | result |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const row of rows) {
    console.log(`| ${row.theme} | ${row.pair} | ${row.fg} / ${row.bg} | ${row.ratio.toFixed(2)} | ${row.documented ?? '—'} | ${row.ok ? 'OK' : `FAIL: ${row.problems.join(', ')}`} |`);
  }
  process.exit(rows.every((row) => row.ok) ? 0 : 1);
}
