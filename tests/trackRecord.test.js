import { describe, it, expect } from 'vitest';
import { trackRecordWinRate, renderTrackRecordHTML } from '../src/lib/trackRecord.js';

const T = (en) => en; // English-only for these tests; bilingual behavior is just T() passthrough
const FABLE_ICON = '<svg>ICON</svg>';
const EXACT_LABEL_GAMES = { en: 'exact scorelines', zh: '比分全中' };

// Reference template used to prove the shared module's output. Originally a
// faithful copy of the pre-extraction games.js renderRecord() (slice(0, 8),
// oldest-first); now updated to match the intentional 2026-07-12 change to
// show the most recent entries with the newest match first.
function originalGamesTemplate(r, T) {
  const rate = r.winRate != null ? r.winRate : (r.resolved ? Math.round((r.correctOutcome / r.resolved) * 100) : 0);
  const log = (r.log || []).slice(-8).reverse().map((e) => {
    const cls = e.exact ? 'exact' : (e.ok ? 'ok' : 'no');
    const icon = e.exact ? '⭐' : (e.ok ? '✓' : '✗');
    return `<span class="rlog ${cls}" title="${T(e.pick_en, e.pick_zh)}">${icon} ${T(e.label_en, e.label_zh)}</span>`;
  }).join('');
  return (
    `<div class="rec-h"><span class="rec-t">${FABLE_ICON} ${T('FABLE TRACK RECORD', 'FABLE 历史战绩')}</span><span class="rec-since">${T('since', '自')} ${r.since || ''}</span></div>` +
    `<div class="rec-stats">` +
      `<div class="rec-big"><b>${rate}%</b><i>${T('outcome win rate', '胜负命中率')}</i></div>` +
      `<div class="rec-kv"><b>${r.correctOutcome || 0}/${r.resolved || 0}</b><i>${T('correct calls', '预测正确')}</i></div>` +
      `<div class="rec-kv"><b>${r.exactScore || 0} ⭐</b><i>${T('exact scorelines', '比分全中')}</i></div>` +
    `</div>` +
    (log ? `<div class="rec-log">${log}</div>` : '') +
    `<p class="rec-note">${T(r.note_en, r.note_zh)}</p>`
  );
}

const SAMPLE_RECORD = {
  since: '2026-06-24',
  resolved: 42,
  correctOutcome: 29,
  exactScore: 8,
  winRate: 69,
  note_en: 'Match-outcome calls scored from Matchday 3 onward.',
  note_zh: '自第三轮起对预测胜负计分。',
  log: [
    { id: 'a', label_en: 'A 1-0 B', label_zh: 'A 1-0 B', pick_en: 'A win', pick_zh: 'A 胜', ok: true, exact: true },
    { id: 'b', label_en: 'C 2-1 D', label_zh: 'C 2-1 D', pick_en: 'D win', pick_zh: 'D 胜', ok: false, exact: false },
    { id: 'c', label_en: 'E 1-1 F', label_zh: 'E 1-1 F', pick_en: 'E win', pick_zh: 'E 胜', ok: true, exact: false },
  ],
};

describe('trackRecordWinRate', () => {
  it('returns 0 for null/undefined record', () => {
    expect(trackRecordWinRate(null)).toBe(0);
    expect(trackRecordWinRate(undefined)).toBe(0);
  });

  it('uses precomputed winRate when present', () => {
    expect(trackRecordWinRate({ winRate: 69, resolved: 42, correctOutcome: 29 })).toBe(69);
  });

  it('derives from correctOutcome/resolved when winRate absent', () => {
    expect(trackRecordWinRate({ resolved: 4, correctOutcome: 3 })).toBe(75);
  });

  it('returns 0 when resolved is 0 (no NaN/Infinity)', () => {
    expect(trackRecordWinRate({ resolved: 0, correctOutcome: 0 })).toBe(0);
  });
});

describe('renderTrackRecordHTML', () => {
  it('returns null when record is missing', () => {
    expect(renderTrackRecordHTML(null, { T, fableIcon: FABLE_ICON, exactLabel: EXACT_LABEL_GAMES })).toBeNull();
  });

  it('matches the original games.js template byte-for-byte', () => {
    const expected = originalGamesTemplate(SAMPLE_RECORD, T);
    const actual = renderTrackRecordHTML(SAMPLE_RECORD, { T, fableIcon: FABLE_ICON, exactLabel: EXACT_LABEL_GAMES });
    expect(actual).toBe(expected);
  });

  it('caps the log at logLimit (default 8) entries', () => {
    const bigLog = Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, label_en: 'L' + i, label_zh: 'L' + i, pick_en: 'P' + i, pick_zh: 'P' + i, ok: true, exact: false }));
    const html = renderTrackRecordHTML({ ...SAMPLE_RECORD, log: bigLog }, { T, fableIcon: FABLE_ICON, exactLabel: EXACT_LABEL_GAMES });
    const count = (html.match(/class="rlog/g) || []).length;
    expect(count).toBe(8);
  });

  it('shows the most recent logLimit entries, not the oldest (newest match must not drop off)', () => {
    const bigLog = Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, label_en: 'L' + i, label_zh: 'L' + i, pick_en: 'P' + i, pick_zh: 'P' + i, ok: true, exact: false }));
    const html = renderTrackRecordHTML({ ...SAMPLE_RECORD, log: bigLog }, { T, fableIcon: FABLE_ICON, exactLabel: EXACT_LABEL_GAMES });
    expect(html).toContain('L11'); // newest entry (appended last) must be visible
    expect(html).not.toContain('>L0<'); // oldest entry should be the one dropped, not the newest
  });

  it('orders the log newest match first (record.log is chronological, display is reverse-chronological)', () => {
    const bigLog = Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, label_en: 'L' + i, label_zh: 'L' + i, pick_en: 'P' + i, pick_zh: 'P' + i, ok: true, exact: false }));
    const html = renderTrackRecordHTML({ ...SAMPLE_RECORD, log: bigLog }, { T, fableIcon: FABLE_ICON, exactLabel: EXACT_LABEL_GAMES });
    // Displayed order should be L11, L10, ..., L4 — newest (last appended) first.
    expect(html.indexOf('L11')).toBeLessThan(html.indexOf('L10'));
    expect(html.indexOf('L10')).toBeLessThan(html.indexOf('L4'));
  });

  it('omits the log block entirely when log is empty', () => {
    const html = renderTrackRecordHTML({ ...SAMPLE_RECORD, log: [] }, { T, fableIcon: FABLE_ICON, exactLabel: EXACT_LABEL_GAMES });
    expect(html).not.toContain('rec-log');
  });

  it('marks exact/ok/no classes and icons correctly', () => {
    const html = renderTrackRecordHTML(SAMPLE_RECORD, { T, fableIcon: FABLE_ICON, exactLabel: EXACT_LABEL_GAMES });
    expect(html).toContain('rlog exact" title="A win">⭐ A 1-0 B');
    expect(html).toContain('rlog no" title="D win">✗ C 2-1 D');
    expect(html).toContain('rlog ok" title="E win">✓ E 1-1 F');
  });

  it('uses the exactLabel parameter (league.js wording differs from games.js)', () => {
    const leagueLabel = { en: 'exact series score', zh: '比分全中' };
    const html = renderTrackRecordHTML(SAMPLE_RECORD, { T, fableIcon: FABLE_ICON, exactLabel: leagueLabel });
    expect(html).toContain('exact series score');
  });
});
