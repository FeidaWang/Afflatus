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
    expect(source).toContain("shieldShell.visible = combatEffectsReady && shieldPulse > 0.008");
    expect(source).not.toContain('new THREE.MeshBasicMaterial({ color: 0x70ddff');
    expect(source).toContain('pilotLaunch');
    expect(source).toContain('missileTail');
    expect(source).toContain('impactOrbit');
    expect(source).toContain('CIC_CAPITAL_ASSET_PROFILE');
    expect(source).toContain('CIC_FIGHTER_ASSET_PROFILE');
    expect(source).toContain('authoredAssetLoader.load(CIC_CAPITAL_ASSET_PROFILE)');
    expect(source).toContain('authoredAssetLoader.load(CIC_FIGHTER_ASSET_PROFILE)');
    expect(source).toContain("root.name = 'VenatorClassStarDestroyerCCBY'");
    expect(source).toContain("fighterModelStatus = 'sixth-gen-ready'");
    expect(source).toContain('!shouldLoadAuthoredAssets(state)');
    expect(source).toContain('if (!needsShip && !needsFighters) return;');
    expect(source).toContain('combatVfx.linkedBeam');
    expect(source).toContain('combatVfx.fireSmoke');
    expect(source).toContain('combatVfx.shieldArc');
    expect(source).toContain('combatVfx.bloom');
    expect(source).toContain('projectileWorldPosition(projectile, state, projectileUpdateScratch.position)');
    expect(source).toContain('function screenToCombatWorld(');
    expect(source).toContain('COMBAT_WORLD_DEPTH = 32');
    expect(source).not.toMatch(/viewportHeight\) \* 45/);
    expect(source).toContain('stellarPosition.needsUpdate = true');
    expect(source).toContain("mesh.name = 'AlphardDistantBlackHole'");
    expect(source).toContain('function createDistantBlackHole()');
    expect(source).toContain('float photon = band(radius');
    expect(source).toContain('renderer.outputColorSpace = THREE.SRGBColorSpace');
    expect(source).toContain('renderer.toneMapping = THREE.ACESFilmicToneMapping');
    expect(source).not.toContain('function distantBlackHoleTexture()');
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

  it('keeps the topdown visual upgrade inside the 60 fps presentation budget', async () => {
    const source = await readFile(new URL('../src/scene/topdownCombat.js', import.meta.url), 'utf8');

    expect(source).toContain('const resizeCache = { width: 0, height: 0, dpr: 0 }');
    expect(source).toContain('maxDpr: 1.35');
    expect(source).not.toContain('renderOnceLastT');
    expect(source).not.toMatch(/qualityTier === 'low'[\s\S]{0,90}<\s*32/);
    expect(source).toContain('now - previousLodUpdateAt < 250');
    expect(source).toContain('if (nextTier === fighterLodTiers[index]) return;');
    expect(source).toContain("proxy.name = 'B2NuclearPlatformProxy'");
    expect(source).toContain('projectileLaunchSource(nuclear, sourceCraftId)');
    expect(source).toContain('activeMissileCameraTrackId');
    expect(source).toContain('const pooledPlume = combatVfx.plume?.bind(combatVfx)');
    expect(source).toContain('const projectileUpdateScratch = {');
    expect(source).toContain('function matchProjectileForMissile(');
    expect(source).toContain('claimedProjectileIds.length = 0;');
    expect(source).toContain('emitterId: `capital-drive-${index}`');
    expect(source).toContain('emitterId: `fighter-${fighterIndex}-drive-${nozzleIndex}`');
    expect(source).toContain('emitterId: `b2-drive-${nozzleIndex}`');
    expect(source).not.toContain('ms.trail');
    expect(source).not.toContain('scene.add(trail)');
    expect(source).toContain('phaseCameraCue(phase)');
    expect(source).toContain('getPresentationState()');
    expect(source).toContain('material.side = THREE.FrontSide');
    expect(source).toContain('renderer.compile(mesh, camera, scene)');
    expect(source).not.toContain('renderer.compileAsync(');
    expect(source).toContain('renderer.initTexture(textures[index])');
    expect(source).toContain('new THREE.WebGLRenderTarget(1, 1');
    expect(source).toContain('renderer.render(stagingScene, camera)');
    expect(source).toContain("document.visibilityState !== 'hidden'");
    expect(source).toContain('authoredWarmGeneration += 1');
    expect(source).toContain('invalidateAuthoredAssetsForContextLoss()');
    expect(source).toContain("return 'cancelled'");
    expect(source).toContain('proceduralFramePresented = true');
    expect(source).toContain("markPerformanceStage('proceduralFrame')");
    expect(source).toContain("markPerformanceStage('shipSwap')");
    expect(source).toContain("markPerformanceStage('fighterSwap')");
    expect(source).toContain("minimumCometPixels = renderPolicy.qualityTier === 'high' ? 28");
    expect(source).toContain('lifeMs: 560');
    expect(source).toContain('tr.life -= 0.025 * frameScale');
    expect(source).not.toContain('new THREE.PointLight');
    expect(source).not.toContain('new THREE.Euler(age');
  });

  it('publishes the authoritative Enforcer charge window for renderer VFX', async () => {
    const source = await readFile(new URL('../src/homeExperience.js', import.meta.url), 'utf8');
    expect(source).toContain("emitCombatEvent('weapon:charge',{weapon:'enforcer'");
    expect(source).toContain('durationMs:4500');
    expect(source).toContain("emitCombatEvent('weapon:charge',{weapon:'nuke'");
    expect(source).toContain('durationMs:3000');
    expect(source).toContain("'weapon:charge':zh?");
  });

  it('holds an authored-ship broadside through charge before the delayed Enforcer impact cut', async () => {
    const [scene, experience] = await Promise.all([
      readFile(new URL('../src/scene/topdownCombat.js', import.meta.url), 'utf8'),
      readFile(new URL('../src/homeExperience.js', import.meta.url), 'utf8'),
    ]);

    expect(scene).toContain('mainGunBroadside: {');
    expect(scene).toMatch(/event\.type === 'weapon:charge'[\s\S]*?requestShot\('mainGunBroadside'/);
    expect(scene).toMatch(/mainGunBroadside:\s*{\s*priority:\s*3/);
    for (const flightShot of ['deckCam', 'chaseLaunch', 'pilotLaunch', 'towerCam', 'flybyCam']) {
      expect(scene).toMatch(new RegExp(`${flightShot}:\\s*{[\\s\\S]*?priority:\\s*1\\.5`));
    }
    expect(scene).toContain('mainGunFireHoldUntil = nowMs + MAIN_GUN_FIRE_HOLD_MS');
    expect(scene).toContain("} else if (event.type === 'weapon:fire') {");
    expect(scene).not.toContain("event.type === 'weapon:fire' && alive");
    expect(scene).toContain("event.weapon === 'enforcer' && now < mainGunFireHoldUntil");
    expect(scene).toContain('pendingMainGunImpactShot');
    expect(scene).toContain('expiresAt: mainGunFireHoldUntil + impactShot.durationMs + 500');
    expect(scene).toContain("else if (camDirector.requestShot('impactOrbit', { ...shot, now }))");

    const fireHold = Number(scene.match(/const MAIN_GUN_FIRE_HOLD_MS = (\d+);/)?.[1]);
    expect(fireHold).toBeGreaterThanOrEqual(800);

    const impactDelay = Number(experience.match(/const ENFORCER_IMPACT_DELAY_MS=(\d+);/)?.[1]);
    expect(impactDelay).toBeGreaterThanOrEqual(400);
    expect(impactDelay).toBeLessThanOrEqual(800);
    expect(experience).toContain('impactAt:firedAt+ENFORCER_IMPACT_DELAY_MS');
    expect(experience).toContain('const impactReady=weaponNow>=w.impactAt;');
    expect(experience).toContain('if(impactReady && halley && !halley.destroyed)');
    expect(experience.indexOf("if(shotCopy[shot] && !['commandChase','pilotLaunch','chaseLaunch'].includes(shot))"))
      .toBeLessThan(experience.indexOf('if(phaseCopy[phase]) return phaseCopy[phase];'));

    // WebGL/device-loss fallback remains the existing bounded procedural flyby.
    expect(experience).toContain('if(s3) s3.draw(ctx,w,h,now,chargeT,currentLang);');
    expect(experience).toContain('else capitalFlyby.draw(ctx,w,h,now,chargeT,currentLang);');
  });

  it('tears down Command renderers and keeps default topdown loading on the 2D flyby', async () => {
    const source = await readFile(new URL('../src/homeExperience.js', import.meta.url), 'utf8');

    expect(source).toContain('const s3=combatViewTopdown()?null:getShip3D();');
    expect(source).not.toContain('const s3=getShip3D();');
    expect(source).toContain('function destroyCombatRenderers()');
    expect(source).toContain('topdownGeneration+=1;');
    expect(source).toContain('ship3DGeneration+=1;');
    expect(source).toContain('fighter3DGeneration+=1;');
    expect(source).toContain('if(generation!==topdownGeneration||cruiseModeActive())');
    expect(source).toContain('if(generation!==ship3DGeneration||combatViewTopdown()||cruiseModeActive())');
    expect(source).toContain('if(generation!==fighter3DGeneration||combatViewTopdown()||cruiseModeActive())');
    expect(source).toContain('destroyRendererInstance(candidate);');
    expect(source).toMatch(/if\(toHudOff\)\{[\s\S]*?destroyCombatRenderers\(\);/);
  });

  it('uses observer-cached hero visibility to tier the master loop without layout reads', async () => {
    const source = await readFile(new URL('../src/homeExperience.js', import.meta.url), 'utf8');
    expect(source).toContain('let heroSectionVisible=true,stardriveSectionVisible=false;');
    expect(source).toContain('const masterLoopSectionObserver=new IntersectionObserver');
    expect(source).toContain('function masterLoopTargetFps()');
    expect(source).toContain('if(!cruiseModeActive()||warpTarget>=.45||warpIntensity>=.45) return 60;');
    expect(source).toContain('return heroSectionVisible||stardriveSectionVisible?30:15;');
    expect(source).toContain('const targetFps=masterLoopTargetFps();');
    const targetFpsBody = source.slice(
      source.indexOf('function masterLoopTargetFps()'),
      source.indexOf('function frame(now)'),
    );
    expect(targetFpsBody).not.toContain('getBoundingClientRect');
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
    expect(source).toContain("setPilotDataset(pilotCanvas,'flightPhase',picture.flightPhase||'none')");
    expect(source).toContain("setPilotDataset(pilotCanvas,'fighterModel',picture.fighterModelStatus)");
    expect(source).toContain("setPilotDataset(pilotCanvas,'renderQuality',picture.qualityTier)");
    expect(source).toContain("evtCanvas.dataset.fighterModel=assetStatus?.loadStatus==='ready'");
    expect(source).toContain("hudRenderPolicy.qualityTier!=='low'");
    expect(source).not.toContain("hudRenderPolicy.qualityTier!=='low'||innerWidth>=1024");
    expect(source).toContain("hudRenderPolicy.qualityTier==='high'?3:1");
    expect(source).toContain("try{ return !/[?&]combatview=2d\\b/.test(location.search); }");
    expect(source).not.toContain("localStorage.getItem('afflatus-combatview')");
    expect(source).toContain('const activeFlightMode=pendingPresentation?.flightKind||null');
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
