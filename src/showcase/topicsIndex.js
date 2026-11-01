import { navigationHref } from '../lib/siteNavigation.js';

// Fetched on demand so the index stays out of the critical path of the pages that use it.
let request = null;
export function loadTopicsIndex() {
  request ||= fetch('/topics-index.json')
    .then((response) => {
      if (!response.ok) throw new Error(`topics-index.json: HTTP ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      request = null;
      throw error;
    });
  return request;
}

// Novels only exist under /zh/, so their URLs are already final.
export const entryHref = (url, language) => (url.startsWith('/zh/') ? url : navigationHref(url, language));
export const topicHref = (topicId, language) => navigationHref(`/search.html?topic=${encodeURIComponent(topicId)}`, language);

// Newest first; undated entries follow, and ties keep the index's own order.
const byDateDescending = (a, b) => (b.date?.iso || '').localeCompare(a.date?.iso || '');
export const topicEntries = (index, topicId) => index.entries
  .filter((entry) => entry.topic.includes(topicId))
  .sort(byDateDescending);

const MAX_LEAVES = 5;

// What a card's popover shows; topicId pins it to the topic being browsed.
export function relatedFor(index, url, topicId) {
  const entry = index.entries.find((item) => item.url === url);
  const topic = index.topics.find((item) => item.id === (topicId || entry.topic[0]));
  const others = topicEntries(index, topic.id).filter((item) => item !== entry);
  const leaves = others.filter((item) => item.date).slice(0, MAX_LEAVES);
  return { entry, topic, leaves, card: leaves[0] || others[0] };
}
