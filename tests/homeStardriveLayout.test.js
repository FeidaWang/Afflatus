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

  it("resolves Baily's beads into a scroll-driven diamond ring", () => {
    expect(forge).toContain('const ECLIPSE_FRAG');
    expect(forge).toContain('float bailyPhase=');
    expect(forge).toContain('float bailyBeads=');
    expect(forge).toContain('float diamondPhase=');
    expect(forge).toContain('float diamondCore=');
    expect(forge).toContain('float coronaRing=');
    expect(forge).toContain('eclipseUniforms.uForge.value = p');
  });

  it('renders the eclipse in one aligned surface without legacy particle systems', () => {
    expect(forge).not.toContain('buildStation(');
    expect(forge).not.toContain('stationGroup');
    expect(forge).not.toContain('const ships =');
    expect(forge).not.toContain('const PT_VERT');
    expect(forge).not.toContain('const JET_VERT');
    expect(forge).not.toContain('jetParticles');
    expect(forge).not.toContain('const PN =');
    expect(forge).toContain('fragmentShader: ECLIPSE_FRAG');
    expect(forge).toContain('costs one scene draw call');
  });
});
