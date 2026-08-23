export const QUALITY_PROFILES = Object.freeze([
  'high',
  'medium',
  'mobile',
  'static',
  'reduced',
]);

export const ANIMATED_QUALITY_PROFILES = Object.freeze(['high', 'medium', 'mobile']);

export const RENDER_BUDGETS = Object.freeze({
  high: Object.freeze({ antialias: true, dpr: 1.5, degradedDpr: 1.15, fps: 60 }),
  medium: Object.freeze({ antialias: true, dpr: 1.25, degradedDpr: 1, fps: 45 }),
  mobile: Object.freeze({ antialias: false, dpr: 1.2, degradedDpr: 0.9, fps: 30 }),
});

export const RESOURCE_MATRIX = Object.freeze({
  high: Object.freeze({
    bloom: true,
    carrierLod: 'full',
    dust: true,
    surfaceTextures: 'ktx2-basis',
  }),
  medium: Object.freeze({
    bloom: false,
    carrierLod: 'reduced',
    dust: true,
    surfaceTextures: 'none',
  }),
  mobile: Object.freeze({
    bloom: false,
    carrierLod: 'reduced',
    dust: true,
    surfaceTextures: 'none',
  }),
  static: Object.freeze({
    bloom: false,
    carrierLod: 'poster',
    dust: false,
    surfaceTextures: 'none',
  }),
  reduced: Object.freeze({
    bloom: false,
    carrierLod: 'poster',
    dust: false,
    surfaceTextures: 'none',
  }),
});

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function resolveQualityProfile({
  deviceMemory,
  experienceMode = 'cinematic',
  hardwareConcurrency,
  motionEnabled = true,
  reducedMotion = false,
  saveData = false,
  viewportHeight,
  viewportWidth,
  webglAvailable = true,
} = {}) {
  if (experienceMode === 'static') return 'static';
  if (experienceMode === 'reduced' || !motionEnabled || reducedMotion || saveData) return 'reduced';
  if (!webglAvailable) return 'static';

  const width = finiteOr(viewportWidth, 1280);
  const height = finiteOr(viewportHeight, 800);
  const memory = finiteOr(deviceMemory, 8);
  const cores = finiteOr(hardwareConcurrency, 8);

  if (width < 360 || height < 480 || memory <= 2 || cores <= 1) return 'static';
  if (width <= 820) return 'mobile';
  if (width < 1180 || memory <= 6 || cores <= 6) return 'medium';
  return 'high';
}

export function profileSupportsWebGL(profile) {
  return ANIMATED_QUALITY_PROFILES.includes(profile);
}

export function collectQualitySignals(scope = window, webglAvailable = true) {
  return {
    deviceMemory: scope.navigator?.deviceMemory,
    experienceMode: 'cinematic',
    hardwareConcurrency: scope.navigator?.hardwareConcurrency,
    reducedMotion: Boolean(scope.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches),
    saveData: Boolean(scope.navigator?.connection?.saveData),
    viewportHeight: scope.innerHeight,
    viewportWidth: scope.innerWidth,
    webglAvailable,
  };
}

export function probeWebGLCapability(documentScope = document) {
  let context = null;
  try {
    const probe = documentScope.createElement('canvas');
    context = probe.getContext('webgl2') || probe.getContext('webgl');
    const available = Boolean(context);
    context?.getExtension?.('WEBGL_lose_context')?.loseContext?.();
    return available;
  } catch {
    return false;
  }
}

export function sceneDiagnostic(location = {}) {
  try {
    const local = ['localhost', '127.0.0.1', '::1'].includes(String(location.hostname));
    if (!local) return null;
    const value = new URLSearchParams(location.search || '').get('scene');
    return ['unavailable', 'resource-error'].includes(value) ? value : null;
  } catch {
    return null;
  }
}
