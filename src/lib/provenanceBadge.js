/* ============================================================
   PROVENANCE BADGE — shared "FABLE 5 MAX · data age · sources · NOT ADVICE"
   widget (ROADMAP §7.5, V12 queue A). Pure logic only: each page's data JSON
   has a different raw schema (arena-news.json uses date/generatedAt with no
   version; games-data.json has updated but no version; sectors/signal/leagues
   use {updated, version}), so this module does NOT read files directly — the
   calling page maps its own DATA into { updatedAt, version, sourceCount, lang }
   and mounts the returned { tier, text } itself. No data-file schema changes.
   ============================================================ */

const HOUR_MS = 1000 * 60 * 60;

// Hours between `updatedAt` (ISO date "YYYY-MM-DD" or full timestamp) and
// `now`. Returns null for missing/unparseable input (empty-seed state) rather
// than NaN, so callers can treat "no data yet" as its own case.
export function computeAgeHours(updatedAt, now) {
  if (!updatedAt) return null;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return null;
  const n = (now instanceof Date ? now : new Date()).getTime();
  return Math.max(0, (n - t) / HOUR_MS);
}

// Thresholds per roadmap §7.5: >36h amber, >72h red. `null` (seed/no data)
// is its own tier rather than falling into "fresh".
export function computeBadgeTier(ageHours) {
  if (ageHours == null) return 'seed';
  if (ageHours > 72) return 'red';
  if (ageHours > 36) return 'amber';
  return 'fresh';
}

function formatAge(ageHours, lang) {
  if (ageHours == null) return lang === 'zh' ? '暂无数据' : 'no data yet';
  const days = Math.floor(ageHours / 24);
  if (days >= 1) return lang === 'zh' ? `${days} 天前` : `${days}d ago`;
  const hours = Math.floor(ageHours);
  return lang === 'zh' ? `${hours} 小时前` : `${hours}h ago`;
}

// Builds the badge's tier (for CSS coloring) and display text. `sourceCount`
// and `version` are optional — omit the segment rather than print "null".
export function buildProvenanceBadge({ updatedAt, version, sourceCount, lang = 'en', now } = {}) {
  const ageHours = computeAgeHours(updatedAt, now);
  const tier = computeBadgeTier(ageHours);
  const parts = ['FABLE 5 MAX', formatAge(ageHours, lang)];
  if (typeof sourceCount === 'number') parts.push(lang === 'zh' ? `来源 ${sourceCount}` : `${sourceCount} sources`);
  if (version != null) parts.push('v' + version);
  parts.push(lang === 'zh' ? '非投资建议' : 'NOT ADVICE');
  return { tier, text: parts.join(' · ') };
}
