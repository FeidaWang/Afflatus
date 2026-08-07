#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const CSS_PATH = 'src/styles.css';
const root = postcss.parse(readFileSync(CSS_PATH, 'utf8'), { from: CSS_PATH });
const failures = [];

const fail = (message) => failures.push(message);
const layerOrder = root.nodes.find(
  (node) => node.type === 'atrule' && node.name === 'layer' && !node.nodes,
);
if (layerOrder?.params.replaceAll(/\s+/g, '') !== 'legacy,tokens,components,overrides') {
  fail('cascade layer order must remain legacy, tokens, components, overrides');
}

const layers = new Map();
root.walkAtRules('layer', (layer) => {
  if (layer.nodes) layers.set(layer.params.trim(), layer);
});
for (const name of ['legacy', 'tokens', 'components', 'overrides']) {
  if (!layers.has(name)) fail(`missing @layer ${name}`);
}

const migratedFamilies = [
  {
    name: 'home brand lockup',
    selector: /\.brand(?:\b|-)/,
    container: 'home-nav',
    requiredQueries: [
      'max-width: 39.999rem',
      'min-width: 40rem',
      'max-width: 71.999rem',
      'max-width: 22rem',
    ],
  },
  {
    name: 'home primary navigation links',
    selector: /\.nav-links\b/,
    container: 'home-nav',
    requiredQueries: [
      'max-width: 39.999rem',
      'min-width: 40rem',
      'max-width: 71.999rem',
      'max-width: 22rem',
    ],
  },
];

for (const family of migratedFamilies) {
  const legacyRules = [];
  const componentRules = [];
  const importantDeclarations = [];

  layers.get('legacy')?.walkRules((rule) => {
    if (family.selector.test(rule.selector)) legacyRules.push(rule.selector);
  });
  layers.get('components')?.walkRules((rule) => {
    if (!family.selector.test(rule.selector)) return;
    componentRules.push(rule.selector);
    rule.walkDecls((declaration) => {
      if (declaration.important) {
        importantDeclarations.push(
          `${rule.selector} { ${declaration.prop}: ${declaration.value} }`,
        );
      }
    });
  });

  if (legacyRules.length) {
    fail(`${family.name}: ${legacyRules.length} selector(s) remain in @layer legacy`);
  }
  if (!componentRules.length) {
    fail(`${family.name}: missing canonical rules in @layer components`);
  }
  if (importantDeclarations.length) {
    fail(`${family.name}: migrated declarations must not use !important`);
  }

  const queries = [];
  layers.get('components')?.walkAtRules('container', (query) => {
    if (query.params.startsWith(`${family.container} `)) queries.push(query.params);
  });
  for (const expected of family.requiredQueries) {
    if (!queries.some((query) => query.includes(expected))) {
      fail(`${family.name}: missing container band ${expected}`);
    }
  }
}

const tokens = new Set();
layers.get('tokens')?.walkDecls((declaration) => {
  if (declaration.prop.startsWith('--')) tokens.add(declaration.prop);
});
for (const token of [
  '--layout-band-compact-max',
  '--layout-band-medium-max',
  '--brand-ink',
  '--brand-data',
  '--nav-link-ink',
  '--nav-link-active',
]) {
  if (!tokens.has(token)) fail(`missing CSS architecture token ${token}`);
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(
  `OK: CSS architecture (${migratedFamilies.length} migrated families, 3 layout bands + narrow guard)`,
);
