import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function scratchInput(payload) {
  const scratch = mkdtempSync(join(tmpdir(), 'arena-settlement-test-'));
  temporaryDirectories.push(scratch);
  const inputPath = join(scratch, 'input.json');
  writeFileSync(inputPath, JSON.stringify(payload));
  return { scratch, inputPath, outputDirectory: join(scratch, 'candidates') };
}

function run(inputPath, outputDirectory) {
  return spawnSync(process.execPath, [
    resolve('scripts/apply-arena-run.mjs'), inputPath,
    ...(outputDirectory ? [`--output=${outputDirectory}`] : []),
  ], { encoding: 'utf8' });
}

describe('apply-arena-run production CLI fail-closed boundaries', () => {
  it('requires candidate-only output and has no legacy direct-publish mode', () => {
    const { inputPath } = scratchInput({
      book: 'S', window: 'open-window', etDateStr: '2099-01-05', proposedOrders: [],
    });
    const result = run(inputPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--output=<tmpdir>');
  });

  it('rejects caller-supplied clocks and prices before any quote or candidate write', () => {
    for (const forbidden of [
      { nowIso: '2099-01-05T15:05:00.000Z' },
      { priceMap: { WAB: 1 } },
    ]) {
      const { inputPath, outputDirectory } = scratchInput({
        book: 'S', window: 'open-window', etDateStr: '2099-01-05', proposedOrders: [], ...forbidden,
      });
      const result = run(inputPath, outputDirectory);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/forbidden/);
      expect(existsSync(outputDirectory)).toBe(false);
    }
  });

  it('uses the actual wall clock even for an empty order list', () => {
    const { inputPath, outputDirectory } = scratchInput({
      book: 'S', window: 'open-window', etDateStr: '2099-01-05', proposedOrders: [],
    });
    const ledgerPath = resolve('public/arena-ledger.json');
    const runlogPath = resolve('public/arena-runlog.json');
    const beforeLedger = readFileSync(ledgerPath, 'utf8');
    const beforeRunlog = readFileSync(runlogPath, 'utf8');

    const result = run(inputPath, outputDirectory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/not the current America\/New_York date/);
    expect(existsSync(outputDirectory)).toBe(false);
    expect(readFileSync(ledgerPath, 'utf8')).toBe(beforeLedger);
    expect(readFileSync(runlogPath, 'utf8')).toBe(beforeRunlog);
  });

  it('rejects a non-canonical trading model/window before touching the network', () => {
    const { inputPath, outputDirectory } = scratchInput({
      book: 'S', window: 'post-market', etDateStr: '2099-01-05', proposedOrders: [],
    });
    const result = run(inputPath, outputDirectory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Model S cannot execute/);
    expect(existsSync(outputDirectory)).toBe(false);
  });
});
