import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const marketDeck = readFileSync('src/ui/marketDeck.js', 'utf8');
const solar = readFileSync('src/ui/portfolioSolarSystem.js', 'utf8');
const convoyCss = readFileSync('src/portfolio-convoy.css', 'utf8');
const legacyCss = readFileSync('src/styles.css', 'utf8');

describe('homepage AI portfolio solar system', () => {
  it('maps the highest-weight pick to a sun and the remaining nine to planets', () => {
    expect(html).toContain('id="convoySolarSystem"');
    expect(solar).toContain("import * as THREE from 'three'");
    expect(solar).toContain("const BODY_PROFILES = [");
    expect(solar).toContain('BODY_PROFILES.forEach((profile, index) => {');
    expect(solar).toContain("type: 'sun'");
    expect(solar).toContain("body: 'PLUTO'");
    expect(solar).toContain('new THREE.SphereGeometry');
    expect(solar).toContain('new THREE.LineLoop');
    expect(marketDeck).toContain("i === 0 ? 'is-sun' : 'is-planet'");
    expect(marketDeck).toContain('node.dataset.solarBody = solarBody');
    expect(marketDeck).toContain('lockOrbitSelection(el)');
    expect(marketDeck).toContain('performance.now() < orbitSelectionLock.until');
    expect(marketDeck).toContain('const visibleConvoyCards = new Set()');
    expect(marketDeck).toContain('visibleConvoyCards.add(entry.target)');
    expect(marketDeck).toContain("nodes.onclick = (event) => {");
    expect(marketDeck).toContain('rect.left + rect.width / 2 - event.clientX');
  });

  it('renders detailed surfaces, atmospheres, rings and a deep-space environment', () => {
    expect(solar).toContain('function makeBodyMaps');
    expect(solar).toContain('function makeCloudTexture');
    expect(solar).toContain('function makeRingTexture');
    expect(solar).toContain('function makeRingGeometry');
    expect(solar).toContain('const radialUv = clamp');
    expect(solar).toContain('function makeAtmosphere');
    expect(solar).toContain('function buildStarField');
    expect(solar).toContain('for (let i = 0; i < 1800; i += 1)');
    expect(solar).toContain('scene.background = new THREE.Color(0x01030a)');
    expect(solar).toContain("profile.type === 'jupiter'");
    expect(solar).toContain("profile.ring === 'saturn'");
  });

  it('uses current-epoch orbital mechanics and expands the selected body like an atlas', () => {
    expect(solar).toContain('const J2000_MS');
    expect(solar).toContain('const LIVE_SIM_DAYS_PER_SECOND');
    expect(solar).toContain('const currentEpochDays');
    expect(solar).toContain('function solveEccentricAnomaly');
    expect(solar).toContain('profile.periodDays');
    expect(solar).toContain('profile.rotationHours');
    expect(solar).toContain('body.profile.type === \'jupiter\' ? 2.05 : 2.75');
    expect(solar).toContain("host.dataset.activeBody = BODY_PROFILES[activeIndex]?.body || 'SUN'");
    expect(convoyCss).toMatch(/\.solar-ready \.solar-epoch\s*\{\s*opacity:\s*1;/);
    expect(convoyCss).toMatch(/\.orbit-field\.solar-ready \.convoy-node\.is-active:not\(\.is-sun\)\s*\{[^}]*width:\s*104px;/s);
  });

  it('shares the render budget and WebGL lifecycle instead of leaking a renderer', () => {
    expect(solar).toContain('getRenderBudgetCoordinator');
    expect(solar).toContain('createWebGLContextLifecycle');
    expect(solar).toContain('disposeThreeScene');
    expect(solar).toContain("id: SURFACE_ID");
    expect(solar).toContain("cost: 'high'");
    expect(solar).toContain('surface?.dispose()');
  });

  it('keeps the full dossier visible on hover and focus', () => {
    expect(legacyCss).not.toMatch(/\.pick-card:hover \.pcCover[^\{]*\{[^}]*opacity:\s*0/s);
    expect(legacyCss).not.toMatch(/\.pick-card\.open \.pcCover[^\{]*\{[^}]*opacity:\s*0/s);
    expect(convoyCss).toMatch(/\.portfolio-convoy \.pick-card:hover \.pcCover,[\s\S]*?opacity:\s*1;[\s\S]*?visibility:\s*visible;[\s\S]*?transform:\s*none;/);
    expect(convoyCss).toMatch(/\.portfolio-convoy \.pcDetail\s*\{[\s\S]*?position:\s*static;[\s\S]*?opacity:\s*1;/);
  });
});
