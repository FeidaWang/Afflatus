#!/usr/bin/env node
/**
 * Patch only the audited Arena metadata and JSON-LD seam in an Afflatus checkout.
 *
 *   node scripts/patch-host-metadata.mjs --target /absolute/path/Afflatus
 *   node scripts/patch-host-metadata.mjs --target /absolute/path/Afflatus --apply
 *
 * Dry-run is the default. No social images or social subtitle configuration change.
 * Rollback: restore the two source files from
 * integrations/arena-fsi-install-backup/metadata/{src/config/siteManifest.js,scripts/route-seo.mjs},
 * then run `node scripts/site-manifest.mjs --write` in the target checkout.
 */
import { readFile, writeFile, mkdir, access, rm } from 'node:fs/promises';
import { resolve, join, dirname, isAbsolute, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const SOURCE_PATHS = ['src/config/siteManifest.js', 'scripts/route-seo.mjs'];
const BACKUP_PATH = 'integrations/arena-fsi-install-backup/metadata';
const ALLOWED_GENERATED_CHANGES = new Set(['arena.html', 'src/config/navRoutes.generated.js']);
const AUDITED_GRAPH_HASH = '14daa919cca5100193abdd3b7391e6850c8495ffcbfd4fa154bf8105184ca670';
const AUDITED_GENERATOR_HASH = '19db2a1d5bb7c83315bc0b3134aae333fad025499552181562580394c12f0781';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const OLD_ARENA_METADATA = `    metadata: {
      title: "Stock observation & investment simulation · AFFLATUS",
      description: "Explore stock charts, technical analysis and investment simulations using historical data. Simulated results are not account returns or investment advice.",
      canonical: 'https://feida.au/arena.html',
      ogTitle: "Stock observation & investment simulation · AFFLATUS",
      ogDescription: "Explore stock charts, technical analysis and investment simulations using historical data. Simulated results are not account returns or investment advice.",
      ogImage: ROUTE_SEO.arena.social.images.en,
    },
    locales: {
      en: {"title": "Stock observation & investment simulation · AFFLATUS", "description": "Explore stock charts, technical analysis and investment simulations using historical data. Simulated results are not account returns or investment advice."},
      zh: {"title": "股票观察与模拟投资 · AFFLATUS", "description": "查看股票图表、技术分析，并用历史数据测试模拟投资。模拟结果并非真实账户收益，非投资建议。"},
    },`;

const NEW_ARENA_METADATA = `    metadata: {
      title: "Stock research & AI paper trading · AFFLATUS",
      description: "Provider quotes when configured; frozen snapshots, AI analysis and review, risk checks, and auditable paper trades. QF-01 is a legacy archive.",
      canonical: 'https://feida.au/arena.html',
      ogTitle: "Stock research & AI paper trading · AFFLATUS",
      ogDescription: "Provider quotes when configured; frozen snapshots, AI analysis and review, risk checks, and auditable paper trades. QF-01 is a legacy archive.",
      ogImage: ROUTE_SEO.arena.social.images.en,
    },
    locales: {
      en: {"title": "Stock research & AI paper trading · AFFLATUS", "description": "Provider quotes when configured; frozen snapshots, AI analysis and review, risk checks, and auditable paper trades. QF-01 is a legacy archive."},
      zh: {"title": "股票研究与 AI 模拟交易 · AFFLATUS", "description": "按配置展示带来源与时间的真实行情，以冻结快照开展 AI 分析、复核与风控，并记录可审计的模拟交易；QF-01 数据保留为历史档案。"},
    },`;

const OLD_HOME_LABEL = "    { routeId: 'arena', label: { en: 'QF-01 Quant Foundry', zh: 'QF-01 量化铸造舱' } },";
const NEW_HOME_LABEL = "    { routeId: 'arena', label: { en: 'Stock research & AI paper trading', zh: '股票研究与 AI 模拟交易' } },";

// This complete function is the only replaced region in scripts/route-seo.mjs.
const NEW_ARENA_GRAPH = `function buildArenaGraph(route, locale, facts, url) {
  // arena-fsi-metadata:v1 — the downloadable QF-01 dataset remains a legacy archive.
  const key = localeKey(route, locale);
  const datasetId = url + '#dataset';
  const appId = url + '#application';
  const methodologyId = url + '#methodology';
  const dataset = {
    '@type': 'Dataset',
    '@id': datasetId,
    name: key === 'zh' ? 'QF-01 历史模拟档案' : 'QF-01 legacy simulation archive',
    description:
      key === 'zh'
        ? '归档的 QF-01 模型清单、历史模拟运行日志、预测日志与股票池。下载文件仅描述旧系统，不代表当前竞技场模拟账本、当前行情或当前 AI 运行结果。'
        : 'Archived QF-01 model manifests, historical simulation run logs, prediction logs and equity-universe files. These downloads describe the legacy system, not the active Arena paper ledger, current quotes or current AI runs.',
    url,
    inLanguage: languageValue(route, locale),
    creator: { '@id': PROFILE_ID },
    measurementTechnique: [
      'archived rule-constrained model simulation',
      'archived benchmark-relative return tracking',
      'archived costed walk-forward factor simulation',
    ],
    variableMeasured: [
      'historical model prediction',
      'historical simulated position',
      'historical simulated return',
      'historical benchmark return',
      'historical factor score',
      'historical constrained portfolio weight',
    ],
    distribution: [
      datasetDistribution('Legacy archive: Arena run log', '/arena-runlog.json'),
      datasetDistribution('Legacy archive: Arena prediction log', '/arena-predlog.json'),
      datasetDistribution('Legacy archive: Arena equity universe', '/arena-universe.json'),
      datasetDistribution('Legacy archive: QF-01 model manifest', '/arena-quant-model.json'),
    ],
    ...(facts.dateModified ? { dateModified: facts.dateModified } : {}),
  };
  const app = {
    '@type': 'WebApplication',
    '@id': appId,
    name: route.locales[key].title,
    description: route.locales[key].description,
    url,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    inLanguage: languageValue(route, locale),
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'AUD' },
    featureList: [
      'Frozen evidence snapshots with sources and timestamps',
      'AI analyst and critic review when configured',
      'Deterministic portfolio risk checks',
      'Separate auditable USD paper ledgers with fees and slippage',
      'Provider quote quality labels and isolated synthetic demos',
    ],
    mainEntity: { '@id': methodologyId },
  };
  const methodology = {
    '@type': 'Article',
    '@id': methodologyId,
    headline:
      key === 'zh' ? '竞技场研究、复核与模拟执行方法' : 'Arena research, review and paper execution methodology',
    description:
      key === 'zh'
        ? '当前流程冻结带来源与时间的证据，经 AI 分析与复核后，重新核验成交报价与确定性组合约束，并在独立可审计账本中记录包含费用与滑点的模拟订单。真实行情与 AI 运行取决于服务器配置和数据授权；演示数据明确标记并隔离。QF-01 下载文件仅作为历史档案保留。'
        : 'The current workflow freezes evidence with sources and timestamps, runs analyst and critic reviews, validates new execution quotes and deterministic portfolio limits, and records paper orders with fees and slippage in separate auditable ledgers. Provider quotes and AI runs depend on server configuration and data entitlements; synthetic demos are labeled and isolated. QF-01 downloads remain a legacy archive.',
    url,
    inLanguage: languageValue(route, locale),
    author: { '@id': PROFILE_ID },
    publisher: { '@id': PROFILE_ID },
    about: { '@id': appId },
    isPartOf: { '@id': url + '#webpage' },
  };
  // Legacy data timestamps describe the archive, not the new application's update date.
  const page = basePageNode(route, locale, {}, url);
  page.mainEntity = { '@id': appId };
  page.hasPart = [{ '@id': methodologyId }, { '@id': datasetId }];
  return [
    personNode(),
    websiteNode(languageValue(route, locale)),
    imageNode(route, locale, url),
    page,
    app,
    methodology,
    dataset,
    breadcrumbNode(route, locale, url),
  ];
}
`;

function occurrences(text, anchor) {
  return text.split(anchor).length - 1;
}

function replaceAudited(text, before, after, label) {
  const oldCount = occurrences(text, before);
  const newCount = occurrences(text, after);
  if (oldCount === 1 && newCount === 0) return { text: text.replace(before, after), state: 'pending' };
  if (oldCount === 0 && newCount === 1) return { text, state: 'applied' };
  throw new Error(`${label}: audited text anchor changed or is ambiguous. Review the host source; nothing was applied.`);
}

function parseArguments() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node scripts/patch-host-metadata.mjs --target /absolute/path/Afflatus [--apply]\nDefault: inspect exact source anchors and print the plan.\nRollback: restore the two source files from integrations/arena-fsi-install-backup/metadata, then run node scripts/site-manifest.mjs --write in the host.');
    process.exit(0);
  }
  let target;
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--apply' && !apply) { apply = true; continue; }
    if (args[index] === '--target' && target === undefined && args[index + 1] && !args[index + 1].startsWith('--')) {
      target = args[++index];
      continue;
    }
    throw new Error(`Unexpected or incomplete argument: ${args[index]}`);
  }
  if (!target || !isAbsolute(target)) throw new Error('Provide --target with the absolute path to the existing Afflatus checkout.');
  return { target: resolve(target), apply };
}

async function runNode(target, args, { input } = {}) {
  return new Promise((succeed, fail) => {
    const child = spawn(process.execPath, args, { cwd: target, env: process.env, stdio: input === undefined ? 'inherit' : ['pipe', 'pipe', 'pipe'] });
    let diagnostic = '';
    if (input !== undefined) {
      child.stdout.on('data', (value) => { diagnostic += value; });
      child.stderr.on('data', (value) => { diagnostic += value; });
      child.stdin.end(input);
    }
    child.on('error', fail);
    child.on('close', (code) => code === 0 ? succeed() : fail(new Error(`node ${args.join(' ')} exited ${code}${diagnostic ? `\n${diagnostic}` : ''}`)));
  });
}

async function readOptional(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function safeHostPath(target, path) {
  const destination = resolve(target, path);
  const location = relative(target, destination);
  if (location.startsWith('..') || isAbsolute(location)) throw new Error(`Generated path escapes the checkout: ${path}`);
  return destination;
}

async function restoreFiles(target, files) {
  for (const [path, content] of files) {
    const destination = safeHostPath(target, path);
    if (content === null) await rm(destination, { force: true });
    else await writeFile(destination, content);
  }
}

async function main() {
  const { target, apply } = parseArguments();
  const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  if (pkg.name !== 'project-afflatus') throw new Error('The target is not the audited project-afflatus host.');
  const [manifest, seo, generator] = await Promise.all([
    readFile(join(target, SOURCE_PATHS[0]), 'utf8'),
    readFile(join(target, SOURCE_PATHS[1]), 'utf8'),
    readFile(join(target, 'scripts/site-manifest.mjs'), 'utf8'),
  ]);
  if (sha256(generator) !== AUDITED_GENERATOR_HASH) throw new Error('The host manifest generator changed. Review its output ownership before applying this patch.');

  const routeStart = "  {\n    id: 'arena',\n    file: 'arena.html',\n    path: '/arena.html',";
  const routeEnd = "\n  },\n  {\n    id: 'sectors',";
  if (occurrences(manifest, routeStart) !== 1 || occurrences(manifest, routeEnd) !== 1) throw new Error('The audited Arena route boundaries changed.');
  const start = manifest.indexOf(routeStart);
  const end = manifest.indexOf(routeEnd, start);
  if (end <= start) throw new Error('The audited Arena route order changed.');
  const arena = replaceAudited(manifest.slice(start, end), OLD_ARENA_METADATA, NEW_ARENA_METADATA, 'Arena metadata/locales');
  const manifestWithMetadata = manifest.slice(0, start) + arena.text + manifest.slice(end);
  const homeBoundary = 'export const HOME_NAV_GROUPS = Object.freeze([';
  if (occurrences(manifestWithMetadata, homeBoundary) !== 1) throw new Error('The homepage navigation boundary changed.');
  const homeStart = manifestWithMetadata.indexOf(homeBoundary);
  const home = replaceAudited(manifestWithMetadata.slice(homeStart), OLD_HOME_LABEL, NEW_HOME_LABEL, 'Arena homepage navigation label');
  const changedManifest = manifestWithMetadata.slice(0, homeStart) + home.text;

  const graphStart = 'function buildArenaGraph(route, locale, facts, url) {';
  const graphEnd = '\nfunction buildSectorsGraph(route, locale, facts, url) {';
  if (occurrences(seo, graphStart) !== 1 || occurrences(seo, graphEnd) !== 1) throw new Error('The audited JSON-LD builder boundaries changed.');
  const from = seo.indexOf(graphStart);
  const to = seo.indexOf(graphEnd, from);
  if (to <= from) throw new Error('The JSON-LD builder order changed.');
  const oldGraph = seo.slice(from, to);
  const graphHash = sha256(oldGraph);
  const graphState = graphHash === AUDITED_GRAPH_HASH ? 'pending' : oldGraph === NEW_ARENA_GRAPH ? 'applied' : null;
  if (!graphState) throw new Error('buildArenaGraph differs from the audited original and this patch. Review it before continuing.');
  const changedSeo = seo.slice(0, from) + NEW_ARENA_GRAPH + seo.slice(to);
  const states = [arena.state, home.state, graphState];
  if (new Set(states).size !== 1) throw new Error('A partial metadata patch is present. Inspect the metadata backup and restore both source files before retrying.');
  const alreadyApplied = states[0] === 'applied';
  const nextSources = new Map([[SOURCE_PATHS[0], changedManifest], [SOURCE_PATHS[1], changedSeo]]);
  await Promise.all([...nextSources.values()].map((source) => runNode(target, ['--check', '--input-type=module'], { input: source })));

  const plan = {
    patch: 'arena-fsi-metadata:v1', target, apply, alreadyApplied,
    sourceChanges: [
      { path: SOURCE_PATHS[0], regions: ['Arena metadata/locales', 'HOME_NAV_GROUPS Arena label'], beforeSha256: sha256(manifest), afterSha256: sha256(changedManifest) },
      { path: SOURCE_PATHS[1], regions: ['buildArenaGraph only'], beforeSha256: sha256(seo), afterSha256: sha256(changedSeo) },
    ],
    generatedAllowlist: [...ALLOWED_GENERATED_CHANGES],
    generator: 'node scripts/site-manifest.mjs --write',
    backup: BACKUP_PATH,
    preservedLegacyDownloads: ['/arena-runlog.json', '/arena-predlog.json', '/arena-universe.json', '/arena-quant-model.json'],
    preserved: ['social image paths', 'social subtitle configuration', 'other routes and page content'],
    rollback: 'Restore src/config/siteManifest.js and scripts/route-seo.mjs from the metadata backup to their original host paths, then run node scripts/site-manifest.mjs --write in the host.',
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!apply) return;
  // A clean generator baseline prevents this narrowly scoped patch from repairing unrelated drift.
  await runNode(target, ['scripts/site-manifest.mjs', '--check']);
  if (alreadyApplied) { console.log('Arena metadata is already applied and generated artifacts are consistent.'); return; }

  const backupRoot = join(target, BACKUP_PATH);
  try { await access(backupRoot); throw new Error('The metadata backup already exists. Inspect its receipt before retrying; backups are never overwritten.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const generatedPaths = [...new Set([
    ...[...manifest.matchAll(/^    file: '([^']+)',/gm)].map((match) => match[1]),
    'public/sitemap.xml', 'src/config/navRoutes.generated.js', 'src/config/publishedBooks.generated.js',
    'src/config/performanceRoutes.generated.js', 'src/config/lighthouseRoutes.generated.json',
  ])];
  const beforeGenerated = new Map(await Promise.all(generatedPaths.map(async (path) => [path, await readOptional(safeHostPath(target, path))])));
  const originalSources = new Map([[SOURCE_PATHS[0], Buffer.from(manifest)], [SOURCE_PATHS[1], Buffer.from(seo)]]);
  for (const [path, original] of originalSources) {
    if (!(await readFile(join(target, path))).equals(original)) throw new Error(`Source changed during preflight: ${path}`);
  }
  await mkdir(dirname(backupRoot), { recursive: true });
  await mkdir(backupRoot);
  for (const [path, content] of originalSources) {
    const destination = join(backupRoot, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content, { flag: 'wx' });
  }
  const receiptPath = join(backupRoot, 'receipt.json');
  const receipt = { ...plan, createdAt: new Date().toISOString(), status: 'prepared' };
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  try {
    for (const [path, content] of nextSources) await writeFile(join(target, path), content);
    await runNode(target, ['scripts/site-manifest.mjs', '--write']);
    const changedGenerated = [];
    for (const [path, original] of beforeGenerated) {
      const current = await readOptional(safeHostPath(target, path));
      const unchanged = original === null ? current === null : current !== null && current.equals(original);
      if (!unchanged) {
        if (!ALLOWED_GENERATED_CHANGES.has(path)) throw new Error(`Generator attempted an unrelated content change: ${path}`);
        changedGenerated.push({ path, beforeSha256: original === null ? null : sha256(original), afterSha256: current === null ? null : sha256(current) });
      }
    }
    await runNode(target, ['scripts/site-manifest.mjs', '--check']);
    await writeFile(receiptPath, JSON.stringify({ ...receipt, status: 'applied', completedAt: new Date().toISOString(), generatedChanges: changedGenerated }, null, 2) + '\n');
    console.log(JSON.stringify({ applied: true, sourceFiles: SOURCE_PATHS, generatedChanges: changedGenerated.map((entry) => entry.path), backup: BACKUP_PATH, rollback: plan.rollback }, null, 2));
  } catch (error) {
    try {
      await restoreFiles(target, originalSources);
      await restoreFiles(target, beforeGenerated);
      await writeFile(receiptPath, JSON.stringify({ ...receipt, status: 'rolled-back', failedAt: new Date().toISOString(), error: error.message }, null, 2) + '\n');
    } catch (rollbackError) {
      throw new Error(`Metadata generation failed (${error.message}); automatic restoration also failed (${rollbackError.message}). Restore the saved source files and regenerate using the receipt instructions.`);
    }
    throw new Error(`Metadata patch was rolled back: ${error.message}`);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
