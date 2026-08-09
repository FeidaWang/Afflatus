(() => {
  'use strict';

  const QUALITY_ORDER = Object.freeze(['low', 'balanced', 'high']);
  const MAX_PARTICLES = 24_000;
  const MIN_RENDER_SCALE = 0.35;

  const QUALITY_PROFILES = Object.freeze({
    high: Object.freeze({
      tier: 'high',
      renderScale: 0.5,
      maxRenderScale: 1,
      particleCount: MAX_PARTICLES,
      targetFps: 60,
    }),
    balanced: Object.freeze({
      tier: 'balanced',
      renderScale: 0.5,
      maxRenderScale: 0.75,
      particleCount: 10_000,
      targetFps: 45,
    }),
    low: Object.freeze({
      tier: 'low',
      renderScale: 0.375,
      maxRenderScale: 0.5,
      particleCount: 2_000,
      targetFps: 30,
    }),
  });

  function normalizeTier(value, fallback = 'balanced') {
    const tier = String(value || '').toLowerCase();
    return QUALITY_ORDER.includes(tier) ? tier : fallback;
  }

  function clampRenderScale(value, maxRenderScale = 1, fallback = 0.5) {
    const absent = value === null || value === undefined || value === '';
    const numeric = absent ? Number.NaN : Number(value);
    const resolved = Number.isFinite(numeric) ? numeric : fallback;
    return Math.min(maxRenderScale, Math.max(MIN_RENDER_SCALE, resolved));
  }

  function detectTier({
    explicitTier,
    saveData = false,
    reducedMotion = false,
    deviceMemory,
    hardwareConcurrency,
    viewportWidth = 1024,
  } = {}) {
    if (QUALITY_ORDER.includes(String(explicitTier || '').toLowerCase())) {
      return normalizeTier(explicitTier);
    }
    if (saveData || reducedMotion) return 'low';
    if (
      (Number.isFinite(deviceMemory) && deviceMemory <= 4)
      || (Number.isFinite(hardwareConcurrency) && hardwareConcurrency <= 4)
      || viewportWidth < 640
    ) return 'low';
    if (
      Number.isFinite(deviceMemory) && deviceMemory >= 8
      && Number.isFinite(hardwareConcurrency) && hardwareConcurrency >= 8
      && viewportWidth >= 1024
    ) return 'high';
    return 'balanced';
  }

  function selectQuality(options = {}) {
    const tier = detectTier(options);
    const profile = QUALITY_PROFILES[tier];
    const motionSuppressed = Boolean(options.saveData || options.reducedMotion);
    const renderScale = clampRenderScale(
      options.renderScale,
      profile.maxRenderScale,
      profile.renderScale,
    );
    const hasParticleOverride = options.particleCount !== null
      && options.particleCount !== undefined
      && options.particleCount !== '';
    const requestedParticles = hasParticleOverride
      && Number.isFinite(Number(options.particleCount))
      ? Math.max(0, Math.trunc(Number(options.particleCount)))
      : profile.particleCount;
    const particleCount = motionSuppressed
      ? 0
      : Math.min(MAX_PARTICLES, profile.particleCount, requestedParticles);

    return Object.freeze({
      tier,
      renderScale,
      particleCount,
      particleCap: MAX_PARTICLES,
      targetFps: profile.targetFps,
      motionSuppressed,
    });
  }

  function browserOptions(win = globalThis) {
    const params = new URLSearchParams(win.location?.search || '');
    const media = (query) => {
      try { return Boolean(win.matchMedia?.(query).matches); } catch { return false; }
    };
    return {
      explicitTier: params.get('bhQuality') || params.get('quality'),
      renderScale: params.get('bhRenderScale') || params.get('renderScale'),
      particleCount: params.get('bhParticles'),
      saveData: Boolean(win.navigator?.connection?.saveData),
      reducedMotion: media('(prefers-reduced-motion: reduce)'),
      deviceMemory: Number(win.navigator?.deviceMemory),
      hardwareConcurrency: Number(win.navigator?.hardwareConcurrency),
      viewportWidth: Number(win.innerWidth) || 1024,
    };
  }

  globalThis.BlackHoleQualityPolicy = Object.freeze({
    QUALITY_ORDER,
    QUALITY_PROFILES,
    MAX_PARTICLES,
    MIN_RENDER_SCALE,
    normalizeTier,
    clampRenderScale,
    detectTier,
    selectQuality,
    browserOptions,
  });
})();
