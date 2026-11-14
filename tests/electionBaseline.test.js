import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_VERSION,
  baselineFor,
  baselineUrl,
  validateElectionBaseline,
  validateElectionBaselineManifest,
  validateElectionPartyLogosManifest,
} from '../src/lib/electionBaseline.js';
import { seatCatalogue } from '../src/lib/electionCatalogue.js';
import { coveredSeats, partyTally, raceIndex, seatStates } from '../src/lib/electionResults.js';
import { PARTIES, PARTY_ICONS, partyIconsFor } from '../src/lib/electionRules.js';

const readJson = (relPath) => JSON.parse(readFileSync(relPath, 'utf8'));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

describe('official party emblems', () => {
  it('validates the party emblem manifest and matches every SVG file digest on disk', () => {
    const manifest = readJson('public/assets/elections/parties/manifest.json');
    expect(validateElectionPartyLogosManifest(manifest)).toEqual({ ok: true, errors: [] });
    for (const [id, entry] of Object.entries(manifest)) {
      const webPath = join('public', entry.file);
      expect(existsSync(webPath), `${id} web SVG exists`).toBe(true);
      expect(sha256(readFileSync(webPath)), `${id} web sha256`).toBe(entry.web_sha256);
      if (entry.official_file) {
        const officialPath = join('public', entry.official_file);
        expect(existsSync(officialPath), `${id} official SVG exists`).toBe(true);
        expect(sha256(readFileSync(officialPath)), `${id} official sha256`).toBe(entry.official_sha256);
      }
    }
  });

  it('resolves US emblems, AU dual Coalition emblems, and specific partner candidate emblems', () => {
    expect(partyIconsFor('us', 'dem')).toEqual([PARTY_ICONS['us-dem']]);
    expect(partyIconsFor('us', 'rep')).toEqual([PARTY_ICONS['us-rep']]);
    expect(partyIconsFor('us', 'other')).toEqual([PARTY_ICONS.other]);
    expect(partyIconsFor('us', 'other', 'Independent', true)).toEqual([PARTY_ICONS.independent]);
    expect(partyIconsFor('us', null, null, false)).toEqual([]);

    expect(partyIconsFor('au', 'labor')).toEqual([PARTY_ICONS['au-alp']]);
    expect(partyIconsFor('au', 'coalition')).toEqual([PARTY_ICONS['au-liberal'], PARTY_ICONS['au-nationals']]);
    expect(partyIconsFor('au', 'coalition', 'Liberal')).toEqual([PARTY_ICONS['au-liberal']]);
    expect(partyIconsFor('au', 'coalition', 'The Liberal Party of Australia, New South Wales Division')).toEqual([PARTY_ICONS['au-liberal']]);
    expect(partyIconsFor('au', 'coalition', 'The Nationals')).toEqual([PARTY_ICONS['au-nationals']]);
    expect(partyIconsFor('au', 'coalition', 'National Party of Australia - NSW')).toEqual([PARTY_ICONS['au-nationals']]);
    expect(partyIconsFor('au', 'coalition', 'Liberal National Party')).toEqual([PARTY_ICONS['au-liberal'], PARTY_ICONS['au-nationals']]);
    expect(partyIconsFor('au', 'greens')).toEqual([PARTY_ICONS['au-greens']]);
    expect(partyIconsFor('au', 'teal')).toEqual([PARTY_ICONS.independent]);
    expect(partyIconsFor('au', 'other', 'Liberal Democrats')).toEqual([PARTY_ICONS.other]);
  });
});

describe('official prior-election baselines', () => {
  it('validates the baseline manifest and output file digests', () => {
    const dir = `public/assets/elections/baselines/${BASELINE_VERSION}`;
    const manifest = readJson(`${dir}/manifest.json`);
    expect(validateElectionBaselineManifest(manifest)).toEqual({ ok: true, errors: [] });
    for (const [name, row] of Object.entries(manifest.files)) {
      const bytes = readFileSync(`${dir}/${name}`);
      expect(bytes.byteLength).toBe(row.bytes);
      expect(sha256(bytes)).toBe(row.sha256);
    }
  });

  it('validates VIC 2022 baseline with exact 56/28/4 Assembly tally and neutral multi-member Council regions', () => {
    const meta = baselineFor('vic-2026');
    expect(baselineUrl(meta.file)).toBe(`/assets/elections/baselines/${BASELINE_VERSION}/vic-2022.json`);
    const vic = readJson(`public${baselineUrl(meta.file)}`);
    expect(validateElectionBaseline(vic)).toEqual({ ok: true, errors: [] });

    const states = seatStates(vic);
    const races = raceIndex(vic);
    const assemblySeats = seatCatalogue('vic-2026', 'assembly');
    const councilSeats = seatCatalogue('vic-2026', 'council');
    expect(coveredSeats(assemblySeats, races)).toBe(88);
    expect(coveredSeats(councilSeats, races)).toBe(40);
    expect(partyTally(assemblySeats, states, PARTIES.au)).toEqual({
      labor: { decided: 56, leading: 0 },
      coalition: { decided: 28, leading: 0 },
      greens: { decided: 4, leading: 0 },
      teal: { decided: 0, leading: 0 },
      other: { decided: 0, leading: 0 },
    });
    expect(councilSeats.every((seat) => states[seat.seatId] === undefined)).toBe(true);
  });

  it('validates NSW 2023 baseline with exact 45/36/3/9 Assembly tally', () => {
    const meta = baselineFor('nsw-2027');
    expect(baselineUrl(meta.file)).toBe(`/assets/elections/baselines/${BASELINE_VERSION}/nsw-2023.json`);
    const nsw = readJson(`public${baselineUrl(meta.file)}`);
    expect(validateElectionBaseline(nsw)).toEqual({ ok: true, errors: [] });

    const states = seatStates(nsw);
    const races = raceIndex(nsw);
    const assemblySeats = seatCatalogue('nsw-2027', 'assembly');
    expect(coveredSeats(assemblySeats, races)).toBe(93);
    expect(partyTally(assemblySeats, states, PARTIES.au)).toEqual({
      labor: { decided: 45, leading: 0 },
      coalition: { decided: 36, leading: 0 },
      greens: { decided: 3, leading: 0 },
      teal: { decided: 9, leading: 0 },
      other: { decided: 0, leading: 0 },
    });
    expect(baselineFor('us-2026')).toBeNull();
    expect(baselineFor('au-2028')).toBeNull();
  });
});
