import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/styles.css', 'utf8');
const performanceStyles = readFileSync('src/performance-dossier.css', 'utf8');
const forge = readFileSync('src/scene/alphardForge.js', 'utf8');
const main = readFileSync('src/homeExperience.js', 'utf8');

describe('home stardrive layout contracts', () => {
  it('does not translate the jump-point stage by a full viewport', () => {
    expect(styles).not.toMatch(/@keyframes\s+stardrivePin/);
    expect(styles).not.toMatch(/translateY\(100svh\)/);
    expect(forge).toContain('const cssPin = false');
  });

  it('keeps the annualized-return value inside a fixed numeric slot', () => {
    expect(styles).toMatch(/\.stardrive \.strip-cell\{[^}]*overflow:hidden/);
    expect(styles).toMatch(/\.stardrive \.strip-value\{[^}]*font-variant-numeric:tabular-nums/);
    expect(performanceStyles).toMatch(/\.stardrive \.strip-cell\s*\{[^}]*grid-template-rows:\s*34px auto minmax\(0, 1fr\)/s);
    expect(styles).not.toMatch(/\.stardrive \.hero-metric \.strip-value\{[^}]*transform:scale/);
  });

  it('derives the approach-caption clearance from the metric-strip geometry', () => {
    expect(performanceStyles).toContain('--metric-strip-block-size: 146px');
    expect(performanceStyles).toContain('--metric-caption-gap: 32px');
    expect(performanceStyles).toMatch(/\.stardrive \.stardrive-caption\s*\{[^}]*bottom:\s*calc\(var\(--metric-strip-bottom\) \+ var\(--metric-strip-block-size\) \+ var\(--metric-caption-gap\)\)/s);
    expect(performanceStyles).toMatch(/\.stardrive \.strip\s*\{[^}]*height:\s*var\(--metric-strip-block-size\)/s);
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

  it('keeps the eclipse crisp and removes the vine-like corona noise', () => {
    expect(forge).toContain("renderPolicy.qualityTier === 'high'");
    expect(forge).toContain('Math.min(nativeDpr, 2)');
    expect(forge).toContain('float sidePlumes=');
    expect(forge).toContain('float equatorialFans=');
    expect(forge).toContain('for(int i=0;i<7;i++)');
    expect(forge).not.toContain('float rayNoise=');
    expect(forge).not.toContain('float longRays=');
    expect(forge).not.toContain('float straightSpokes=');
    expect(forge).not.toContain('EffectComposer');
    expect(forge).not.toContain('UnrealBloomPass');
  });

  it('uses a mathematically smooth lunar limb without noise-displaced geometry', () => {
    expect(forge).toContain('float lunarDistance=radius-moonRadius;');
    expect(forge).toContain('float limbAA=max(pixel*1.35,0.00042);');
    expect(forge).toContain('vec2 beadPoint=moonCenter+radial*moonRadius;');
    expect(forge).not.toContain('float relief=');
    expect(forge).not.toContain('beadRelief');
    expect(forge).not.toContain('limbGranulation');
    expect(forge).not.toContain('prominenceMask');
  });

  it('shares the fixed homepage universe instead of painting a second sky', () => {
    expect(forge).toContain('alpha: true, premultipliedAlpha: false');
    expect(forge).toContain('renderer.setClearColor(0x000000, 0)');
    expect(forge).toContain('gl_FragColor=vec4(col,celestialAlpha)');
    expect(forge).toContain('const opacity = 1 - smoothstep(0.08, 0.46, p)');
    expect(forge).not.toContain('float skyCloud=');
    expect(styles).toContain('filter:none;mask-image:none;-webkit-mask-image:none');
    expect(styles).toContain('.stardrive-veil,.stardrive-stage::before,.stardrive-stage::after{display:none}');
    expect(styles).toMatch(/\.stardrive-stage\{[^}]*isolation:isolate[^}]*background:transparent/);
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

  it('does not paint combat particles over the eclipse in cruise mode', () => {
    const cruiseBranch = main.match(/if\(!cruise\)\{([\s\S]*?)\n\s*\}else\{/u)?.[1] || '';
    expect(cruiseBranch).toContain('updateHalley(dt)');
    expect(cruiseBranch).toContain('drawHalley()');
    const beforeBranch = main.slice(main.indexOf('const cruise=cruiseModeActive()'), main.indexOf('if(!cruise){', main.indexOf('const cruise=cruiseModeActive()')));
    expect(beforeBranch).not.toContain('drawHalley()');
  });
});
