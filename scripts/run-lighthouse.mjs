#!/usr/bin/env node
import {
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const chromePath = process.env.CHROME_PATH || chromium.executablePath();
if (!chromePath || !existsSync(chromePath)) {
  console.error('Lighthouse requires Chromium. Run: npx playwright install chromium');
  process.exit(1);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const reportDir = fileURLToPath(new URL('../.lighthouseci/', import.meta.url));
function cleanGeneratedReports() {
  if (!existsSync(reportDir)) return;
  for (const file of readdirSync(reportDir)) {
    if (/^(?:lhr-|flags-|manifest\.json$|links\.json$|assertion-results\.json$)/.test(file)) {
      unlinkSync(fileURLToPath(new URL(`../.lighthouseci/${file}`, import.meta.url)));
    }
  }
}

function hasTransientNoFcp() {
  if (!existsSync(reportDir)) return false;
  return readdirSync(reportDir)
    .filter((file) => /^lhr-.*\.json$/.test(file))
    .some((file) => {
      try {
        const report = JSON.parse(readFileSync(
          fileURLToPath(new URL(`../.lighthouseci/${file}`, import.meta.url)),
          'utf8',
        ));
        return report.runtimeError?.code === 'NO_FCP';
      } catch {
        return false;
      }
    });
}

const cliPath = fileURLToPath(
  new URL('../node_modules/@lhci/cli/src/cli.js', import.meta.url),
);
function runAutorun() {
  return new Promise((resolveRun) => {
    const child = spawn(
      process.execPath,
      [cliPath, 'autorun', `--collect.chromePath=${chromePath}`],
      {
        cwd: root,
        env: { ...process.env, CHROME_PATH: chromePath },
        stdio: ['inherit', 'pipe', 'pipe'],
      },
    );
    let output = '';
    const forward = (stream, target) => {
      stream.on('data', (chunk) => {
        const text = String(chunk);
        output = `${output}${text}`.slice(-120_000);
        target.write(chunk);
      });
    };
    forward(child.stdout, process.stdout);
    forward(child.stderr, process.stderr);
    child.once('error', (error) => resolveRun({ status: 1, error, output }));
    child.once('close', (status) => resolveRun({ status: status ?? 1, output }));
  });
}

let result;
for (let attempt = 1; attempt <= 2; attempt += 1) {
  cleanGeneratedReports();
  result = await runAutorun();

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status === 0) break;
  if (attempt === 1 && (hasTransientNoFcp() || /\bNO_FCP\b/.test(result.output))) {
    console.warn('Lighthouse hit transient NO_FCP; cleaning generated reports and retrying once.');
    continue;
  }
  break;
}
process.exit(result.status ?? 1);
