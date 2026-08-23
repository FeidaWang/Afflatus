import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findRouteByPath } from '../src/config/siteManifest.js';
import { COMMAND_ENTRY } from '../src/config/primaryNavigation.js';

const command = readFileSync('src/mission/CommandApp.jsx', 'utf8');
const commandEntry = readFileSync('src/command-main.jsx', 'utf8');
const flight = readFileSync('src/mission/FlightExperimentApp.jsx', 'utf8');
const flightEntry = readFileSync('src/flight-experiment-main.jsx', 'utf8');

describe('M14 Mission Room and Flight Experiment split', () => {
  it('routes the sole public command entry to the truthful Mission Room', () => {
    expect(COMMAND_ENTRY.path).toBe('/command/');
    expect(findRouteByPath('/command/')?.status).toBe('active');
    expect(command).toContain('Current Objective');
    expect(command).toContain('Current Trajectory');
    expect(command).toContain('Next Action');
    expect(command).toContain('Preserve capital while maintaining optionality.');
    expect(command).toContain('No live account values');
  });

  it('gives Observe, Model and Commit distinct keyboard-operable semantics', () => {
    for (const mode of ['observe', 'model', 'commit']) expect(command).toContain(`id: '${mode}'`);
    expect(command).toContain('role="tablist"');
    expect(command).toContain('role="tab"');
    expect(command).toContain('role="tabpanel"');
    expect(command).toContain("event.key === 'ArrowRight'");
    expect(command).toContain("event.key === 'Home'");
  });

  it('keeps game assets outside the command entry bundle', () => {
    expect(commandEntry).not.toMatch(/three|combat|radar|portfolio\.html/i);
    expect(command).not.toMatch(/from ['"]three|RADAR|G-FORCE|WEAPONS|SHIELDS/);
    expect(flightEntry).not.toMatch(/from ['"]three/);
  });

  it('marks the separate flight route experimental and preserves the legacy deck', () => {
    const route = findRouteByPath('/experiments/flight/');
    expect(route?.capabilities).toEqual(expect.arrayContaining(['experiment', 'legacy-flight', 'noindex']));
    for (const feature of ['NAV / COMBAT', 'RADAR', 'WEAPONS', 'SHIELDS', 'G-FORCE']) {
      expect(flight).toContain(feature);
    }
    expect(flight).toContain('/portfolio.html?mode=flight');
    expect(flight).toContain('import.meta.env.DEV');
    expect(flight).toContain("get('flight-debug') === '1'");
  });
});
