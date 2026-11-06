import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
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
        if (entry.cover) expect(readFileSync(`public${entry.cover[locale]}`).length).toBeGreaterThan(0);
      }
      if (entry.date) expect(entry.date.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('takes the timeline from the data files, inventing no dates', () => {
    const signal = JSON.parse(readFileSync('public/signal-events.json', 'utf8')).events;
    for (const event of signal) {
      const entry = index.entries.find((item) => item.id === `signal-event-${event.id}`);
      expect(entry.date.iso).toBe(event.date);
      expect(entry.title).toEqual(event.name);
    }
    const observatoryFiles = readdirSync('public/data/sectors-observatory').sort();
    const observatory = JSON.parse(readFileSync(`public/data/sectors-observatory/${observatoryFiles.at(-1)}`, 'utf8'));
    for (const event of observatory.events) {
      expect(index.entries.find((item) => item.id === `sectors-event-${event.id}`).date.iso).toBe(event.date);
    }
    for (const chapter of index.entries.filter((item) => /^sectors-(overview|models|rivalry|sources)$/.test(item.id))) {
      expect(chapter.date).toBeNull();
    }
  });

  it('gives every page-level entry a cover of its own within its topic', () => {
    const pages = index.entries.filter((entry) => !/-event-/.test(entry.id));
    for (const entry of pages) expect(entry.cover).not.toBeNull();
    for (const topic of TOPICS) {
      const covers = topicEntries(index, topic.id).filter((entry) => entry.cover).map((entry) => entry.cover.en);
      expect(new Set(covers).size).toBe(covers.length);
    }
  });

  it('sends each novel node to its latest chapter, and each record to an anchor its page renders', () => {
    for (const { id, chapterCount } of JSON.parse(readFileSync('public/novels-index.json', 'utf8')).novels) {
      const { chapters } = JSON.parse(readFileSync(`public/novels/${id}.json`, 'utf8'));
      expect(chapters).toHaveLength(chapterCount);
      const entry = index.entries.find((item) => item.id === `novel-${id}`);
      expect(entry.url).toBe(`/zh/novels/${id}/`);
      expect(entry.latestUrl).toBe(`/zh/novels/${id}/${encodeURIComponent(chapters.at(-1).id)}/`);
    }
    const signalIds = new Set(JSON.parse(readFileSync('public/signal-events.json', 'utf8')).events.map((event) => event.id));
    const observatoryFiles = readdirSync('public/data/sectors-observatory').sort();
    const observatoryIds = JSON.parse(readFileSync(`public/data/sectors-observatory/${observatoryFiles.at(-1)}`, 'utf8')).events.map((event) => `event-${event.id}`);
    for (const entry of index.entries) {
      if (entry.id.startsWith('signal-event-')) expect(signalIds.has(entry.url.split('#')[1])).toBe(true);
      if (entry.id.startsWith('sectors-event-')) expect(observatoryIds).toContain(entry.url.split('#')[1]);
    }
  });

  it('stays small enough to fetch on demand', () => {
    // Grows with the data files, so this leaves room for new records.
    expect(gzipSync(readFileSync('public/topics-index.json')).length).toBeLessThan(40 * 1024);
  });

  it('lists a topic newest first, undated entries last', () => {
    for (const topic of TOPICS) {
      const dates = topicEntries(index, topic.id).map((entry) => entry.date?.iso || '');
      expect(dates).toEqual([...dates].sort().reverse());
    }
  });

  it('gives every homepage card a timeline of real, newest-first entries', () => {
    for (const { href } of [...HOME_LATEST, ...LEARN_CARDS]) {
      const { entry, topic, leaves, card } = relatedFor(index, href);
      expect(entry.url).toBe(href);
      expect(topic.summary.en).toBeTruthy();
      expect(leaves.length).toBeGreaterThan(0);
      expect(leaves.length).toBeLessThanOrEqual(5);
      expect(card.url).not.toBe(href);
      expect(leaves.every((leaf) => leaf.date && leaf.url !== href)).toBe(true);
      const dates = leaves.map((leaf) => leaf.date.iso);
      expect(dates).toEqual([...dates].sort().reverse());
    }
  });

  it('builds the Fed Watch and observatory trees from their dated records', () => {
    expect(relatedFor(index, '/signal.html').leaves.every((leaf) => leaf.id.startsWith('signal-event-'))).toBe(true);
    expect(relatedFor(index, '/sectors.html').leaves.every((leaf) => leaf.id.startsWith('sectors-event-'))).toBe(true);
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
