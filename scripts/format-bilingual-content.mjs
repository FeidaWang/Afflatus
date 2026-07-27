#!/usr/bin/env node
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const PUBLIC_ROOT = resolve(ROOT, 'public');
const EXCLUDED_DIRECTORIES = new Set(['audio', 'novels']);
const PUNCTUATION = Object.freeze({
  ',': '，',
  ';': '；',
  ':': '：',
  '!': '！',
  '?': '？',
});

function walkJson(directory, output = []) {
  if (!existsSync(directory)) return output;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walkJson(path, output);
    else if (extname(path) === '.json') output.push(path);
  }
  return output;
}

function isChineseField(key) {
  return key === 'zh' || key.endsWith('_zh') || key.endsWith('Zh');
}

export function normalizeChinesePunctuation(value) {
  if (typeof value !== 'string' || !/\p{Script=Han}/u.test(value)) return value;
  return value
    .replace(
      /([\p{Script=Han}])([,;:!?])|([,;:!?])(?=[\p{Script=Han}])/gu,
      (_match, previous, trailingMark, leadingMark) => (
        previous
          ? `${previous}${PUNCTUATION[trailingMark]}`
          : PUNCTUATION[leadingMark]
      ),
    )
    .replace(/"([^"\n]*\p{Script=Han}[^"\n]*)"/gu, '「$1」');
}

function normalizeTree(value, chineseBranch = false) {
  if (typeof value === 'string') {
    return chineseBranch ? normalizeChinesePunctuation(value) : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeTree(item, chineseBranch));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    normalizeTree(child, chineseBranch || isChineseField(key)),
  ]));
}

export function formatJsonSource(source) {
  const parsed = JSON.parse(source);
  const normalized = normalizeTree(parsed);
  if (JSON.stringify(normalized) === JSON.stringify(parsed)) return source;
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const write = process.argv.includes('--write');
  const changed = [];
  for (const file of walkJson(PUBLIC_ROOT)) {
    const source = readFileSync(file, 'utf8');
    const formatted = formatJsonSource(source);
    if (formatted === source) continue;
    changed.push(relative(ROOT, file));
    if (write) writeFileSync(file, formatted);
  }

  if (changed.length === 0) {
    console.log('OK: Chinese punctuation is normalized in public bilingual JSON');
  } else if (write) {
    console.log(`Updated ${changed.length} bilingual JSON file(s):\n${changed.join('\n')}`);
  } else {
    console.error(`FAIL: run "npm run format:i18n" to normalize:\n${changed.join('\n')}`);
    process.exitCode = 1;
  }
}
