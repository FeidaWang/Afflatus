#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parse,
  parseFragment,
  serialize,
} from 'parse5';
import { COPY } from '../src/data/content.js';
import {
  NAV_ROUTES,
  SITE_LOCALES,
  SITE_MANIFEST,
  findRouteByPath,
  localizedRoutePath,
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

const ROOT = resolve(import.meta.dirname, '..');
const ACTIVE_ROUTES = SITE_MANIFEST.filter((route) => route.status === 'active');
const ROUTE_SEO_FACTS = await loadRouteSeoFacts(ROOT, ACTIVE_ROUTES);
const HTML_LANG = Object.freeze({ en: 'en', zh: 'zh-CN' });
const HOME_HTML_FIELDS = Object.freeze({
  heroNum: 'heroNum',
  heroTitle: 'heroTitle',
  s2num: 's2num',
  s2title: 's2title',
  s3num: 's3num',
  s3title: 's3title',
});
const HOME_TEXT_FIELDS = Object.freeze({
  heroDesc: 'heroDesc',
  coord: 'coord',
  scrollHint: 'scrollHint',
  s2desc: 's2desc',
  chartSub: 'chartSub',
  s3desc: 's3desc',
  footnoteEl: 'footnote',
  f1: 'f1',
  f2: 'f2',
  f3: 'f3',
});

function attrs(node) {
  return Object.fromEntries((node.attrs || []).map((attr) => [attr.name, attr.value]));
}

function getAttr(node, name) {
  return node.attrs?.find((attr) => attr.name === name)?.value ?? null;
}

function setAttr(node, name, value) {
  if (!node.attrs) node.attrs = [];
  const existing = node.attrs.find((attr) => attr.name === name);
  if (existing) existing.value = String(value);
  else node.attrs.push({ name, value: String(value) });
}

function removeAttr(node, name) {
  if (node.attrs) node.attrs = node.attrs.filter((attr) => attr.name !== name);
}

function hasClass(node, className) {
  return (getAttr(node, 'class') || '').split(/\s+/).includes(className);
}

function walk(node, visitor) {
  visitor(node);
  for (const child of node.childNodes || []) walk(child, visitor);
}

function all(document, predicate) {
  const matches = [];
  walk(document, (node) => {
    if (predicate(node)) matches.push(node);
  });
  return matches;
}

function first(document, predicate) {
  let match = null;
  walk(document, (node) => {
    if (!match && predicate(node)) match = node;
  });
  return match;
}

function element(document, tagName, expected = {}) {
  return first(document, (node) => {
    if (node.tagName !== tagName) return false;
    const current = attrs(node);
    return Object.entries(expected).every(([key, value]) => current[key] === value);
  });
}

function textContent(node) {
  return (node.childNodes || []).map((child) => (
    child.nodeName === '#text' ? child.value : textContent(child)
  )).join('');
}

function setText(node, value) {
  node.childNodes = [{
    nodeName: '#text',
    value: String(value),
    parentNode: node,
  }];
}

function setHtml(node, markup) {
  const fragment = parseFragment(node, String(markup));
  node.childNodes = fragment.childNodes || [];
  for (const child of node.childNodes) child.parentNode = node;
}

function prependHtml(node, markup) {
  const fragment = parseFragment(node, String(markup));
  const incoming = fragment.childNodes || [];
  for (const child of incoming) child.parentNode = node;
  node.childNodes = [...incoming, ...(node.childNodes || [])];
}

function removeNode(node) {
  const parent = node.parentNode;
  if (!parent?.childNodes) return;
  parent.childNodes = parent.childNodes.filter((child) => child !== node);
}

function byId(document, id) {
  return first(document, (node) => getAttr(node, 'id') === id);
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeHtml(value) {
  return escapeAttribute(value).replaceAll("'", '&#39;');
}

function localizeDataAttributes(document, locale) {
  for (const node of all(document, (candidate) => candidate.tagName && getAttr(candidate, 'data-en') != null)) {
    const selected = getAttr(node, locale === 'zh' ? 'data-zh' : 'data-en') ?? getAttr(node, 'data-en');
    if (selected == null) continue;
    if (getAttr(node, 'data-i18n-html') != null) setHtml(node, selected);
    else setText(node, selected);
  }

  for (const node of all(document, (candidate) => candidate.tagName && getAttr(candidate, 'data-en-ph') != null)) {
    const selected = getAttr(node, locale === 'zh' ? 'data-zh-ph' : 'data-en-ph') ?? getAttr(node, 'data-en-ph');
    if (selected != null) setAttr(node, 'placeholder', selected);
  }

  for (const node of all(document, (candidate) => candidate.tagName && getAttr(candidate, 'data-aria-en') != null)) {
    const selected = getAttr(node, locale === 'zh' ? 'data-aria-zh' : 'data-aria-en') ?? getAttr(node, 'data-aria-en');
    if (selected != null) setAttr(node, 'aria-label', selected);
  }
}

function localizeHome(document, locale) {
  const copy = COPY[locale];
  for (const [id, key] of Object.entries(HOME_HTML_FIELDS)) {
    const node = byId(document, id);
    if (node) setHtml(node, copy[key]);
  }
  for (const [id, key] of Object.entries(HOME_TEXT_FIELDS)) {
    const node = byId(document, id);
    if (node) setText(node, copy[key]);
  }
  copy.sl.forEach((value, index) => {
    const node = byId(document, `sl${index}`);
    if (node) setText(node, value);
  });
  copy.sf.forEach((value, index) => {
    const node = byId(document, `sf${index}`);
    if (node) setText(node, value);
  });
}

function setMetaContent(document, selector, content) {
  const node = element(document, 'meta', selector);
  if (node) setAttr(node, 'content', content);
}

function setLinkHref(document, rel, href) {
  const node = element(document, 'link', { rel });
  if (node) setAttr(node, 'href', href);
}

function setDocumentMetadata(document, route, locale = null) {
  const head = element(document, 'head');
  const title = element(document, 'title');
  const metadataLocale = locale || (route.id === 'serial' ? 'zh' : null);
  const fixed = metadataLocale ? route.locales[metadataLocale] : null;
  const canonical = locale ? localizedRouteUrl(route, locale) : route.metadata.canonical;

  if (title && fixed) setText(title, fixed.title);
  if (fixed) {
    const social = route.seo.social;
    setMetaContent(document, { name: 'description' }, fixed.description);
    setMetaContent(document, { property: 'og:title' }, fixed.title);
    setMetaContent(document, { property: 'og:description' }, fixed.description);
    setMetaContent(document, { property: 'og:url' }, canonical);
    setMetaContent(document, { property: 'og:image' }, social.images[metadataLocale]);
    setMetaContent(document, { property: 'og:image:secure_url' }, social.images[metadataLocale]);
    setMetaContent(document, { property: 'og:image:alt' }, social.alt[metadataLocale]);
    setMetaContent(document, { name: 'twitter:title' }, fixed.title);
    setMetaContent(document, { name: 'twitter:description' }, fixed.description);
    setMetaContent(document, { name: 'twitter:image' }, social.images[metadataLocale]);
    setMetaContent(document, { name: 'twitter:image:alt' }, social.alt[metadataLocale]);
  }
  setLinkHref(document, 'canonical', canonical);

  for (const alternate of all(document, (node) => node.tagName === 'link' && getAttr(node, 'rel') === 'alternate' && getAttr(node, 'hreflang') != null)) {
    removeNode(alternate);
  }
  if (head) {
    const links = [
      ['en', localizedRouteUrl(route, 'en')],
      ['zh-CN', localizedRouteUrl(route, 'zh')],
      ['x-default', route.metadata.canonical],
    ].map(([hreflang, href]) => (
      `<link rel="alternate" hreflang="${hreflang}" href="${escapeAttribute(href)}">`
    )).join('');
    setHtmlFragmentAtEnd(head, links);
  }

  if (locale) {
    setMetaContent(document, { property: 'og:locale' }, locale === 'zh' ? 'zh_CN' : 'en_AU');
    setMetaContent(
      document,
      { property: 'og:locale:alternate' },
      locale === 'zh' ? 'en_AU' : 'zh_CN',
    );
  }
  setRouteJsonLd(document, route, locale || 'adaptive');
}

function makeSerialChineseOnly(document) {
  for (const node of all(document, (candidate) => (
    candidate.tagName === 'link'
    && getAttr(candidate, 'rel') === 'alternate'
    && getAttr(candidate, 'hreflang') === 'en'
  ))) {
    removeNode(node);
  }
  for (const node of all(document, (candidate) => (
    candidate.tagName === 'meta'
    && getAttr(candidate, 'property') === 'og:locale:alternate'
  ))) {
    removeNode(node);
  }
  for (const node of all(document, (candidate) => (
    hasClass(candidate, 'lang-toggle')
    || getAttr(candidate, 'id') === 'langBtn'
    || getAttr(candidate, 'id') === 'langMiniToggle'
  ))) {
    removeNode(node);
  }
}

function setHtmlFragmentAtEnd(node, markup) {
  const fragment = parseFragment(node, String(markup));
  const incoming = fragment.childNodes || [];
  for (const child of incoming) child.parentNode = node;
  node.childNodes = [...(node.childNodes || []), ...incoming];
}

function setRouteJsonLd(document, route, locale) {
  const head = element(document, 'head');
  if (!head) return;
  for (const script of all(document, (node) => (
    node.tagName === 'script'
    && getAttr(node, 'type') === 'application/ld+json'
  ))) {
    removeNode(script);
  }
  const graph = buildRouteStructuredData(route, {
    locale,
    facts: ROUTE_SEO_FACTS[route.id],
  });
  const errors = validateRouteStructuredData(route, graph);
  if (errors.length) {
    throw new Error(`${route.id}/${locale}: ${errors.join('; ')}`);
  }
  const language = locale === 'adaptive' ? HTML_LANG[route.defaultLocale] : HTML_LANG[locale];
  const json = JSON.stringify(graph).replaceAll('<', '\\u003c');
  setHtmlFragmentAtEnd(
    head,
    `<script type="application/ld+json" data-afflatus-route-schema="${route.id}" lang="${language}">${json}</script>`,
  );
}

function localizeInternalHref(value, locale) {
  if (!locale || typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return value;
  let url;
  try {
    url = new URL(value, 'https://feida.au');
  } catch {
    return value;
  }
  const route = findRouteByPath(url.pathname);
  if (!route || route.status !== 'active') return value;
  return `${localizedRoutePath(route, locale)}${url.search}${url.hash}`;
}

function localizeInternalNavigation(document, locale) {
  for (const node of all(document, (candidate) => candidate.tagName === 'a')) {
    const href = getAttr(node, 'href');
    if (href != null) setAttr(node, 'href', localizeInternalHref(href, locale));
  }
  for (const body of all(document, (candidate) => candidate.tagName === 'body')) {
    for (const name of ['data-prev', 'data-next']) {
      const value = getAttr(body, name);
      if (value != null) setAttr(body, name, localizeInternalHref(value, locale));
    }
  }
}

function injectStaticNavigation(document, route, locale) {
  const visibleLocale = locale || route.defaultLocale;
  for (const nav of all(document, (node) => getAttr(node, 'data-afflatus-nav') != null)) {
    for (const existing of all(nav, (node) => getAttr(node, 'data-afflatus-static-nav') != null)) removeNode(existing);
    const links = NAV_ROUTES
      .filter((item) => !(route.id === 'main' && item.id === 'main'))
      .map((item) => {
        const href = locale ? localizedRoutePath(item.path, locale) : item.path;
        const label = visibleLocale === 'zh' ? item.zh : item.en;
        const active = item.id === route.id ? ' class="active"' : '';
        return `<a${active} data-afflatus-static-nav href="${escapeAttribute(href)}">${escapeAttribute(label)}</a>`;
      })
      .join('');
    prependHtml(nav, links);
  }
}

function convertLanguageLinks(document, route, locale) {
  const visibleLocale = locale || route.defaultLocale;
  const nextLocale = visibleLocale === 'zh' ? 'en' : 'zh';
  const nextHref = localizedRoutePath(route, nextLocale);
  const candidates = all(document, (node) => (
    hasClass(node, 'lang-toggle')
    || getAttr(node, 'id') === 'langBtn'
    || getAttr(node, 'id') === 'langMiniToggle'
  ));

  for (const node of candidates) {
    node.nodeName = 'a';
    node.tagName = 'a';
    removeAttr(node, 'type');
    removeAttr(node, 'aria-pressed');
    setAttr(node, 'href', nextHref);
    setAttr(node, 'hreflang', nextLocale === 'zh' ? 'zh-CN' : 'en');
    setAttr(node, 'aria-label', nextLocale === 'zh' ? '切换到中文' : 'Switch to English');
    if (getAttr(node, 'id') === 'langBtn') setText(node, COPY[visibleLocale].langBtn);
    else if (getAttr(node, 'id') !== 'langMiniToggle') setText(node, nextLocale === 'zh' ? '中文' : 'EN');
  }
}

function removeAdaptivePrepaint(document) {
  for (const script of all(document, (node) => node.tagName === 'script')) {
    const source = textContent(script);
    if (source.includes('afflatus:locale:v1') && source.includes('document.documentElement.lang')) {
      removeNode(script);
    }
  }
}

function validateLocalizedDocument(document, route, locale) {
  const errors = [];
  const html = element(document, 'html');
  const canonical = element(document, 'link', { rel: 'canonical' });
  const h1s = all(document, (node) => node.tagName === 'h1');
  const alternates = all(document, (node) => node.tagName === 'link' && getAttr(node, 'rel') === 'alternate');
  const languageLinks = all(document, (node) => (
    hasClass(node, 'lang-toggle')
    || getAttr(node, 'id') === 'langBtn'
    || getAttr(node, 'id') === 'langMiniToggle'
  ));

  if (getAttr(html, 'lang') !== HTML_LANG[locale]) errors.push(`html lang is not ${HTML_LANG[locale]}`);
  if (getAttr(html, 'data-afflatus-locale') !== locale) errors.push('missing fixed locale marker');
  if (getAttr(canonical, 'href') !== localizedRouteUrl(route, locale)) errors.push('canonical is not self-referential');
  const chineseOnly = route.id === 'serial';
  const expectedAlternates = chineseOnly ? 2 : 3;
  if (alternates.length !== expectedAlternates) {
    errors.push(`expected ${expectedAlternates} hreflang links, found ${alternates.length}`);
  }
  if (h1s.length !== 1) errors.push(`expected one h1, found ${h1s.length}`);
  if (!chineseOnly && (!languageLinks.length || languageLinks.some((node) => node.tagName !== 'a' || !getAttr(node, 'href')))) {
    errors.push('language switch is not a crawlable link');
  }
  if (chineseOnly && languageLinks.length) errors.push('Chinese-only serial route still has a language switch');
  if (all(document, (node) => node.tagName === 'script' && textContent(node).includes('document.documentElement.lang') && textContent(node).includes('afflatus:locale:v1')).length) {
    errors.push('adaptive locale prepaint remains in fixed locale document');
  }
  return errors;
}

export function transformLocalizedDocument(source, route, locale) {
  if (!SITE_LOCALES.includes(locale)) throw new Error(`Unsupported locale: ${locale}`);
  const document = parse(source);
  const html = element(document, 'html');
  setAttr(html, 'lang', HTML_LANG[locale]);
  setAttr(html, 'data-afflatus-locale', locale);
  removeAdaptivePrepaint(document);
  localizeDataAttributes(document, locale);
  if (route.id === 'main') localizeHome(document, locale);
  localizeInternalNavigation(document, locale);
  injectStaticNavigation(document, route, locale);
  convertLanguageLinks(document, route, locale);
  setDocumentMetadata(document, route, locale);
  if (route.id === 'serial') makeSerialChineseOnly(document);

  const errors = validateLocalizedDocument(document, route, locale);
  if (errors.length) throw new Error(`${route.id}/${locale}: ${errors.join('; ')}`);
  return serialize(document);
}

export function transformAdaptiveDocument(source, route) {
  const document = parse(source);
  const html = element(document, 'html');
  setAttr(html, 'data-afflatus-locale', 'adaptive');
  injectStaticNavigation(document, route, null);
  convertLanguageLinks(document, route, null);
  setDocumentMetadata(document, route, null);
  if (route.id === 'serial') makeSerialChineseOnly(document);
  return serialize(document);
}

function loadNovelCatalog() {
  const index = JSON.parse(readFileSync(resolve(ROOT, 'public/novels-index.json'), 'utf8'));
  return (index.novels || []).map((entry) => {
    const book = JSON.parse(readFileSync(resolve(ROOT, `public/novels/${entry.id}.json`), 'utf8'));
    return { ...entry, chapters: book.chapters || [] };
  });
}

function novelLocale(locale) {
  return locale === 'en' || locale === 'zh' ? locale : 'adaptive';
}

function novelPageCopy(locale, entry, chapter = null) {
  if (chapter) {
    return locale === 'en'
      ? {
        title: `${chapter.title} — ${entry.novel.title} · Project Afflatus`,
        description: `Read ${chapter.title} from the original Chinese serialized novel ${entry.novel.title}.`,
      }
      : {
        title: `${chapter.title} — 《${entry.novel.title}》· Project Afflatus`,
        description: `原创中文连载《${entry.novel.title}》${chapter.title}，护眼阅读。`,
      };
  }
  return locale === 'en'
    ? {
      title: `${entry.novel.title} — Chinese Serialized Novel · Project Afflatus`,
      description: `${entry.novel.intro} Original Chinese serialized fiction.`,
    }
    : {
      title: `《${entry.novel.title}》— 原创中文连载 · Project Afflatus`,
      description: entry.novel.intro,
    };
}

function renderNovelBlocks(blocks) {
  return (blocks || []).map((block) => {
    if (block.type === 'sys') {
      let text = String(block.text || '');
      let heading = '幕间讯号';
      const match = text.match(/^【([^】]+)】\s*/);
      if (match) {
        heading = match[1];
        text = text.slice(match[0].length);
      }
      return `<div class="sys"><div class="sys-head"><i class="sys-dot" aria-hidden="true"></i><span>系统播报 ⟨ ${escapeHtml(heading)} ⟩</span><span class="sys-tag">同契终端 · 明幕</span></div><div class="sys-body">${escapeHtml(text)}</div></div>`;
    }
    return `<p>${escapeHtml(block.text || '')}</p>`;
  }).join('');
}

function removeLinksByRel(document, rel) {
  for (const link of all(document, (node) => node.tagName === 'link' && getAttr(node, 'rel') === rel)) {
    removeNode(link);
  }
}

function injectNovelShelf(document, catalog, locale) {
  const shelf = byId(document, 'shelf');
  if (!shelf) return;
  setHtml(shelf, catalog.map((entry) => (
    `<a class="book" href="${escapeAttribute(readerPath({
      locale: novelLocale(locale),
      bookId: entry.id,
    }))}"><span class="bk-badge">${locale === 'en' ? 'READING' : '正在阅读'}</span>`
    + `<h3>${escapeHtml(entry.novel.title)}</h3>`
    + `<p class="bk-sub">${escapeHtml(entry.novel.subtitle || '')}</p>`
    + `<p class="bk-meta">${locale === 'en' ? `${entry.chapters.length} chapters` : `共 ${entry.chapters.length} 章`} · ${escapeHtml(entry.novel.author || '')}</p></a>`
  )).join(''));
}

function setNovelAlternates(document, input) {
  const head = element(document, 'head');
  removeLinksByRel(document, 'alternate');
  if (!head) return;
  setHtmlFragmentAtEnd(head, [
    ['zh-CN', readerUrl({ ...input, locale: 'zh' })],
    ['x-default', readerUrl({ ...input, locale: 'adaptive' })],
  ].map(([hreflang, href]) => (
    `<link rel="alternate" hreflang="${hreflang}" href="${escapeAttribute(href)}">`
  )).join(''));
}

function setNovelJsonLd(document, entry, chapter, locale) {
  const bookUrl = readerUrl({ locale, bookId: entry.id });
  const graph = [
    {
      '@type': 'CreativeWorkSeries',
      '@id': `${bookUrl}#series`,
      name: entry.novel.title,
      inLanguage: 'zh-CN',
      author: { '@type': 'Person', name: entry.novel.author },
      genre: entry.novel.tags || [],
      url: bookUrl,
    },
    {
      '@type': 'Book',
      '@id': `${bookUrl}#book`,
      name: entry.novel.title,
      description: entry.novel.intro,
      inLanguage: 'zh-CN',
      author: { '@type': 'Person', name: entry.novel.author },
      isPartOf: { '@id': `${bookUrl}#series` },
      url: bookUrl,
      hasPart: entry.chapters.map((item) => ({
        '@type': 'Chapter',
        name: item.title,
        position: entry.chapters.indexOf(item) + 1,
        url: readerUrl({ locale, bookId: entry.id, chapterId: item.id }),
      })),
    },
  ];
  if (chapter) {
    const position = entry.chapters.findIndex((item) => String(item.id) === String(chapter.id)) + 1;
    graph.push({
      '@type': ['Chapter', 'Article'],
      headline: chapter.title,
      position,
      wordCount: chapter.wordCount || undefined,
      inLanguage: 'zh-CN',
      author: { '@type': 'Person', name: entry.novel.author },
      isPartOf: { '@id': `${bookUrl}#book` },
      mainEntityOfPage: readerUrl({ locale, bookId: entry.id, chapterId: chapter.id }),
    });
  }
  graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: locale === 'en' ? 'Novels' : '小说', item: `https://feida.au${locale === 'adaptive' ? '' : `/${locale}`}/serial.html` },
      { '@type': 'ListItem', position: 2, name: entry.novel.title, item: bookUrl },
      ...(chapter ? [{ '@type': 'ListItem', position: 3, name: chapter.title, item: readerUrl({ locale, bookId: entry.id, chapterId: chapter.id }) }] : []),
    ],
  });
  const scripts = all(document, (node) => node.tagName === 'script' && getAttr(node, 'type') === 'application/ld+json');
  scripts.slice(1).forEach(removeNode);
  if (scripts[0]) setText(scripts[0], JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }));
}

export function transformNovelPageDocument(source, catalog, entry, chapter, locale) {
  const document = parse(source);
  const fixedLocale = novelLocale(locale);
  const pageCopy = novelPageCopy(locale, entry, chapter);
  const routeInput = { bookId: entry.id, ...(chapter ? { chapterId: chapter.id } : {}) };
  const canonical = readerUrl({ ...routeInput, locale: fixedLocale });
  const title = element(document, 'title');
  if (title) setText(title, pageCopy.title);
  setMetaContent(document, { name: 'description' }, pageCopy.description);
  setMetaContent(document, { property: 'og:title' }, pageCopy.title);
  setMetaContent(document, { property: 'og:description' }, pageCopy.description);
  setMetaContent(document, { property: 'og:url' }, canonical);
  setMetaContent(document, { property: 'og:type' }, chapter ? 'article' : 'book');
  setLinkHref(document, 'canonical', canonical);
  setNovelAlternates(document, routeInput);
  injectNovelShelf(document, catalog, locale);

  const hero = {
    novelKicker: (entry.novel.tags || []).slice(0, 4).join(' · '),
    novelTitle: entry.novel.title,
    novelSub: entry.novel.subtitle || '',
    novelIntro: entry.novel.intro,
    novelAuthor: entry.novel.author,
    novelUpdateNote: entry.novel.updateNote,
    novelStart: entry.novel.startDate,
  };
  Object.entries(hero).forEach(([id, value]) => {
    const node = byId(document, id);
    if (node) setText(node, value);
  });
  const tags = byId(document, 'novelTags');
  if (tags) setHtml(tags, (entry.novel.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(''));

  const chapterTitle = byId(document, 'chapterTitle');
  const chapterMeta = byId(document, 'chapterMeta');
  const chapterBody = byId(document, 'chapterBody');
  const position = chapter ? entry.chapters.findIndex((item) => String(item.id) === String(chapter.id)) : -1;
  if (chapter) {
    setText(chapterTitle, chapter.title);
    setText(chapterMeta, `${locale === 'en' ? 'Chapter' : '第'} ${position + 1} / ${entry.chapters.length} · ${chapter.wordCount || 0} ${locale === 'en' ? 'Chinese characters' : '字'}`);
    setHtml(chapterBody, renderNovelBlocks(chapter.blocks));
  } else {
    setText(chapterTitle, locale === 'en' ? 'Chapter index' : '章节目录');
    setText(chapterMeta, locale === 'en' ? `${entry.chapters.length} published chapters` : `已发布 ${entry.chapters.length} 章`);
    setHtml(chapterBody, `<ol class="prerender-toc">${entry.chapters.map((item) => (
      `<li><a href="${escapeAttribute(readerPath({ locale: fixedLocale, bookId: entry.id, chapterId: item.id }))}">${escapeHtml(item.title)}</a><span>${item.wordCount || 0} 字</span></li>`
    )).join('')}</ol>`);
  }

  const normal = byId(document, 'readerNormal');
  if (normal) setAttr(normal, 'data-prerendered', chapter ? 'chapter' : 'book');
  const chapterNav = first(document, (node) => hasClass(node, 'chapter-nav'));
  if (chapterNav && chapter) {
    const previous = entry.chapters[position - 1];
    const next = entry.chapters[position + 1];
    setHtmlFragmentAtEnd(chapterNav, `<nav class="prerender-chapter-nav" aria-label="${locale === 'en' ? 'Chapter links' : '章节链接'}">`
      + (previous ? `<a rel="prev" href="${escapeAttribute(readerPath({ locale: fixedLocale, bookId: entry.id, chapterId: previous.id }))}">← ${escapeHtml(previous.title)}</a>` : '<span></span>')
      + (next ? `<a rel="next" href="${escapeAttribute(readerPath({ locale: fixedLocale, bookId: entry.id, chapterId: next.id }))}">${escapeHtml(next.title)} →</a>` : '<span></span>')
      + '</nav>');
    const head = element(document, 'head');
    if (head && previous) setHtmlFragmentAtEnd(head, `<link rel="prev" href="${escapeAttribute(readerUrl({ locale: fixedLocale, bookId: entry.id, chapterId: previous.id }))}">`);
    if (head && next) setHtmlFragmentAtEnd(head, `<link rel="next" href="${escapeAttribute(readerUrl({ locale: fixedLocale, bookId: entry.id, chapterId: next.id }))}">`);
  }
  for (const languageLink of all(document, (node) => hasClass(node, 'lang-toggle'))) {
    const targetLocale = locale === 'en' ? 'zh' : 'en';
    setAttr(languageLink, 'href', readerPath({ ...routeInput, locale: targetLocale }));
  }
  const body = element(document, 'body');
  if (body) setAttr(body, 'data-reader-route', chapter ? 'chapter' : 'book');
  setNovelJsonLd(document, entry, chapter, fixedLocale);
  return serialize(document);
}

export function generateNovelDocuments(outputRoot, catalog = loadNovelCatalog()) {
  const templates = [
    ['adaptive', resolve(outputRoot, 'serial.html')],
    ['zh', resolve(outputRoot, 'zh/serial.html')],
  ];
  let emitted = 0;
  for (const [locale, sourcePath] of templates) {
    const source = readFileSync(sourcePath, 'utf8');
    const indexDocument = parse(source);
    injectNovelShelf(indexDocument, catalog, locale);
    writeFileSync(sourcePath, serialize(indexDocument));
    for (const entry of catalog) {
      for (const chapter of [null, ...entry.chapters]) {
        const path = readerPath({
          locale,
          bookId: entry.id,
          ...(chapter ? { chapterId: chapter.id } : {}),
        });
        const target = resolve(outputRoot, path.replace(/^\//, ''), 'index.html');
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, transformNovelPageDocument(source, catalog, entry, chapter, locale));
        emitted += 1;
      }
    }
  }
  return emitted;
}

export function generateLocalizedSite(outDir = 'dist') {
  const outputRoot = resolve(ROOT, outDir);
  if (!existsSync(outputRoot)) throw new Error(`Build output does not exist: ${outputRoot}`);
  let emitted = 0;

  for (const route of ACTIVE_ROUTES) {
    const sourcePath = resolve(outputRoot, route.file);
    if (!existsSync(sourcePath)) throw new Error(`Missing built route: ${route.file}`);
    const source = readFileSync(sourcePath, 'utf8');
    writeFileSync(sourcePath, transformAdaptiveDocument(source, route));

    for (const locale of SITE_LOCALES) {
      if (route.id === 'serial' && locale === 'en') continue;
      const relative = route.path === '/'
        ? `${locale}/index.html`
        : `${locale}/${route.file}`;
      const target = resolve(outputRoot, relative);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, transformLocalizedDocument(source, route, locale));
      emitted += 1;
    }
  }

  const novelDocuments = generateNovelDocuments(outputRoot);
  console.log(`OK: emitted ${emitted} fixed-locale documents + ${novelDocuments} novel documents in ${outDir}`);
  return emitted + novelDocuments;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const flagIndex = process.argv.indexOf('--out-dir');
  const outDir = flagIndex >= 0 ? process.argv[flagIndex + 1] : 'dist';
  generateLocalizedSite(outDir);
}
