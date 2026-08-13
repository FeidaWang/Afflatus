#!/usr/bin/env node
import { assessArenaWindow } from '../src/lib/arenaWindowGate.js';

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const windowName = option('window');
if (!windowName) throw new TypeError('Usage: check-arena-window.mjs --window=premarket|open|late|postmarket [--report-only]');
if (option('now') != null || process.argv.some((argument) => argument === '--now')) {
  throw new TypeError('The production due gate always uses the real wall clock; --now is not supported');
}
const now = new Date();

const result = assessArenaWindow(windowName, now);
console.log(JSON.stringify({ checkedAt: now.toISOString(), ...result }, null, 2));
if (!process.argv.includes('--report-only') && !result.due) process.exitCode = 3;
