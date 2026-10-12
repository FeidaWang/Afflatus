import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'transits-'));
function generate(now, name) {
  const output = join(dir, `${name}.json`);
  execFileSync(process.execPath, ['scripts/gen-transits-daily.mjs', `--now=${now}`, `--output=${output}`], { stdio: 'ignore' });
  return readFileSync(output, 'utf8');
}

describe('gen-transits-daily', () => {
  it('writes identical output for every run within one Melbourne day', () => {
    // 00:17 and 23:40 Melbourne (AEDT) on 12 Oct 2026
    const early = generate('2026-10-11T13:17:00Z', 'early');
    const late = generate('2026-10-12T12:40:00Z', 'late');
    expect(late).toBe(early);
  });

  it('computes the sky at 12:00 Melbourne on the published date', () => {
    const aedt = JSON.parse(generate('2026-10-11T13:17:00Z', 'aedt'));
    expect(aedt.date).toBe('2026-10-12');
    expect(aedt.generatedAt).toBe('2026-10-12T01:00:00.000Z');
    const aest = JSON.parse(generate('2026-07-01T20:00:00Z', 'aest'));
    expect(aest.date).toBe('2026-07-02');
    expect(aest.generatedAt).toBe('2026-07-02T02:00:00.000Z');
  });
});
