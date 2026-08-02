import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const vendorDir = 'public/vendor/black-hole';

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

describe('homepage relativistic black hole contract', () => {
  it('replaces the synthetic gold ring with the source observatory background', () => {
    const html = readFileSync('index.html', 'utf8');
    const main = readFileSync('src/main.js', 'utf8');

    expect(html).toContain('id="blackhole-stage"');
    expect(html).toContain('src="/vendor/black-hole/background.html"');
    expect(html).not.toContain('<canvas id="blackhole-gl"');
    expect(main).not.toContain('createSaturnRenderer');
    expect(main).not.toContain('goldenRim');
    expect(main).not.toContain('home:saturn-blackhole');
  });

  it('ships only the renderer lookup data, reduced Gaia sky and poster fallback', () => {
    const files = filesUnder(vendorDir);
    const names = files.map((file) => file.replace(`${vendorDir}/`, ''));
    const totalBytes = files.reduce((total, file) => total + statSync(file).size, 0);

    expect(names).toContain('background.html');
    expect(names).toContain('source-poster.jpg');
    expect(names.filter((name) => name.startsWith('gaia/'))).toHaveLength(12);
    expect(names.some((name) => name.includes('rocket'))).toBe(false);
    expect(totalBytes).toBeLessThan(8.5 * 1024 * 1024);
  });

  it('keeps observatory controls and diagnostics out of the visible embed', () => {
    const source = readFileSync(`${vendorDir}/background.html`, 'utf8');
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(source).toMatch(/\.cv-loading-panel,\s*\.cv-error-panel\s*\{\s*display: none !important;/);
    expect(source).not.toContain('this.rocketManager = new RocketManager');
    expect(styles).toContain('body.blackhole-ready #blackhole-gl');
    expect(styles).toContain("url('/vendor/black-hole/source-poster.jpg')");
  });

  it('dissolves the black-hole plate into the same fixed universe as the eclipse', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toContain('shared 72% / 38% navigation');
    expect(styles).toContain('radial-gradient(ellipse 44% 48% at 53% 48%');
    expect(styles).not.toContain('mask-image: linear-gradient(90deg,transparent 0%,rgba(0,0,0,.72)');
  });

  it('labels the gravity well and drives every star through one approach field', () => {
    const html = readFileSync('index.html', 'utf8');
    const fallback = readFileSync('src/scene/backgroundScene.js', 'utf8');
    const worker = readFileSync('src/scene/backgroundScene.worker.js', 'utf8');

    expect(html).toContain('class="blackhole-course-marker"');
    expect(html).toContain('APPROACH VECTOR / ΔR NEGATIVE');
    expect(fallback).toContain('function drawApproach');
    expect(worker).toContain('function drawApproach');
    expect(fallback).toContain("ctx.fillStyle = '#04060a'");
    expect(worker).toContain("ctx.fillStyle = '#04060a'");
    expect(fallback).not.toContain('eventR * 1.35');
    expect(worker).not.toContain('eventR * 1.35');
  });

  it('uses the doubled-size homepage observation plate', () => {
    const source = readFileSync(`${vendorDir}/background.html`, 'utf8');
    expect(source).toContain('target: 1, radius: 18');
  });

  it('retains the renderer and star-catalogue license notice', () => {
    expect(existsSync('THIRD_PARTY_NOTICES.md')).toBe(true);
    const notice = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
    expect(notice).toContain('Eric Bruneton Black Hole Shader');
    expect(notice).toContain('BSD 3-Clause License');
    expect(notice).toContain('Gaia DR2');
    expect(notice).toContain('Tycho-2');
  });
});
