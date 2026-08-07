import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateArenaLedger, validateArenaLedgerArchive } from '../src/lib/validateArenaLedger.js';
import { validateArenaUniverseArchive } from '../src/lib/validateArenaUniverse.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { validateDailyTransits } from '../src/lib/validateDailyTransits.js';
import { validateSectorsEcosystem } from '../src/lib/validateSectorsEcosystem.js';
import {
  validateAudioPlaylist,
  validateNyseCalendar,
  validateSignalReleaseDates,
} from '../src/lib/validateStaticPublicData.js';

const fixture = (path) => JSON.parse(readFileSync(path, 'utf8'));

describe('scheduled data artifact validators', () => {
  it('accepts the current Arena ledger', () => {
    expect(validateArenaLedger(fixture('public/arena-ledger.json'))).toEqual({ ok: true, errors: [] });
  });

  it('requires an explicit prediction coverage date', () => {
    const predlog = fixture('public/arena-predlog.json');
    expect(validateArenaPredlog(predlog)).toEqual({ ok: true, errors: [] });
    const { checkedThrough: _checkedThrough, ...withoutCoverage } = predlog;
    expect(validateArenaPredlog(withoutCoverage).ok).toBe(false);
  });

  it('accepts the generated transit and sectors ecosystem shapes', () => {
    expect(validateDailyTransits(fixture('public/transits-daily.json')).ok).toBe(true);
    expect(validateSectorsEcosystem(fixture('public/sectors-ecosystem.json')).ok).toBe(true);
  });

  it('keeps immutable Season 1 archives under their original schemas', () => {
    expect(validateArenaLedgerArchive(fixture('public/arena-ledger-s1.json')).ok).toBe(true);
    expect(validateArenaUniverseArchive(fixture('public/arena-universe-s1.json')).ok).toBe(true);
  });

  it('validates every auxiliary public JSON family', () => {
    expect(validateAudioPlaylist(fixture('public/audio/playlist.json')).ok).toBe(true);
    expect(validateNyseCalendar(fixture('public/nyse-holidays-2026.json')).ok).toBe(true);
    expect(validateSignalReleaseDates(fixture('public/signal-release-dates-2026.json')).ok).toBe(true);
    const duplicated = fixture('public/audio/playlist.json');
    duplicated.tracks.push({ ...duplicated.tracks[0] });
    expect(validateAudioPlaylist(duplicated).ok).toBe(false);
  });
});
