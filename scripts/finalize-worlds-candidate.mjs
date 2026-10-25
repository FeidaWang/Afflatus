#!/usr/bin/env node
/**
 * finalize-worlds-candidate.mjs <candidate-dir>
 *
 * Merges the model session's `worlds-model-output.json` into the candidate
 * `worlds-data.json` (spec §5.4/§7): bounded adjustments to P(win) with a
 * reason and source, bilingual explanations, exactly three factors per
 * series (≥1 Fearless-related). Anything out of range or unsourced is
 * dropped and recorded in `notes`; series with a result or a missed window
 * are never touched. Without a model output file the candidate passes
 * through with its empty explanation fields so the numbers still publish.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyAdjustment, enumerateSeries, impliedOdds } from '../src/lib/worldsModel.js';
import { validateWorldsData } from '../src/lib/validateWorldsData.js';

const directory = process.argv[2];
if (!directory) {
  console.error('usage: finalize-worlds-candidate.mjs <candidate-dir>');
  process.exit(64);
}
const dataPath = join(directory, 'worlds-data.json');
const modelPath = join(directory, 'worlds-model-output.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const model = existsSync(modelPath) ? JSON.parse(readFileSync(modelPath, 'utf8')) : null;
const notes = Array.isArray(data.notes) ? data.notes : [];
const round3 = (value) => Math.round(value * 1000) / 1000;
const isFearless = (text) => /fearless|无畏/i.test(String(text || ''));
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
// Scoreline distribution for an adjusted series probability: find the game
// probability whose Fearless-corrected enumeration lands on the target P(win).
function enumerateForTarget(target, bo, delta) {
  let lo = 0.001;
  let hi = 0.999;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (enumerateSeries(mid, bo, delta).pWin[0] < target) lo = mid; else hi = mid;
  }
  return enumerateSeries((lo + hi) / 2, bo, delta);
}
const factors = (list) => (Array.isArray(list) && list.length === 3 && list.every((f) => typeof f === 'string' && f.trim()) && list.some(isFearless)
  ? list.map((f) => f.trim())
  : null);

if (!model) {
  notes.push('no worlds-model-output.json: published without model explanations');
} else {
  for (const entry of model.series || []) {
    const series = data.series.find((s) => s.id === entry.id);
    if (!series) { notes.push(`model referenced unknown series ${entry.id}`); continue; }
    if (series.result || series.missed || !series.pick) continue;
    const adj = Number(entry.adj) || 0;
    if (adj !== 0) {
      const sourced = typeof entry.adj_src === 'string' && /^https:\/\//.test(entry.adj_src) && text(entry.adj_reason, 400);
      const adjusted = sourced ? applyAdjustment(series.pick.pWin[0], adj) : null;
      if (adjusted == null) {
        notes.push(`${series.id}: adjustment ${adj} dropped (${sourced ? 'out of range' : 'missing reason or https source'})`);
      } else {
        const outcome = enumerateForTarget(adjusted, series.bo, series.fearless?.delta || 0);
        series.pick = {
          ...series.pick,
          side: adjusted >= 0.5 ? 'home' : 'away',
          pWin: [round3(adjusted), round3(1 - adjusted)],
          score: outcome.best.score,
          pScore: round3(outcome.best.p),
          oddsImplied: impliedOdds([adjusted, 1 - adjusted]),
          adj: round3(adj),
          adjReason: sourced,
          adjSrc: entry.adj_src,
        };
      }
    }
    series.reason_en = text(entry.reason_en, 600);
    series.reason_zh = text(entry.reason_zh, 240);
    const en = factors(entry.factors_en);
    const zh = factors(entry.factors_zh);
    if (en && zh) { series.factors_en = en; series.factors_zh = zh; } else {
      series.factors_en = []; series.factors_zh = [];
      notes.push(`${series.id}: factors rejected (need exactly 3 per language, ≥1 Fearless-related)`);
    }
  }
  for (const entry of model.champion || []) {
    const team = data.champion.find((c) => c.team === entry.team);
    if (team) { team.reason_en = text(entry.reason_en, 400); team.reason_zh = text(entry.reason_zh, 200); }
  }
  for (const entry of model.mvp || []) {
    const player = data.mvp.find((m) => m.player === entry.player);
    if (player) { player.basis_en = text(entry.basis_en, 400); player.basis_zh = text(entry.basis_zh, 200); }
  }
  for (const entry of model.fearless || []) {
    const team = data.fearless.find((f) => f.team === entry.team);
    if (team) { team.note_en = text(entry.note_en, 400); team.note_zh = text(entry.note_zh, 200); }
  }
  if (text(model.note_en, 600)) data.note_en = text(model.note_en, 600);
  if (text(model.note_zh, 300)) data.note_zh = text(model.note_zh, 300);
  for (const note of model.notes || []) if (typeof note === 'string' && note.trim()) notes.push(`model: ${note.trim()}`);
}

data.notes = notes;
const validation = validateWorldsData(data);
if (!validation.ok) {
  console.error('[finalize-worlds-candidate] finalized candidate failed validation:');
  for (const error of validation.errors) console.error(`  - ${error}`);
  process.exit(1);
}
writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`[finalize-worlds-candidate] ${dataPath}: ${data.series.filter((s) => s.pick && !s.result).length} open picks, ${notes.length} notes`);
