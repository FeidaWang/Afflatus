import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/styles.css', 'utf8');
const performanceStyles = readFileSync('src/performance-dossier.css', 'utf8');
const forge = readFileSync('src/scene/alphardForge.js', 'utf8');
const main = readFileSync('src/homeExperience.js', 'utf8');
const entry = readFileSync('src/main.js', 'utf8');

describe('home stardrive layout contracts', () => {
  it('keeps the jump-point stage contained in a preallocated sticky shell', () => {
    expect(styles).not.toMatch(/@keyframes\s+stardrivePin/);
    expect(styles).not.toMatch(/translateY\(100svh\)/);
    expect(performanceStyles).toContain('.home-page .stardrive-runway { height: 180svh; }');
    expect(performanceStyles).toMatch(/\.stardrive \.stardrive-stage\s*\{position: sticky|\.stardrive \.stardrive-stage\s*\{ position: sticky/);
    expect(entry).not.toContain("classList.add('has-motion-shell')");
    expect(forge).not.toContain("stageEl.classList.toggle('pin-fixed'");
    expect(forge).not.toContain("document.addEventListener('DOMContentLoaded', initAlphardForge");
  });

  it('keeps complete metrics outside the clipped stage in natural flow', () => {
    const html = readFileSync('portfolio.html', 'utf8');
    expect(html).toMatch(/<\/div>\s*<\/div>\s*<div class="strip" id="strip">/);
    expect(performanceStyles).toMatch(/\.home-page \.stardrive > \.strip\s*\{[^}]*position: relative[^}]*height: auto[^}]*opacity: 1/s);
    expect(performanceStyles).toMatch(/\.home-page \.stardrive \.strip-cell\s*\{[^}]*height: auto; overflow: visible; opacity: 1/s);
    expect(styles).toMatch(/\.stardrive \.strip-value\{[^}]*font-variant-numeric:tabular-nums/);
  });

  it('keeps progress in the existing single sampler and static layout on touch', () => {
    expect((forge.match(/getBoundingClientRect\(/g) || []).length).toBe(1);
    expect(forge).not.toMatch(/addEventListener\(['"](?:scroll|wheel)['"]/);
    expect(forge).not.toContain('preventDefault');
    expect(performanceStyles).toContain('@media (max-width: 860px), (pointer: coarse), (prefers-reduced-motion: reduce)');
    expect(performanceStyles).toContain('.home-page .stardrive-runway { height: auto; }');
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
    expect(forge).toContain('0.25 + 0.75 * smoothstep(0, 0.3, p)');
    expect(forge).not.toContain('renderTagline');
  });

  it('keeps the eclipse crisp and removes the vine-like corona noise', () => {
    expect(forge).toContain('renderPolicy.computeDpr(width, height');
    expect(forge).toContain("maxDpr: renderPolicy.qualityTier === 'low' ? 1 : 1.5");
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
    expect(forge).toContain("document.body.classList.toggle('forge-active', active)");
    expect(forge).not.toContain('blackHoleStage');
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
