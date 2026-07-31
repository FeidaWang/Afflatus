import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/styles.css', 'utf8');
const forge = readFileSync('src/scene/alphardForge.js', 'utf8');

describe('home stardrive layout contracts', () => {
  it('does not translate the jump-point stage by a full viewport', () => {
    expect(styles).not.toMatch(/@keyframes\s+stardrivePin/);
    expect(styles).not.toMatch(/translateY\(100svh\)/);
    expect(forge).toContain('const cssPin = false');
  });

  it('keeps the annualized-return value inside a fixed numeric slot', () => {
    expect(styles).toMatch(/\.stardrive \.strip-cell\{[^}]*overflow:hidden/);
    expect(styles).toMatch(/\.stardrive \.strip-value\{[^}]*font-variant-numeric:tabular-nums/);
    expect(styles).not.toMatch(/\.stardrive \.hero-metric \.strip-value\{[^}]*transform:scale/);
  });

  it('normalizes the localized language link decoration', () => {
    expect(styles).toMatch(/\.nav-right #langBtn\{[\s\S]*?text-decoration:none/);
  });

  it('combines accretion, gravitational redshift and bipolar jets in one celestial system', () => {
    expect(forge).toContain('const CELESTIAL_FRAG');
    expect(forge).toContain('float accretion=');
    expect(forge).toContain('float escapeShift=');
    expect(forge).toContain('float jetCore=');
    expect(forge).toContain('const JET_VERT');
    expect(forge).toContain('const jetParticles = new THREE.Points');
  });

  it('removes unrelated station and spacecraft draws while staying within the particle budget', () => {
    expect(forge).not.toContain('buildStation(');
    expect(forge).not.toContain('stationGroup');
    expect(forge).not.toContain('const ships =');
    expect(forge).toContain('const PN = 4200');
    expect(forge).toContain('const JN = 1200');
  });
});
