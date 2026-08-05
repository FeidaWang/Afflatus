import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'parse5';

const html = readFileSync('signal.html', 'utf8');
const css = readFileSync('public/styles/signal.css', 'utf8');

function walk(node, visit) {
  visit(node);
  (node.childNodes || []).forEach((child) => walk(child, visit));
}

describe('signal policy reaction story', () => {
  it('ships five bilingual causal steps before the incident archive', () => {
    const document = parse(html);
    const steps = [];
    walk(document, (node) => {
      const attrs = Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
      if (attrs['data-policy-step'] != null) steps.push(attrs);
    });
    expect(steps).toHaveLength(5);
    expect(steps.every((attrs) => attrs.tabindex === '0')).toBe(true);
    expect(html.indexOf('id="ch00"')).toBeLessThan(html.indexOf('id="ch03"'));
  });

  it('connects inputs, the Fed filter, pricing and assets', () => {
    ['01 · INPUTS', '02 · FED FILTER', '03 · PRICING', '04 · ASSETS']
      .forEach((label) => expect(html).toContain(label));
    expect(html).toContain('IntersectionObserver');
    expect(html).toContain('prefers-reduced-motion: reduce');
  });

  it('uses preloaded self-hosted fonts so the dossier does not reflow', () => {
    expect(html).toContain('anton-latin-400-normal.woff2');
    expect(html).toContain('jetbrains-mono-latin-400-normal.woff2');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(css).toContain("'Marathon Shapiro 65'");
    expect(css).toContain("'JetBrains Mono'");
  });

  it('renders the historical-data warning with dark text on the paper surface', () => {
    expect(css).toMatch(/\.signal-stale-notice\{[^}]*color:#533b00;[^}]*font:700/s);
    expect(css).toMatch(/\.signal-stale-notice\{[^}]*text-shadow:none/s);
  });

  it('keeps the localized language link dark on its amber control', () => {
    expect(css).toMatch(/\.lang-toggle,\.nav \.lang-toggle\{[^}]*color:#1a1a1c;[^}]*background:var\(--amber\)/s);
  });
});
