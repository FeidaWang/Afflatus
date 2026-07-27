#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';
import {
  SITE_LOCALES,
  SITE_MANIFEST,
  SOCIAL_CARD,
  localizedRouteUrl,
} from '../src/config/siteManifest.js';
import {
  readerPath,
  readerUrl,
} from '../src/lib/serialRoutes.js';
import {
  buildRouteStructuredData,
  loadRouteSeoFacts,
  validateRouteStructuredData,
} from './route-seo.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const flagIndex = process.argv.indexOf('--out-dir');
const outputRoot = path.resolve(ROOT, flagIndex >= 0 ? process.argv[flagIndex + 1] : 'dist');
const activeRoutes = SITE_MANIFEST.filter((route) => route.status === 'active');
const facts = await loadRouteSeoFacts(ROOT, activeRoutes);
const failures = [];
const uniqueness = new Map();

const fail = (file, message) => failures.push(`${file}: ${message}`);

const walk = (node, visit) => {
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
  if (node.content) walk(node.content, visit);
};

const all = (document, predicate) => {
  const matches = [];
  walk(document, (node) => {
    if (predicate(node)) matches.push(node);
  });
  return matches;
};

const attr = (node, name) =>
  node.attrs?.find((entry) => entry.name === name)?.value ?? null;

const textContent = (node) =>
  (node.childNodes || [])
    .map((child) => (child.nodeName === '#text' ? child.value : textContent(child)))
    .join('');

const one = (file, document, predicate, label) => {
  const matches = all(document, predicate);
  if (matches.length !== 1) {
    fail(file, `expected one ${label}, found ${matches.length}`);
  }
  return matches[0] || null;
};

const meta = (file, document, selector) => {
  const [attribute, value] = selector;
  const node = one(
    file,
    document,
    (candidate) =>
      candidate.tagName === 'meta' && attr(candidate, attribute) === value,
    `<meta ${attribute}="${value}">`,
  );
  return attr(node, 'content');
};

const expectedDocument = (route, locale) => {
  if (locale === 'adaptive') {
    return {
      canonical: route.metadata.canonical,
      title: route.metadata.title,
      description: route.metadata.description,
      ogTitle: route.metadata.ogTitle,
      ogDescription: route.metadata.ogDescription,
      image: route.metadata.ogImage,
      imageAlt: route.seo.social.alt[route.defaultLocale],
      htmlLang: route.defaultLocale === 'zh' ? 'zh-CN' : 'en',
    };
  }
  return {
    canonical: localizedRouteUrl(route, locale),
    title: route.locales[locale].title,
    description: route.locales[locale].description,
    ogTitle: route.locales[locale].title,
    ogDescription: route.locales[locale].description,
    image: route.seo.social.images[locale],
    imageAlt: route.seo.social.alt[locale],
    htmlLang: locale === 'zh' ? 'zh-CN' : 'en',
  };
};

const relativeDocumentPath = (route, locale) => {
  if (locale === 'adaptive') return route.file;
  return route.path === '/' ? `${locale}/index.html` : `${locale}/${route.file}`;
};

for (const route of activeRoutes) {
  for (const locale of ['adaptive', ...SITE_LOCALES]) {
    const relativePath = relativeDocumentPath(route, locale);
    const filePath = path.join(outputRoot, relativePath);
    if (!existsSync(filePath)) {
      fail(relativePath, 'missing emitted route document');
      continue;
    }
    const document = parse(readFileSync(filePath, 'utf8'));
    const expected = expectedDocument(route, locale);

    const html = one(relativePath, document, (node) => node.tagName === 'html', 'html');
    const titleNode = one(relativePath, document, (node) => node.tagName === 'title', 'title');
    const canonical = one(
      relativePath,
      document,
      (node) => node.tagName === 'link' && attr(node, 'rel') === 'canonical',
      'canonical link',
    );
    const h1s = all(document, (node) => node.tagName === 'h1');
    const alternates = all(
      document,
      (node) =>
        node.tagName === 'link'
        && attr(node, 'rel') === 'alternate'
        && attr(node, 'hreflang'),
    );
    const jsonScripts = all(
      document,
      (node) =>
        node.tagName === 'script'
        && attr(node, 'type') === 'application/ld+json',
    );

    const checks = [
      ['html lang', attr(html, 'lang'), expected.htmlLang],
      ['title', textContent(titleNode).trim(), expected.title],
      ['description', meta(relativePath, document, ['name', 'description']), expected.description],
      ['canonical', attr(canonical, 'href'), expected.canonical],
      ['og:title', meta(relativePath, document, ['property', 'og:title']), expected.ogTitle],
      ['og:description', meta(relativePath, document, ['property', 'og:description']), expected.ogDescription],
      ['og:url', meta(relativePath, document, ['property', 'og:url']), expected.canonical],
      ['og:image', meta(relativePath, document, ['property', 'og:image']), expected.image],
      ['og:image:secure_url', meta(relativePath, document, ['property', 'og:image:secure_url']), expected.image],
      ['og:image:type', meta(relativePath, document, ['property', 'og:image:type']), SOCIAL_CARD.format],
      ['og:image:width', meta(relativePath, document, ['property', 'og:image:width']), String(SOCIAL_CARD.width)],
      ['og:image:height', meta(relativePath, document, ['property', 'og:image:height']), String(SOCIAL_CARD.height)],
      ['og:image:alt', meta(relativePath, document, ['property', 'og:image:alt']), expected.imageAlt],
      ['twitter:card', meta(relativePath, document, ['name', 'twitter:card']), 'summary_large_image'],
      ['twitter:image', meta(relativePath, document, ['name', 'twitter:image']), expected.image],
      ['twitter:image:alt', meta(relativePath, document, ['name', 'twitter:image:alt']), expected.imageAlt],
    ];
    for (const [label, actual, expectedValue] of checks) {
      if (actual !== expectedValue) {
        fail(relativePath, `${label} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expectedValue)}`);
      }
    }

    if (h1s.length !== 1) fail(relativePath, `expected one h1, found ${h1s.length}`);
    if (alternates.length !== 3) {
      fail(relativePath, `expected three hreflang alternates, found ${alternates.length}`);
    }
    if (jsonScripts.length !== 1) {
      fail(relativePath, `expected one JSON-LD graph, found ${jsonScripts.length}`);
    } else {
      try {
        const actualGraph = JSON.parse(textContent(jsonScripts[0]));
        const expectedGraph = buildRouteStructuredData(route, {
          locale,
          facts: facts[route.id],
        });
        for (const message of validateRouteStructuredData(route, actualGraph)) {
          fail(relativePath, message);
        }
        if (JSON.stringify(actualGraph) !== JSON.stringify(expectedGraph)) {
          fail(relativePath, 'JSON-LD graph differs from the site manifest projection');
        }
      } catch (error) {
        fail(relativePath, `invalid JSON-LD: ${error.message}`);
      }
    }

    const group = uniqueness.get(locale) || { titles: new Map(), descriptions: new Map() };
    for (const [kind, value] of [
      ['titles', expected.title],
      ['descriptions', expected.description],
    ]) {
      const previous = group[kind].get(value);
      if (previous) fail(relativePath, `${kind.slice(0, -1)} duplicates ${previous}`);
      else group[kind].set(value, relativePath);
    }
    uniqueness.set(locale, group);
  }
}

const novelsIndex = JSON.parse(
  readFileSync(path.join(ROOT, 'public/novels-index.json'), 'utf8'),
);
let novelDocumentCount = 0;

for (const indexedNovel of novelsIndex.novels || []) {
  const book = JSON.parse(
    readFileSync(
      path.join(ROOT, 'public/novels', `${indexedNovel.id}.json`),
      'utf8',
    ),
  );
  for (const locale of ['adaptive', ...SITE_LOCALES]) {
    for (const chapter of [null, ...(book.chapters || [])]) {
      const routeInput = {
        locale,
        bookId: indexedNovel.id,
        ...(chapter ? { chapterId: chapter.id } : {}),
      };
      const publicPath = readerPath(routeInput);
      const relativePath = path.join(
        publicPath.replace(/^\/+/, ''),
        'index.html',
      );
      const filePath = path.join(outputRoot, relativePath);
      novelDocumentCount += 1;
      if (!existsSync(filePath)) {
        fail(relativePath, 'missing emitted novel document');
        continue;
      }

      const document = parse(readFileSync(filePath, 'utf8'));
      const canonicalUrl = readerUrl(routeInput);
      const canonical = one(
        relativePath,
        document,
        (node) => node.tagName === 'link' && attr(node, 'rel') === 'canonical',
        'canonical link',
      );
      if (attr(canonical, 'href') !== canonicalUrl) {
        fail(
          relativePath,
          `canonical is ${JSON.stringify(attr(canonical, 'href'))}, expected ${JSON.stringify(canonicalUrl)}`,
        );
      }

      const alternates = all(
        document,
        (node) =>
          node.tagName === 'link'
          && attr(node, 'rel') === 'alternate'
          && attr(node, 'hreflang'),
      );
      const expectedAlternates = new Map([
        ['en', readerUrl({ ...routeInput, locale: 'en' })],
        ['zh-CN', readerUrl({ ...routeInput, locale: 'zh' })],
        ['x-default', readerUrl({ ...routeInput, locale: 'adaptive' })],
      ]);
      if (alternates.length !== expectedAlternates.size) {
        fail(
          relativePath,
          `expected ${expectedAlternates.size} hreflang alternates, found ${alternates.length}`,
        );
      }
      for (const alternate of alternates) {
        const hreflang = attr(alternate, 'hreflang');
        const expectedHref = expectedAlternates.get(hreflang);
        if (!expectedHref || attr(alternate, 'href') !== expectedHref) {
          fail(
            relativePath,
            `unexpected alternate ${JSON.stringify(hreflang)}=${JSON.stringify(attr(alternate, 'href'))}`,
          );
        }
      }

      const body = one(
        relativePath,
        document,
        (node) => node.tagName === 'body',
        'body',
      );
      const expectedReaderRoute = chapter ? 'chapter' : 'book';
      if (attr(body, 'data-reader-route') !== expectedReaderRoute) {
        fail(
          relativePath,
          `data-reader-route is ${JSON.stringify(attr(body, 'data-reader-route'))}, expected ${JSON.stringify(expectedReaderRoute)}`,
        );
      }

      const reader = one(
        relativePath,
        document,
        (node) => attr(node, 'id') === 'readerNormal',
        '#readerNormal',
      );
      if (attr(reader, 'data-prerendered') !== expectedReaderRoute) {
        fail(
          relativePath,
          `reader prerender marker is ${JSON.stringify(attr(reader, 'data-prerendered'))}, expected ${JSON.stringify(expectedReaderRoute)}`,
        );
      }

      const jsonScripts = all(
        document,
        (node) =>
          node.tagName === 'script'
          && attr(node, 'type') === 'application/ld+json',
      );
      if (jsonScripts.length !== 1) {
        fail(
          relativePath,
          `expected one novel JSON-LD graph, found ${jsonScripts.length}`,
        );
      } else {
        try {
          const graph = JSON.parse(textContent(jsonScripts[0]));
          const serialized = JSON.stringify(graph);
          if (!serialized.includes(canonicalUrl)) {
            fail(relativePath, 'novel JSON-LD does not contain its canonical URL');
          }
          if (serialized.includes('/novel/')) {
            fail(relativePath, 'novel JSON-LD uses the retired singular /novel/ route');
          }
          if (chapter && !serialized.includes(chapter.title)) {
            fail(relativePath, 'chapter JSON-LD does not contain the chapter title');
          }
        } catch (error) {
          fail(relativePath, `invalid novel JSON-LD: ${error.message}`);
        }
      }
    }
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(
  `OK: emitted SEO (${activeRoutes.length * 3} route documents + ${novelDocumentCount} novel documents, adaptive + EN/ZH)`,
);
