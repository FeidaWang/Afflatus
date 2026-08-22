import { describe, expect, it } from 'vitest';
import {
  fallbackExperienceMode,
  legacyHomeHref,
  resolveExperienceMode,
} from '../src/config/experienceMode.js';

function location(search = '', hostname = 'feida.au', pathname = '/') {
  return { search, hostname, pathname, hash: '' };
}

describe('experience mode guardrails', () => {
  it('preserves the current cinematic home unless configuration selects another mode', () => {
    expect(resolveExperienceMode({ location: location(), navigator: {}, matchMedia: () => ({ matches: false }) })).toBe('cinematic');
    expect(resolveExperienceMode({
      env: { VITE_CINEMATIC_HOME_V2: 'false' },
      location: location(),
      navigator: {},
      matchMedia: () => ({ matches: false }),
    })).toBe('legacy');
  });

  it('uses reduced mode for explicit user/device constraints', () => {
    expect(resolveExperienceMode({
      location: location(),
      navigator: { connection: { saveData: true } },
      matchMedia: () => ({ matches: false }),
    })).toBe('reduced');
    expect(resolveExperienceMode({
      location: location(),
      navigator: {},
      matchMedia: (query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
    })).toBe('reduced');
  });

  it('permits query overrides only for local/preview contexts', () => {
    expect(resolveExperienceMode({
      location: location('?experience=legacy'),
      navigator: {},
      matchMedia: () => ({ matches: false }),
    })).toBe('cinematic');
    expect(resolveExperienceMode({
      location: location('?experience=legacy', '127.0.0.1'),
      navigator: {},
      matchMedia: () => ({ matches: false }),
    })).toBe('legacy');
  });

  it('walks cinematic to static to legacy after failures', () => {
    expect(fallbackExperienceMode('cinematic')).toBe('static');
    expect(fallbackExperienceMode('static')).toBe('legacy');
    expect(fallbackExperienceMode('reduced')).toBe('legacy');
  });

  it('keeps locale, query, and anchor when linking to the legacy experience', () => {
    expect(legacyHomeHref({ pathname: '/zh/', search: '?experience=legacy', hash: '#about' }))
      .toBe('/zh/portfolio.html?experience=legacy#about');
    expect(legacyHomeHref({ pathname: '/', search: '', hash: '' })).toBe('/portfolio.html');
  });
});
