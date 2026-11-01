import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOPIC_GROUPS, TOPICS } from '../src/config/topics.js';
import { HOME_LATEST } from '../src/config/homeLatest.generated.js';
import { parseSearchQuery } from '../src/pages/search/topicQuery.js';
import { LEARN_CARDS } from '../src/showcase/homeCards.js';
import { entryHref, relatedFor, topicEntries, topicHref } from '../src/showcase/topicsIndex.js';

const index = JSON.parse(readFileSync('public/topics-index.json', 'utf8'));
const sitemapUrls = [...readFileSync('public/sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const entryUrls = new Set(index.entries.map((entry) => entry.url.split('#')[0]));

// A sitemap URL belongs to the entry for its locale-free page, or to its novel when it is a chapter.
function owningUrl(url) {
  const { pathname } = new URL(url);
  const novel = pathname.match(/^\/zh\/novels\/[^/]+\//);
  if (novel) return novel[0];
  if (pathname === '/zh/serial.html') return '/serial.html';
  return pathname.replace(/^\/(?:en|zh)(?=\/)/, '');
}

describe('topics index', () => {
  it('covers every sitemap URL except its own view', () => {
    expect(sitemapUrls.length).toBeGreaterThanOrEqual(234);
    const pages = sitemapUrls.filter((url) => !url.endsWith('/search.html'));
    expect(pages).toHaveLength(sitemapUrls.length - 2);
    expect(pages.filter((url) => !entryUrls.has(owningUrl(url)))).toEqual([]);
  });

  it('has no entry without a sitemap page', () => {
    const owners = new Set(sitemapUrls.map(owningUrl));
    expect([...entryUrls].filter((url) => !owners.has(url))).toEqual([]);
  });

  it('gives each entry the required fields', () => {
    const ids = index.entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const topicIds = TOPICS.map((topic) => topic.id);
    for (const entry of index.entries) {
      expect(Object.keys(TOPIC_GROUPS)).toContain(entry.group);
      expect(entry.topic.length).toBeGreaterThan(0);
      for (const topic of entry.topic) expect(topicIds).toContain(topic);
      for (const locale of ['en', 'zh']) {
        expect(entry.title[locale]).toBeTruthy();
        expect(entry.summary[locale]).toBeTruthy();
        expect(entry.cover[locale]).toMatch(/^\/assets\//);
        expect(readFileSync(`public${entry.cover[locale]}`).length).toBeGreaterThan(0);
      }
      expect(entry.date.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('stays small enough to fetch on demand', () => {
    expect(readFileSync('public/topics-index.json').length).toBeLessThan(40 * 1024);
  });

  it('gives every homepage card a topic with something to relate to', () => {
    for (const { href } of [...HOME_LATEST, ...LEARN_CARDS]) {
      const { topic, leaves, card } = relatedFor(index, href);
      expect(topic.summary.en).toBeTruthy();
      expect(leaves.length).toBeGreaterThan(0);
      expect(leaves.length).toBeLessThanOrEqual(4);
      expect(card.url).not.toBe(href);
    }
  });

  it('keeps a result card inside the topic being browsed', () => {
    const { topic, card } = relatedFor(index, '/sectors.html', 'about');
    expect(topic.id).toBe('about');
    expect(topicEntries(index, 'about')).toContainEqual(card);
  });

  it('resolves localized links, keeping Chinese-only pages under /zh/', () => {
    expect(entryHref('/sectors.html#rivalry', 'zh')).toBe('/zh/sectors.html#rivalry');
    expect(entryHref('/serial.html', 'en')).toBe('/zh/serial.html');
    expect(entryHref('/zh/novels/yuxi-gongci/', 'en')).toBe('/zh/novels/yuxi-gongci/');
    expect(topicHref('ai-observatory', 'en')).toBe('/en/search.html?topic=ai-observatory');
  });
});

describe('parseSearchQuery', () => {
  const ids = ['labs', 'about'];

  it('accepts a known topic', () => {
    expect(parseSearchQuery('?topic=labs', ids)).toEqual({ kind: 'topic', topic: 'labs' });
  });

  it('shows the directory when the topic is missing or empty', () => {
    expect(parseSearchQuery('', ids)).toEqual({ kind: 'directory', unknownTopic: false });
    expect(parseSearchQuery('?topic=', ids)).toEqual({ kind: 'directory', unknownTopic: false });
  });

  it('flags an unknown topic, matching ids exactly', () => {
    for (const search of ['?topic=nope', '?topic=LABS', '?topic=%3Cscript%3E', '?topic=constructor']) {
      expect(parseSearchQuery(search, ids)).toEqual({ kind: 'directory', unknownTopic: true });
    }
  });
});
