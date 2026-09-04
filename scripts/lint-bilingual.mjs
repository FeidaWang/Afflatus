#!/usr/bin/env node
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import ts from 'typescript';
import {
  UI_LABEL_LIMITS,
  validateBilingualPair,
  validateBilingualTree,
} from '../src/lib/bilingualContent.js';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.ts']);
const SKIP_DIRECTORIES = new Set([
  '.git',
  'data',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const SKIP_JSON = new Set([
  'package-lock.json',
  'lighthouse-baseline.json',
]);
const DYNAMIC = Symbol('dynamic');

function toPosix(path) {
  return path.replaceAll('\\', '/');
}

function displayPath(path) {
  return toPosix(relative(ROOT, path));
}

function walkFiles(directory, predicate, output = []) {
  if (!existsSync(directory)) return output;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && (
      SKIP_DIRECTORIES.has(entry.name) ||
      /^dist[-_]/.test(entry.name)
    )) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walkFiles(path, predicate, output);
    else if (predicate(path)) output.push(path);
  }
  return output;
}

function attributes(node) {
  return Object.fromEntries((node.attrs || []).map((attr) => [attr.name, attr.value]));
}

function linePath(file, line, label) {
  return `${displayPath(file)}:${line || 1}${label ? ` ${label}` : ''}`;
}

function htmlPairIssues(node, file) {
  if (!node.tagName) return [];
  const attrs = attributes(node);
  const line = node.sourceCodeLocation?.startLine || 1;
  const identity = `${node.tagName}${attrs.id ? `#${attrs.id}` : ''}`;
  const path = linePath(file, line, identity);
  const issues = [];
  const explicitMax = {
    en: Number(attrs['data-i18n-max-en']) || undefined,
    zh: Number(attrs['data-i18n-max-zh']) || undefined,
  };
  const tagLimit = UI_LABEL_LIMITS[node.tagName];
  const maxChars = explicitMax.en || explicitMax.zh
    ? explicitMax
    : tagLimit;

  if ('data-en' in attrs || 'data-zh' in attrs) {
    issues.push(...validateBilingualPair(
      { en: attrs['data-en'], zh: attrs['data-zh'] },
      { path, maxChars },
    ));
  }
  if ('data-en-ph' in attrs || 'data-zh-ph' in attrs) {
    issues.push(...validateBilingualPair(
      { en: attrs['data-en-ph'], zh: attrs['data-zh-ph'] },
      { path: `${path} placeholder`, maxChars: UI_LABEL_LIMITS.placeholder, markup: false },
    ));
  }
  if ('data-aria-en' in attrs || 'data-aria-zh' in attrs) {
    issues.push(...validateBilingualPair(
      { en: attrs['data-aria-en'], zh: attrs['data-aria-zh'] },
      { path: `${path} aria-label`, maxChars: UI_LABEL_LIMITS.ariaLabel, markup: false },
    ));
  }
  if ('aria-label' in attrs
      && !('data-aria-en' in attrs)
      && !('data-aria-zh' in attrs)
      && !('data-i18n-static-aria' in attrs)) {
    issues.push({
      code: 'MISSING_ARIA_LOCALE_PAIR',
      path: `${path} aria-label`,
      message: 'static aria-label requires data-aria-en/data-aria-zh or an explicit data-i18n-static-aria exemption',
    });
  }
  return issues;
}

function scriptKind(file) {
  return extname(file) === '.ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
}

function propertyName(node, sourceFile) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  if (ts.isComputedPropertyName(node) && ts.isStringLiteral(node.expression)) return node.expression.text;
  const text = node.getText(sourceFile);
  return /^['"][^'"]+['"]$/.test(text) ? text.slice(1, -1) : null;
}

function templateValue(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  let value = node.head.text;
  for (const span of node.templateSpans) {
    value += `[[dynamic]]${span.literal.text}`;
  }
  return value;
}

function staticValue(node, sourceFile) {
  if (!node) return DYNAMIC;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return templateValue(node);
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isParenthesizedExpression(node)) return staticValue(node.expression, sourceFile);
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => staticValue(element, sourceFile));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const object = {};
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) continue;
      if (ts.isShorthandPropertyAssignment(property)) {
        object[property.name.text] = DYNAMIC;
        continue;
      }
      if (!ts.isPropertyAssignment(property)) continue;
      const key = propertyName(property.name, sourceFile);
      if (key != null) object[key] = staticValue(property.initializer, sourceFile);
    }
    return object;
  }
  return DYNAMIC;
}

function sanitizeDynamic(value) {
  if (value === DYNAMIC) return '__AFFLATUS_DYNAMIC__';
  if (Array.isArray(value)) return value.map(sanitizeDynamic);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeDynamic(child)]));
  }
  return value;
}

export function lintScriptSource(source, file = resolve(ROOT, 'inline.js'), lineOffset = 0) {
  const sourceFile = ts.createSourceFile(
    displayPath(file),
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file),
  );
  const issues = [];
  const allowOrphanLocales = source.includes('afflatus-i18n allow-monolingual');
  function visit(node) {
    const conditionalFragment = ts.isObjectLiteralExpression(node) && (
      ts.isConditionalExpression(node.parent) ||
      ts.isSpreadAssignment(node.parent) ||
      ts.isConditionalExpression(node.parent?.parent)
    );
    if (ts.isObjectLiteralExpression(node) && !conditionalFragment) {
      const value = sanitizeDynamic(staticValue(node, sourceFile));
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      issues.push(...validateBilingualTree(value, {
        path: linePath(file, position.line + 1 + lineOffset, 'object'),
        recurse: false,
        allowEmptyPair: true,
        allowOrphanLocales,
      }));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return issues;
}

export function lintHtmlSource(source, file = resolve(ROOT, 'fixture.html')) {
  const document = parse(source, { sourceCodeLocationInfo: true });
  const issues = [];
  function visit(node) {
    issues.push(...htmlPairIssues(node, file));
    if (node.tagName === 'script') {
      const attrs = attributes(node);
      const isExecutable = !attrs.src && attrs.type !== 'application/ld+json';
      if (isExecutable) {
        const script = (node.childNodes || [])
          .filter((child) => child.nodeName === '#text')
          .map((child) => child.value)
          .join('');
        if (script.trim()) {
          issues.push(...lintScriptSource(
            script,
            file,
            (node.sourceCodeLocation?.startLine || 1) - 1,
          ));
        }
      }
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(document);
  return issues;
}

export function lintJsonSource(source, file = resolve(ROOT, 'fixture.json')) {
  try {
    return validateBilingualTree(JSON.parse(source), {
      path: displayPath(file),
      allowEmptyPair: true,
    });
  } catch (error) {
    return [{
      code: 'INVALID_JSON',
      path: displayPath(file),
      message: error instanceof Error ? error.message : String(error),
    }];
  }
}

function uniqueIssues(issues) {
  const seen = new Set();
  return issues.filter((item) => {
    const key = `${item.code}|${item.path}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => (
    left.path.localeCompare(right.path) || left.code.localeCompare(right.code)
  ));
}

export function lintBilingualRepository(root = ROOT) {
  const issues = [];
  const htmlFiles = walkFiles(root, (path) => (
    extname(path) === '.html' && !path.includes('/public/')
  ));
  for (const file of htmlFiles) issues.push(...lintHtmlSource(readFileSync(file, 'utf8'), file));

  const sourceFiles = walkFiles(resolve(root, 'src'), (path) => SOURCE_EXTENSIONS.has(extname(path)));
  for (const file of sourceFiles) issues.push(...lintScriptSource(readFileSync(file, 'utf8'), file));

  const jsonFiles = walkFiles(resolve(root, 'public'), (path) => (
    extname(path) === '.json' && !SKIP_JSON.has(displayPath(path))
  ));
  for (const file of jsonFiles) issues.push(...lintJsonSource(readFileSync(file, 'utf8'), file));
  return uniqueIssues(issues);
}

function formatIssue(item) {
  return `- ${item.path} [${item.code}] ${item.message}`;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const issues = lintBilingualRepository(ROOT);
  if (issues.length) {
    console.error(`FAIL: bilingual content lint found ${issues.length} issue(s).\n${issues.map(formatIssue).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('OK: bilingual content parity, tokens, markup, links, punctuation, glossary, and UI limits');
  }
}
