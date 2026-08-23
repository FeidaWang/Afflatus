import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/showcase/App.jsx', 'utf8');
const fallback = readFileSync('index.html', 'utf8');
const css = readFileSync('src/showcase/showcase.css', 'utf8');

describe('M12 closing journey', () => {
  it('keeps one current signal and exactly three related transmissions', () => {
    expect(app.match(/<TransmissionRow/g)).toHaveLength(1);
    expect(app).toContain('transmissions.map');
    expect(fallback.match(/class="transmission-row"/g)).toHaveLength(3);
    expect(app).not.toMatch(/metrics-grid|metric-card/);
  });

  it('summarizes the FY25\/26 field record without exposing live positions', () => {
    expect(app).toContain('05 verified closed-cycle entries');
    expect(app).toContain('without account values or live positions');
    expect(fallback).toContain('FY25/26 · 05 verified closed-cycle entries');
  });

  it('ends with one manifesto command and a quiet nominal footer', () => {
    expect(app).toContain('className="manifesto-command"');
    expect(app.match(/ALL SYSTEMS NOMINAL/g)).toHaveLength(1);
    expect(fallback.match(/>ALL SYSTEMS NOMINAL</g)).toHaveLength(1);
    expect(css).toMatch(/\.chapter-manifesto\s*\{[\s\S]*min-height:\s*90svh/);
    expect(css).toContain('/* Quiet footer */');
  });
});
