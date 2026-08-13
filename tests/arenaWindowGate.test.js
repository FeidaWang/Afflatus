import { describe, expect, it } from 'vitest';
import { assessArenaWindow } from '../src/lib/arenaWindowGate.js';

describe('Arena ET automation window gate', () => {
  it('accepts the intended window and rejects the seasonal duplicate trigger', () => {
    expect(assessArenaWindow('premarket', new Date('2026-08-12T12:35:00Z'))).toMatchObject({
      date: '2026-08-12', due: true, reason: 'due',
    });
    expect(assessArenaWindow('premarket', new Date('2026-08-12T14:35:00Z'))).toMatchObject({
      due: false, reason: 'after-window',
    });
  });

  it('rejects weekends even when the ET clock matches', () => {
    expect(assessArenaWindow('open', new Date('2026-08-15T14:10:00Z'))).toMatchObject({
      session: false, due: false, reason: 'not-nyse-session',
    });
  });

  it('moves late and postmarket gates on a known early-close session', () => {
    expect(assessArenaWindow('late', new Date('2026-11-27T17:30:00Z'))).toMatchObject({
      earlyClose: true, due: true,
    });
    expect(assessArenaWindow('postmarket', new Date('2026-11-27T18:45:00Z'))).toMatchObject({
      earlyClose: true, due: true,
    });
  });
});
