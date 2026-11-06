// The one place that decides what /search.html shows for a URL. Site search adds
// a { kind: 'query', q } result here for `?q=`, and a matching view in SearchApp.
export function parseSearchQuery(search, topicIds) {
  const topic = new URLSearchParams(search).get('topic');
  if (topic && topicIds.includes(topic)) return { kind: 'topic', topic };
  return { kind: 'directory', unknownTopic: Boolean(topic) };
}
