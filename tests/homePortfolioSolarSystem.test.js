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
    expect(solar).toContain('const sunGroup = new THREE.Group()');
    expect(solar).toContain('for (let index = 1; index < BODY_PROFILES.length; index += 1)');
    expect(solar).toContain('new THREE.SphereGeometry');
    expect(solar).toContain('new THREE.LineLoop');
    expect(marketDeck).toContain("i === 0 ? 'is-sun' : 'is-planet'");
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
