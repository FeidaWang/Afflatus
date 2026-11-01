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
export const topicEntries = (index, topicId) => index.entries.filter((entry) => entry.topic.includes(topicId));

const MAX_LEAVES = 4;

// What a card's popover shows; topicId pins it to the topic being browsed.
export function relatedFor(index, url, topicId) {
  const entry = index.entries.find((item) => item.url === url);
  const topic = index.topics.find((item) => item.id === (topicId || entry.topic[0]));
  const others = topicEntries(index, topic.id).filter((item) => item !== entry);
  return { topic, leaves: others.slice(0, MAX_LEAVES), card: others[0] };
}
