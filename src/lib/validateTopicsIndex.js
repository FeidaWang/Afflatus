const isCopy = (value) => Boolean(value?.en && value?.zh);

export function validateTopicsIndex(data) {
  if (!data?.groups || !Array.isArray(data.topics) || !Array.isArray(data.entries)) {
    return { ok: false, errors: ['top-level: must have "groups", "topics" and "entries"'] };
  }
  const errors = [];
  const topicIds = new Set(data.topics.map((topic) => topic.id));
  for (const topic of data.topics) {
    if (!data.groups[topic.group]) errors.push(`topic ${topic.id}: unknown group "${topic.group}"`);
    if (!isCopy(topic.title) || !isCopy(topic.summary)) errors.push(`topic ${topic.id}: missing bilingual copy`);
  }
  const ids = new Set();
  for (const entry of data.entries) {
    const tag = `entry ${entry.id}`;
    if (!entry.id || ids.has(entry.id)) errors.push(`${tag}: missing or duplicate id`);
    ids.add(entry.id);
    if (!data.groups[entry.group]) errors.push(`${tag}: unknown group "${entry.group}"`);
    if (!entry.topic?.length || !entry.topic.every((id) => topicIds.has(id))) errors.push(`${tag}: unknown topic`);
    if (!isCopy(entry.title) || !isCopy(entry.summary)) errors.push(`${tag}: missing bilingual copy`);
    if (entry.cover !== null && !isCopy(entry.cover)) errors.push(`${tag}: cover must be null or set for both locales`);
    if (!entry.url?.startsWith('/')) errors.push(`${tag}: url must be a site path`);
    if (entry.latestUrl !== undefined && !entry.latestUrl.startsWith('/')) errors.push(`${tag}: latestUrl must be a site path`);
    if (entry.date !== null && !/^\d{4}-\d{2}/.test(entry.date?.iso)) errors.push(`${tag}: invalid date`);
  }
  return { ok: errors.length === 0, errors };
}
