import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findRouteByPath } from '../src/config/siteManifest.js';
import {
  COMMAND_ENTRY,
  LEGACY_ROUTE_COMPATIBILITY,
  PRIMARY_NAVIGATION,
  primaryNavigationForRoute,
} from '../src/config/primaryNavigation.js';

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const navRuntime = readFileSync('src/lib/nav.js', 'utf8');

describe('M03 primary navigation and route compatibility', () => {
  it('defines the five user-facing concepts and maps the previous group names', () => {
    expect(PRIMARY_NAVIGATION.map((item) => item.en)).toEqual([
      'Systems', 'Intelligence', 'Field Notes', 'Experiments', 'About',
    ]);
    expect(PRIMARY_NAVIGATION.find((item) => item.id === 'intelligence')?.legacyGroups).toEqual(['markets']);
    expect(PRIMARY_NAVIGATION.find((item) => item.id === 'field-notes')?.legacyGroups).toEqual(['writing']);
    expect(PRIMARY_NAVIGATION.find((item) => item.id === 'experiments')?.legacyGroups).toEqual(['lab']);
    expect(primaryNavigationForRoute('arena')?.id).toBe('experiments');
    expect(COMMAND_ENTRY.path).toBe('/command/');
  });

  it('keeps every legacy URL as an active entry or a permanent redirect', () => {
    for (const item of LEGACY_ROUTE_COMPATIBILITY) {
      if (item.type === 'route') {
        expect(findRouteByPath(item.target)?.status, item.source).toBe('active');
        continue;
      }
      expect(vercel.redirects).toContainEqual({
        source: item.source,
        destination: item.target,
        permanent: true,
      });
    }
  });

  it('implements a labelled mobile menu with Escape and focus return support', () => {
    expect(navRuntime).toContain('aria-current');
    expect(navRuntime).toContain('afflatus-nav-toggle');
    expect(navRuntime).toContain("event.key === 'Escape'");
    expect(navRuntime).toContain('returnFocus: true');
    expect(navRuntime).toContain('localeFromPathname');
  });
});
