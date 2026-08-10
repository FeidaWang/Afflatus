import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('homepage authored combat craft integration', () => {
  it('enables an independent Venator layer without styling the black-hole renderer', () => {
    const main = readFileSync('src/main.js', 'utf8');
    const experience = readFileSync('src/homeExperience.js', 'utf8');
    const css = readFileSync('src/home-combat-showcase.css', 'utf8');

    expect(main).toContain("const HOME_COMBAT_MODELS_ENABLED = HERO_CRAFT_MODE !== 'off'");
    expect(main).toContain("HERO_CRAFT_MODE === '3d' ? 'forced-3d' : 'authored'");
    expect(main).toContain("classList.toggle('home-combat-models-enabled'");
    expect(main).toContain('installHomeCombatPoster()');
    expect(main).toContain("poster.fetchPriority = 'low'");
    expect(experience).toContain("classList.contains('home-combat-models-enabled')");
    expect(css).toContain('body.home-combat-models-enabled .home-flagship-narrative');
    expect(css).toContain('body.home-combat-models-enabled .home-flagship-poster');
    expect(css).toContain('.home-flagship-playback-active .home-flagship-poster');
    expect(css).toContain('.home-flagship-poster-restored .home-flagship-poster');
    expect(css).toContain('.home-flagship-force-3d.home-flagship-playback-active');
    expect(css).toContain('body.flagship-upgrade-enabled.hud-off .home-flagship-poster');
    expect(css.match(/visibility: hidden;/g)?.length).toBeGreaterThanOrEqual(2);
    expect(css).not.toContain('#blackhole-gl');
  });

  it('uses the real fighter only after it is ready and renders the shared frame once', () => {
    const experience = readFileSync('src/homeExperience.js', 'utf8');
    const fighter = readFileSync('src/scene/fighter3D.js', 'utf8');

    expect(experience).toContain("assetStatus?.loadStatus==='ready'");
    expect(experience).toContain("hudRenderPolicy.qualityTier!=='low'");
    expect(experience).toContain('&&!combatViewTopdown()');
    expect(experience).not.toContain("hudRenderPolicy.qualityTier!=='low'||innerWidth>=1024");
    expect(experience).toContain('!saveData');
    expect(experience).toContain('{az:azv, el:elv, size, frameToken:now}');
    expect(experience).toContain('drewAuthored||spriteCraft.drawOriented');
    expect(fighter).toContain('frameToken = performance.now()');
    expect(fighter).toContain('if (frameToken !== lastFrameToken)');
    expect(fighter).toContain('renderSurface.reportFrame');
  });

  it('loads CIC assets only for a visible Command feed and real fighter demand', () => {
    const combat = readFileSync('src/scene/topdownCombat.js', 'utf8');
    const experience = readFileSync('src/homeExperience.js', 'utf8');
    expect(experience).toContain('function commandFeedVisible(canvas)');
    expect(experience).toContain('shouldLoadAuthoredAssets:()=>commandFeedVisible(pilotCanvas)');
    expect(combat).toContain('!shouldLoadAuthoredAssets(state)');
    expect(combat).toContain("state?.escorts?.some((escort) => escort.type === 'f47')");
    expect(combat).toContain('latestFighterDemand && shouldLoadAuthoredAssets(liveCombatState)');
    expect(combat).toContain('if (!needsShip && !needsFighters) return;');
    expect(combat).toContain('f.visible = Boolean(escort) || flightControlled');
    expect(combat).toContain('function authoredAssetsAllowed()');
    expect(combat).toContain("renderPolicy.qualityTier !== 'low'");
    expect(combat).not.toContain('Number(globalThis.innerWidth || 0) >= 1024');
    expect(combat).toContain('if (dataSaverEnabled()) return false;');
  });
});
