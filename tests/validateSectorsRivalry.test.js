import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateSectorsRivalry } from '../src/lib/validateSectorsRivalry.js';
import { buildSectorsModelComparison } from '../src/sectors/rivalryController.js';

const snapshot = JSON.parse(readFileSync(new URL('../public/sectors-rivalry.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(snapshot);

describe('sectors rivalry research contract', () => {
  it('accepts the current evidence-layered snapshot', () => {
    expect(validateSectorsRivalry(snapshot)).toEqual({ ok: true, errors: [] });
  });

  it('requires the DeepSeek price-causality boundary', () => {
    const data = clone();
    delete data.deepSeek.causality.hypothesis;

    const result = validateSectorsRivalry(data);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('deepSeek.causality.hypothesis: must contain en/zh text');
  });

  it('keeps 5.6 Sol Ultra outside the ranking with five explicit N/A values', () => {
    const data = clone();
    data.frontierLabs.runtimeMarker.score = 0;
    data.frontierLabs.runtimeMarker.vector[2] = 0;

    const result = validateSectorsRivalry(data);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('frontierLabs.runtimeMarker.score: must be null/N/A');
    expect(result.errors).toContain('frontierLabs.runtimeMarker.vector: all five values must be null/N/A');
  });

  it('renders the runtime marker immediately after Claude Fable 5', () => {
    const rows = buildSectorsModelComparison(snapshot.frontierLabs);
    const fableIndex = rows.findIndex(({ entry }) => entry.model === 'Claude Fable 5');
    expect(rows[fableIndex + 1]).toMatchObject({
      bloc: 'RUNTIME',
      runtime: true,
      entry: { name: '5.6 Sol Ultra', score: null, vector: [null, null, null, null, null] },
    });
  });

  it('rejects a runtime marker whose anchor model cannot be rendered', () => {
    const data = clone();
    data.frontierLabs.runtimeMarker.after = 'Missing model';

    const result = validateSectorsRivalry(data);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('frontierLabs.runtimeMarker.after: anchor model does not exist');
  });

  it('requires all twenty listed instruments to map to a declared supply-chain stage', () => {
    const data = clone();
    data.equities.US[0].chainStage = 'UNDECLARED';

    const result = validateSectorsRivalry(data);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('equities.US[0].chainStage: unknown supply-chain stage');
  });

  it('requires ticker identity to remain unique across both market blocs', () => {
    const data = clone();
    data.equities.CN[0].ticker = data.equities.US[0].ticker;

    const result = validateSectorsRivalry(data);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('equities: tickers must be globally unique across US and CN');
  });

  it('rejects personal GitHub provenance from the public dataset', () => {
    const data = clone();
    data.k3.evidenceBoundary.sources[0].url = 'https://github.com/private-owner/private-source';

    const result = validateSectorsRivalry(data);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('privacy: public rivalry research may not use GitHub provenance');
  });

  it('pins current official DeepSeek prices and concurrency without inventing a demand cause', () => {
    const [flash, pro] = snapshot.deepSeek.pricing;
    expect(flash).toMatchObject({ cacheHit: '$0.0028', cacheMiss: '$0.14', output: '$0.28' });
    expect(pro).toMatchObject({ cacheHit: '$0.003625', cacheMiss: '$0.435', output: '$0.87' });
    expect(snapshot.deepSeek.models.map((model) => model.concurrency)).toEqual([
      '2,500 / ACCOUNT',
      '500 / ACCOUNT',
    ]);
    expect(snapshot.deepSeek.causality.hypothesis.en).toContain('not an official explanation');
    expect(snapshot.deepSeek.causality.hypothesis.zh).toContain('不是官方解释');
  });
});
