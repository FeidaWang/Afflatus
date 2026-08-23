import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/showcase/App.jsx', 'utf8');
const fallback = readFileSync('index.html', 'utf8');
const css = readFileSync('src/showcase/showcase.css', 'utf8');
const layers = readFileSync('src/showcase/experience/spaceLayers.js', 'utf8');

describe('M11 opening journey', () => {
  it('delays the carrier reveal while keeping the first screen editorial', () => {
    expect(css).toMatch(/transition-delay:\s*520ms/);
    expect(app).toContain('Systems for');
    expect(app).toContain('Explore systems');
    expect(app).not.toMatch(/HUD|telemetry|G-FORCE|COMBAT/);
  });

  it('uses a cropped approach with a visible route status', () => {
    expect(app).toContain('Approach vector / stable');
    expect(fallback).toContain('Approach vector / stable');
    expect(css).toContain('.chapter-approach');
  });

  it('renders three sequential path-linked systems instead of cards', () => {
    expect(app.match(/className="system-route"/g)).toHaveLength(1);
    expect(app).not.toContain('system-card');
    expect(app).toContain('sceneSignal={`system:${system.signal}`}');
    for (const signal of ['capital', 'software', 'intelligence']) {
      expect(app).toContain(`signal: "${signal}"`);
      expect(fallback).toContain(`data-scene-signal="system:${signal}"`);
    }
    expect(layers).toContain('pulseActive');
    expect(layers).toContain('pulseSignal');
  });
});
