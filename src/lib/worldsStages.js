/* Worlds 2026 stage model (spec §8 item 2). Turns the flat `series[]`
   from worlds-data.json into the eight cells of the stage scrubber
   (R1–R5, QF, SF, F). Pure and DOM-free so it has its own vitest suite;
   the range math lives in stageRange.js and the event wiring in the page. */

function swiss(round) {
  return { key: `r${round}`, stage: 'swiss', round, label_en: `R${round}`, label_zh: `R${round}`, long_en: `Swiss round ${round}`, long_zh: `瑞士轮第${'一二三四五'[round - 1]}轮` };
}

export const STAGES = Object.freeze([
  swiss(1), swiss(2), swiss(3), swiss(4), swiss(5),
  { key: 'qf', stage: 'qf', label_en: 'QF', label_zh: 'QF', long_en: 'Quarterfinals', long_zh: '八强' },
  { key: 'sf', stage: 'sf', label_en: 'SF', label_zh: 'SF', long_en: 'Semifinals', long_zh: '半决赛' },
  { key: 'f', stage: 'final', label_en: 'F', label_zh: 'F', long_en: 'Final', long_zh: '决赛' },
].map(Object.freeze));

const toMs = (now) => (now instanceof Date ? now.getTime() : now);

/** @returns {Array<object>} 8 entries `{...STAGES[i], matches}`; series with an unknown stage/round are dropped. */
export function buildStages(series) {
  return STAGES.map((stage) => ({
    ...stage,
    matches: (series || [])
      .filter((s) => s.stage === stage.stage && (stage.stage !== 'swiss' || s.round === stage.round))
      .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff)),
  }));
}

/** Default scrubber window: first stage with an unresolved match, else the last stage that has matches, else 0. */
export function currentStageIndex(stages) {
  const open = stages.findIndex((st) => st.matches.some((m) => !m.result));
  if (open !== -1) return open;
  for (let i = stages.length - 1; i >= 0; i--) if (stages[i].matches.length) return i;
  return 0;
}

/** Earliest kickoff strictly after `now` among unresolved series, as the stored ISO string; null when nothing is upcoming. */
export function nextKickoff(series, now) {
  const t = toMs(now);
  let best = null;
  for (const s of series || []) {
    if (s.result) continue;
    const k = Date.parse(s.kickoff);
    if (k > t && (best === null || k < Date.parse(best))) best = s.kickoff;
  }
  return best;
}
