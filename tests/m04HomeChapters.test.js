import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/showcase/App.jsx', 'utf8');
const fallback = readFileSync('index.html', 'utf8');

const CHAPTERS = [
  '01-cold-void',
  '02-the-approach',
  '03-parallel-drift',
  '04-bridge-aperture',
  '05-the-wake',
  '06-departure',
];

describe('M04 semantic home chapters', () => {
  it('renders the six stable chapter identifiers in narrative order', () => {
    const rendered = [...app.matchAll(/data-chapter="([^"]+)"/g)].map((match) => match[1]);
    const noScript = [...fallback.matchAll(/data-chapter="([^"]+)"/g)].map((match) => match[1]);
    expect(rendered).toEqual(CHAPTERS);
    expect(noScript).toEqual(CHAPTERS);
  });

  it('removes the superseded HUD, chart and duplicate signature surfaces', () => {
    for (const removed of [
      'hero-telemetry',
      'feature-facts',
      'CycleChart',
      'signature-deck',
      'signature-facts',
      'principles-grid',
      'RadarCanvas',
      'DeckScene',
      'G-FORCE',
      'COMBAT',
    ]) {
      expect(app, `${removed} must not remain in the M04 home`).not.toContain(removed);
    }
  });

  it('keeps the first-screen content and complete navigation in the no-JS document', () => {
    expect(fallback).toContain('<h1 id="nojs-chapter-01-title"');
    expect(fallback).toContain('class="desktop-nav" data-afflatus-fallback-nav');
    expect(fallback).toContain('href="/command/" data-en="Enter Command"');
    expect(fallback.indexOf('/src/showcase/showcase.css')).toBeLessThan(
      fallback.indexOf('/src/showcase-main.jsx'),
    );
  });

  it('limits nominal status to one rendered occurrence per locale', () => {
    expect(app.match(/ALL SYSTEMS NOMINAL/g)).toHaveLength(1);
    expect(app.match(/所有系统正常/g)).toHaveLength(1);
    expect(fallback.match(/>ALL SYSTEMS NOMINAL</g)).toHaveLength(1);
  });
});
