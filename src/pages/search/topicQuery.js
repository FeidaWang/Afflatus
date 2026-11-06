import { byDateDescending } from '../../showcase/topicsIndex.js';

// The one place that decides what /search.html shows for a URL.
export function parseSearchQuery(search, topicIds) {
  const params = new URLSearchParams(search);
  const q = params.get('q')?.trim();
  if (q) return { kind: 'query', q };
  const topic = params.get('topic');
  if (topic && topicIds.includes(topic)) return { kind: 'topic', topic };
  return { kind: 'directory', unknownTopic: Boolean(topic) };
}

const normalise = (text) => text.normalize('NFKC').toLowerCase();

// Every word must appear somewhere in the title or summary, in either language.
// Entries matching on the title alone come first; each part stays newest first.
export function searchEntries(index, q) {
  const words = normalise(q).split(/\s+/).filter(Boolean);
  const matches = (text) => words.every((word) => text.includes(word));
  const inTitle = [];
  const inBody = [];
  for (const entry of [...index.entries].sort(byDateDescending)) {
    const title = normalise(`${entry.title.en} ${entry.title.zh}`);
    if (matches(title)) inTitle.push(entry);
    else if (matches(`${title} ${normalise(`${entry.summary.en} ${entry.summary.zh}`)}`)) inBody.push(entry);
  }
  return [...inTitle, ...inBody];
}
