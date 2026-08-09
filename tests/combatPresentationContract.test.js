import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('combat presentation contract', () => {
  it('ships a bounded glTF 2.0 command model', async () => {
    const data = await readFile(new URL('../public/assets/combat/afflatus-command.glb', import.meta.url));
    expect(data.toString('ascii', 0, 4)).toBe('glTF');
    expect(data.readUInt32LE(4)).toBe(2);
    expect(data.readUInt32LE(8)).toBe(data.length);
    expect(data.length).toBeGreaterThan(180_000);
    expect(data.length).toBeLessThan(420_000);
  });

  it('keeps Three.js weapon and camera cues event-driven', async () => {
    const source = await readFile(new URL('../src/scene/topdownCombat.js', import.meta.url), 'utf8');
    expect(source).toContain("event.type === 'weapon:fire'");
    expect(source).toContain("event.type === 'weapon:charge'");
    expect(source).toContain("event.type === 'flight:launch'");
    expect(source).toContain("event.type === 'fleet:damage'");
    expect(source).toContain('const shieldMaterial = new THREE.ShaderMaterial');
    expect(source).toContain('float hexEnergyGrid');
    expect(source).toContain('uniform vec3 uHitDirection');
    expect(source).toContain("shieldShell.name = 'ImpactEnergyShield'");
    expect(source).toContain('shieldShell.visible = shieldPulse > 0.008');
    expect(source).not.toContain('new THREE.MeshBasicMaterial({ color: 0x70ddff');
    expect(source).toContain('pilotLaunch');
    expect(source).toContain('missileTail');
    expect(source).toContain('impactOrbit');
    expect(source).toContain('CAPITAL_ASSET_PROFILE');
    expect(source).toContain('FIGHTER_ASSET_PROFILE');
    expect(source).toContain('loadCombatAsset(renderer, CAPITAL_ASSET_PROFILE)');
    expect(source).toContain('loadCombatAsset(renderer, FIGHTER_ASSET_PROFILE)');
    expect(source).toContain("authoredShip.name = 'VenatorClassStarDestroyerCCBY'");
    expect(source).toContain("fighterModelStatus = 'sixth-gen-ready'");
    expect(source).toContain('if (combatAssetLoadPromise || (shipModelPromise && fighterModelPromise)) return;');
    expect(source).not.toContain('const active = Boolean(state.target');
    expect(source).toContain('combatVfx.linkedBeam');
    expect(source).toContain('combatVfx.fireSmoke');
    expect(source).toContain('combatVfx.shieldArc');
    expect(source).toContain('combatVfx.bloom');
    expect(source).toContain('projectileWorldPosition(projectile, state)');
    expect(source).toContain('stellarPosition.needsUpdate = true');
    expect(source).toContain("approachBlackHole.name = 'AlphardDistantBlackHole'");
    expect(source).toContain("flightStreaks.name = 'ForwardVelocityReferences'");
    expect(source).toContain('const starLayers = []');
    expect(source).toContain('map: GLOW');
    expect(source).toContain('alphaTest: 0.025');
    expect(source).toContain('beginCameraOrbit');
    expect(source).toContain('orbitCameraBy');
    expect(source).toContain("event.type === 'target:acquired'");
    expect(source).not.toContain('const tailGeometry');
    expect(source).not.toContain('pos[i * 3 + 1] = -40');
    expect(source).not.toContain('if (starfield)');
    expect(source).toContain('layer.userData.baseOpacity * .52');
    expect(source).toContain('targetScreen: targetScreen ? Object.freeze');
    expect(source).not.toContain('NEB_DOME_FRAG');
    expect(source).not.toContain('new THREE.GridHelper');
    expect(source).not.toContain('startFlight(\'launch\', nowMs)');
    expect(source).not.toContain('Math.sin(t * 0.25) * 6');
    expect(source).not.toContain('sprite(0x62d9ff');
    expect(source).not.toContain('const ph = f.userData.ph');
    expect(source).toContain('const flightControlled = i === 0 && Boolean(flightEvent)');
    expect(source).toContain('if (accepted) flightEvent.fired.add(key)');
    expect(source).not.toMatch(/\blast(?:Fire|Missile|Laser|Orb|Chase)\b/);
    expect(source).not.toContain('now - last');
  });

  it('publishes the authoritative Enforcer charge window for renderer VFX', async () => {
    const source = await readFile(new URL('../src/homeExperience.js', import.meta.url), 'utf8');
    expect(source).toContain("emitCombatEvent('weapon:charge',{weapon:'enforcer'");
    expect(source).toContain('durationMs:4500');
    expect(source).toContain("'weapon:charge':zh?");
  });

  it('keeps the new CIC stylesheet free of priority escalation', async () => {
    const css = await readFile(new URL('../src/cic-hud.css', import.meta.url), 'utf8');
    expect(css).not.toContain('!important');
  });

  it('uses the sixth-generation fighter planform in the pilot HUD', async () => {
    const source = await readFile(new URL('../src/scene/combatHudSC.js', import.meta.url), 'utf8');
    expect(source).toContain('const deltaHalfSpan = hw * 0.41');
    expect(source).toContain('Twin buried engine bays and exhaust apertures');
    expect(source).toContain('Low-profile canopy nested in the broad blended fuselage');
    expect(source).not.toContain('F-14 TOMCAT');
    expect(source).not.toContain('twin tails');
  });

  it('provides cruise telemetry and focusable command stations at every viewport', async () => {
    const [html, css, source, hmd] = await Promise.all([
      readFile(new URL('../index.html', import.meta.url), 'utf8'),
      readFile(new URL('../src/cic-hud.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/homeExperience.js', import.meta.url), 'utf8'),
      readFile(new URL('../src/ui/combatHmdV3.js', import.meta.url), 'utf8')
    ]);
    expect(html).toContain('id="cicCruiseStrip"');
    expect(html).toContain('class="cic-station-tabs"');
    expect(html.match(/data-cic-panel-focus=/g)).toHaveLength(6);
    expect(css).toContain('body.hud-panel-focus #combatHud .cic-panel.is-focused');
    expect(css).toContain('@media (max-width: 860px)');
    expect(css).toContain('[data-weapon="missile"] { --weapon-color: var(--cic-amber)');
    expect(css).toContain('[data-weapon="enforcer"] { --weapon-color: var(--cic-magenta)');
    expect(css).toContain('backdrop-filter: blur(9px) saturate(1.08)');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) minmax(64px, max-content)');
    expect(css).toContain('#combatHud .cic-intel .cic-panel-focus { display: none; }');
    expect(css).toContain('#combatHud .cic-intel-footer');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(css).toContain('width: 112px');
    expect(source).toContain('function setHudPanelFocus(panelId=null)');
    expect(html).toContain('id="cicVoyageConsole"');
    expect(html).toContain('class="cic-tactical-body"');
    expect(html).toContain('class="cic-sensor-rail"');
    expect(html).toContain('class="cic-target-rail"');
    expect(html).not.toContain('class="pilot-terminal-overlay"');
    expect(source).toContain('initVoyageLogConsole');
    expect(source).not.toContain('initTerminalStarMap');
    expect(source).not.toContain('drawCockpitFrame(ctx');
    expect(source).toContain('pilotCanvas.dataset.flightPhase');
    expect(source).toContain('pilotCanvas.dataset.fighterModel=diagnostics.fighterModelStatus');
    expect(source).toContain('pilotCanvas.dataset.renderQuality=diagnostics.qualityTier');
    expect(source).toContain("evtCanvas.dataset.fighterModel=assetStatus?.loadStatus==='ready'");
    expect(source).toContain("hudRenderPolicy.qualityTier!=='low'||innerWidth>=1024");
    expect(source).toContain("hudRenderPolicy.qualityTier==='high'?3:1");
    expect(source).toContain("try{ return !/[?&]combatview=2d\\b/.test(location.search); }");
    expect(source).not.toContain("localStorage.getItem('afflatus-combatview')");
    expect(source).toContain('const activeFlightMode=pendingDiagnostics?.flightKind||null');
    expect(source).toContain('if(td&&td.available?.()&&sceneOwnsFeed)');
    expect(source).toContain('if(td3d?.available?.())');
    expect(source).toContain("||mode==='mainGun'||mode==='mosaic'||Boolean(activeFlightMode)");
    expect(source).toContain("||mode==='ciws'||mode==='offline'");
    expect(source).toContain("||mode==='nukeAuth'||mode==='nemp'");
    expect(source).toContain("||mode==='mosaic'||Boolean(activeFlightMode)");
    expect(source).toContain("canvas.addEventListener('pointerdown'");
    expect(source).toContain('topdownCV?.orbitCameraBy?.');
    expect(html).toContain('id="cicCameraReset"');
    expect(source).toContain('requestAnimationFrame(ensureSpaceSceneRunning)');
    expect(source).toContain('event.stopPropagation()');
    expect(source).not.toContain("const j=mode==='combat'?0.6:0");
    expect(hmd).not.toContain('drawLeftColumn(ctx,w,h,now,mode,state);');
    expect(hmd).not.toContain('drawRightColumn(ctx,w,h,now,state);');
    expect(hmd).not.toContain('drawSCReticle(ctx,w*.5,h*.46);');
  });
});
