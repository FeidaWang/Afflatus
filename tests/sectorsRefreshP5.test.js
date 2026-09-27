import { describe, it, expect } from 'vitest';
import { readFile, writeFile, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReviewBundle, reviewSnapshots, renderReview, sha256 } from '../scripts/sectors-refresh-review.mjs';

const baselinePath = 'public/data/sectors-frontier/2026-09-23.json';
const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const candidate = () => ({ ...structuredClone(baseline), snapshot_id: 'test-candidate-only' });

describe('P5 offline snapshot review', () => {
  it('reports numeric drift and never approves publication', () => {
    const next = candidate();
    next.observations.find(row => row.value !== null).value -= 1;
    const report = reviewSnapshots(baseline, next);
    expect(report.publishable).toBe(false);
    expect(report.changes.some(c => c.collection === 'observations' && c.field === 'value')).toBe(true);
    expect(renderReview(report)).toContain('potential ranking effects');
  });
  it('blocks bad units, numeric strings, invalid ranges and duplicate observations', () => {
    for (const mutate of [
      next => { next.observations[0].unit = 'wrong'; },
      next => { next.observations[0].value = '42'; },
      next => { next.observations[0].value = 999999; },
      next => next.observations.push(next.observations[0]),
    ]) {
      const next = candidate(); mutate(next);
      expect(() => reviewSnapshots(baseline, next)).toThrow();
    }
  });
  it('exposes compatible unit/version rebases, source changes, row removal and null transitions', () => {
    const next = candidate();
    const metric = next.metrics[0]; metric.version = 'test-version'; metric.unit = 'test-unit';
    next.observations.filter(row => row.metric_id === metric.id).forEach(row => { row.unit = metric.unit; });
    next.sources[0].url = 'https://example.org/test-source';
    next.observations.pop();
    next.observations[0].value = null; next.observations[0].evidence_status = 'not_retrieved';
    const report = reviewSnapshots(baseline, next);
    expect(report.flags.join(' ')).toContain('split version histories');
    expect(report.flags.join(' ')).toContain('usage rights');
    expect(report.changes.some(c => c.field === '*' && c.after === null)).toBe(true);
    expect(report.changes.some(c => c.field === 'value' && c.after === null)).toBe(true);
  });
  it('requires a new identity and a non-regressing retrieval date', () => {
    expect(() => reviewSnapshots(baseline, baseline)).toThrow('new snapshot_id');
    expect(() => reviewSnapshots(baseline, { ...candidate(), retrieved_on: '2020-01-01' })).toThrow('precedes');
    expect(() => reviewSnapshots(baseline, { ...candidate(), retrieved_on: '2027-02-30' })).toThrow('must be a date');
  });
  it('keeps raw bytes and prior snapshot, rejects tampering and refuses overwrite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sectors-p5-'));
    const next = candidate();
    const raw = Buffer.from('Synthetic test evidence, not a live source.');
    const source = next.sources[0];
    const manifest = { schema_version: 1, records: [{ source_id: source.id, url: source.url, version: 'synthetic-fixture', retrieved_at: '2026-09-23T00:00:00Z', method: 'manual_export', raw_path: 'raw.txt', sha256: sha256(raw) }] };
    const afterPath = join(root, 'candidate.json'), evidencePath = join(root, 'evidence.json');
    await writeFile(afterPath, JSON.stringify(next));
    await writeFile(join(root, 'raw.txt'), raw);
    await writeFile(evidencePath, JSON.stringify(manifest));
    const options = { baseline: baselinePath, candidate: afterPath, evidence: evidencePath, root: join(root, 'reviews') };
    const original = await readFile(baselinePath);
    const output = await createReviewBundle(options);
    expect(await readFile(join(output, `raw-${sha256(raw)}.bin`))).toEqual(raw);
    expect(await readFile(join(output, 'baseline.json'))).toEqual(original);
    expect(await readFile(baselinePath)).toEqual(original);
    expect(await readdir(output)).toContain('review.md');
    await expect(createReviewBundle(options)).rejects.toThrow('EEXIST');
    await writeFile(join(root, 'raw.txt'), 'tampered');
    await expect(createReviewBundle(options)).rejects.toThrow('hash mismatch');
    await writeFile(join(root, 'raw.txt'), raw);
    next.observations[0].value -= 1;
    await writeFile(afterPath, JSON.stringify(next));
    await expect(createReviewBundle(options)).rejects.toThrow('retained raw evidence');
    const changedSource = candidate();
    changedSource.sources[1].url = 'https://example.org/changed';
    await writeFile(afterPath, JSON.stringify(changedSource));
    await expect(createReviewBundle(options)).rejects.toThrow('Changed source');
  });
});
