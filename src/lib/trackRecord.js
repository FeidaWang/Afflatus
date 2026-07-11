/* ============================================================
   TRACK RECORD — shared "Fable track record" hit-rate widget (ROADMAP §7.5
   V12). Extracted from games.js/league.js, which had byte-identical
   renderRecord() implementations reading the same data.record shape:
   { since, resolved, correctOutcome, exactScore, winRate, note_en, note_zh,
     log: [{ id, label_en, label_zh, pick_en, pick_zh, ok, exact }] }.
   Signal has no equivalent record structure yet — not covered here (see
   roadmap for that gap). Brier score is NOT computed here: neither games
   nor leagues data retains the original prediction confidence once a match
   resolves into `log`, so there is nothing to score against yet.
   ============================================================ */

// winRate is normally precomputed by the scheduled task, but derive it from
// correctOutcome/resolved if absent (0 resolved -> 0, not NaN/Infinity).
export function trackRecordWinRate(record) {
  if (!record) return 0;
  if (record.winRate != null) return record.winRate;
  return record.resolved ? Math.round((record.correctOutcome / record.resolved) * 100) : 0;
}

// `T` is the page's own bilingual picker `(en, zh) => string`; `fableIcon` is
// the page's inline SVG markup; `exactLabel` is the only wording that
// actually differed between games.js ("exact scorelines") and league.js
// ("exact series score") — { en, zh }. Returns null when there's no record
// yet (caller hides/clears the host element).
export function renderTrackRecordHTML(record, { T, fableIcon, exactLabel, logLimit = 8, title } = {}) {
  if (!record) return null;
  const rate = trackRecordWinRate(record);
  const log = (record.log || []).slice(-logLimit).reverse().map((e) => {
    const cls = e.exact ? 'exact' : (e.ok ? 'ok' : 'no');
    const icon = e.exact ? '⭐' : (e.ok ? '✓' : '✗');
    return `<span class="rlog ${cls}" title="${T(e.pick_en, e.pick_zh)}">${icon} ${T(e.label_en, e.label_zh)}</span>`;
  }).join('');
  const titleText = title || { en: 'FABLE TRACK RECORD', zh: 'FABLE 历史战绩' };
  return (
    `<div class="rec-h"><span class="rec-t">${fableIcon} ${T(titleText.en, titleText.zh)}</span><span class="rec-since">${T('since', '自')} ${record.since || ''}</span></div>` +
    `<div class="rec-stats">` +
      `<div class="rec-big"><b>${rate}%</b><i>${T('outcome win rate', '胜负命中率')}</i></div>` +
      `<div class="rec-kv"><b>${record.correctOutcome || 0}/${record.resolved || 0}</b><i>${T('correct calls', '预测正确')}</i></div>` +
      `<div class="rec-kv"><b>${record.exactScore || 0} ⭐</b><i>${T(exactLabel.en, exactLabel.zh)}</i></div>` +
    `</div>` +
    (log ? `<div class="rec-log">${log}</div>` : '') +
    `<p class="rec-note">${T(record.note_en, record.note_zh)}</p>`
  );
}
