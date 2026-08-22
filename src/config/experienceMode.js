export const EXPERIENCE_MODES = Object.freeze([
  'cinematic',
  'static',
  'reduced',
  'legacy',
]);

export const DEFAULT_EXPERIENCE_MODE = 'cinematic';

function asBoolean(value, fallback = false) {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return fallback;
}

function isExperienceMode(value) {
  return EXPERIENCE_MODES.includes(value);
}

function safeMatchMedia(scope, query) {
  try {
    return Boolean(scope?.matchMedia?.(query)?.matches);
  } catch {
    return false;
  }
}

function queryOverrideAllowed({ env, location }) {
  if (asBoolean(env?.VITE_AFFLATUS_ALLOW_EXPERIENCE_QUERY)) return true;
  if (env?.DEV) return true;
  const hostname = String(location?.hostname || '');
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Resolve a single home-experience mode without reading app state. The caller
 * supplies browser globals so this remains unit-testable and every entry
 * point follows the same priority order.
 */
export function resolveExperienceMode({
  env = {},
  location,
  navigator,
  matchMedia,
} = {}) {
  const scope = { matchMedia };
  const params = new URLSearchParams(location?.search || '');
  const queryMode = params.get('experience');
  const configuredMode = env.VITE_AFFLATUS_EXPERIENCE_MODE;

  if (queryOverrideAllowed({ env, location }) && isExperienceMode(queryMode)) {
    return queryMode;
  }

  if (isExperienceMode(configuredMode)) return configuredMode;
  if (!asBoolean(env.VITE_CINEMATIC_HOME_V2, true)) return 'legacy';
  if (safeMatchMedia(scope, '(prefers-reduced-motion: reduce)')) return 'reduced';
  if (navigator?.connection?.saveData) return 'reduced';
  return DEFAULT_EXPERIENCE_MODE;
}

export function fallbackExperienceMode(mode) {
  if (mode === 'cinematic') return 'static';
  if (mode === 'static' || mode === 'reduced') return 'legacy';
  return 'legacy';
}

export function legacyHomeHref(location = {}) {
  const pathname = String(location.pathname || '/');
  const locale = pathname.match(/^\/(en|zh)(?:\/|$)/)?.[1];
  const search = String(location.search || '');
  const hash = String(location.hash || '');
  return `${locale ? `/${locale}` : ''}/portfolio.html${search}${hash}`;
}
