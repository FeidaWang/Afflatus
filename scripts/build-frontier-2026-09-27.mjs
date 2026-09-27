// scripts/build-frontier-2026-09-27.mjs
// Derives the 09-27 snapshot from 09-23 so the diff stays reviewable.
// Values re-read in the browser on 2026-09-28 (Task 2 Step 1). null = not published by the evaluator.
// Lab-reported benchmarks (Anthropic's Terminal-Bench 66.4%, xAI's GDPval 1695 etc.) use different
// protocols from the Artificial Analysis metrics and are deliberately NOT placed in these slots.
import { readFileSync, writeFileSync } from 'node:fs';
import { validateSnapshot } from '../src/sectors/frontier/frontier-core.mjs';

const DATE = '2026-09-27';
const base = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-23.json', 'utf8'));
const METRICS = base.metrics.map((m) => m.id);

const PATCH = {
  add: {
    model: {
      id: 'opus55-max', name: 'Claude Opus 5.5', lab: 'Anthropic', lab_geography: 'US',
      configuration: 'max', open_weights: false, license: null, total_parameters_b: null,
      context_tokens: 1000000, declared_input_modalities: ['text', 'image'],
      status: 'reported_snapshot', source_ids: ['AA-OPUS55', 'ANT-OPUS55'],
      prices: { currency: 'USD', per_tokens: 1000000, input: 4, output: 20, cache_read: 0.2, cache_write: 5,
        as_of: DATE, source_ids: ['ANT-OPUS55'],
        note: 'Published reference rate, not a guaranteed quote. Region, tier, long context, tools, batch and cache writes may change billed cost.' },
    },
    // AA model page (Adaptive Reasoning, Max Effort): index 58, $5.98 per index task; component scores not shown.
    values: { intelligence: 58, briefcase: null, gdpval: null, automation: null, terminal: null, scicode: null,
      hle: null, gdp_pdf: null, critpt: null, omniscience: null, lcr: null, cost_task: 5.98 },
  },
  replace: {
    from: 'grok-xhigh',
    model: { id: 'grok47-xhigh', name: 'Grok 4.7', source_ids: ['AA-GROK47'],
      // AA page: $2 / $6, 75% cache discount → $0.50 cache read; 500k context.
      prices: { input: 2, output: 6, cache_read: 0.5, cache_write: null, as_of: DATE, source_ids: ['AA-GROK47'] } },
    values: { intelligence: 46, cost_task: 3.74 },
  },
  sources: [
    { id: 'AA-OPUS55', title: 'Claude Opus 5.5 (Adaptive Reasoning, Max Effort) — Artificial Analysis', url: 'https://artificialanalysis.ai/models/claude-opus-5-5', publisher: 'Artificial Analysis', evidence_type: 'evaluator_report' },
    { id: 'ANT-OPUS55', title: 'Claude Opus 5.5', url: 'https://www.anthropic.com/claude-opus-5-5', publisher: 'Anthropic', evidence_type: 'provider_claim', published_at: '2026-09-22' },
    { id: 'AA-GROK47', title: 'Grok 4.7 (xhigh) — Artificial Analysis', url: 'https://artificialanalysis.ai/models/grok-4-7', publisher: 'Artificial Analysis', evidence_type: 'evaluator_report' },
  ],
};

// Mirrors the 09-23 conventions enforced by validateSnapshot: a published value cites evaluator
// sources only; a missing value is `not_retrieved` with no sources and no locator.
const obsFor = (model, values, sourceIds) => METRICS.map((metric_id) => {
  const value = values[metric_id] ?? null;
  const has = value !== null;
  return {
    model_id: model.id, metric_id, cohort_id: base.cohorts[0].id,
    protocol_id: base.observations.find((o) => o.metric_id === metric_id).protocol_id,
    value, unit: base.metrics.find((m) => m.id === metric_id).unit,
    display_precision: base.observations.find((o) => o.metric_id === metric_id).display_precision,
    observed_on: DATE, measured_at: null, source_ids: has ? sourceIds : [],
    evidence_status: has ? 'reported_snapshot' : 'not_retrieved', confidence_interval: null,
    source_locator: has ? `${model.name} / ${model.configuration} / ${metric_id}` : null,
  };
});

const out = structuredClone(base);
out.snapshot_id = `frontier-selected-${DATE}`;
out.retrieved_on = DATE;
out.coverage_description = 'Selected public evaluator snapshots: 15 configurations from 11 named labs; not a full global leaderboard or a simultaneous rerun. Submetric coverage is narrower.';

const old = out.models.find((m) => m.id === PATCH.replace.from);
const replaced = { ...old, ...PATCH.replace.model, prices: { ...old.prices, ...PATCH.replace.model.prices } };
out.models = out.models.map((m) => (m.id === PATCH.replace.from ? replaced : m));
// Grok 4.6's old values must not carry over: every metric starts null, then only re-measured values apply.
out.observations = out.observations
  .filter((o) => o.model_id !== PATCH.replace.from)
  .concat(obsFor(replaced, PATCH.replace.values, ['AA-GROK47']));

out.models.unshift(PATCH.add.model);
out.observations.push(...obsFor(PATCH.add.model, PATCH.add.values, ['AA-OPUS55']));

for (const s of PATCH.sources) out.sources.push({ publisher: 'Primary publisher identified by URL', evidence_type: 'evaluator_report',
  published_at: null, retrieved_on: DATE, extraction_method: 'manual browser read', raw_run_export_available: false, note: '', ...s });

const errors = validateSnapshot(out);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
writeFileSync(`public/data/sectors-frontier/${DATE}.json`, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${out.models.length} models, ${out.observations.length} observations`);
