const isCopy = (value) => Boolean(value?.en && value?.zh);

export function validateMenuLatest(data) {
  if (!Array.isArray(data) || !data.length) return { ok: false, errors: ['top-level: must be a non-empty array of cards'] };
  const errors = [];
  data.forEach((card, index) => {
    const tag = `card ${index}`;
    if (!card.href?.en?.startsWith('/') || !card.href?.zh?.startsWith('/')) errors.push(`${tag}: href must be a site path for both locales`);
    if (!isCopy(card.label) || !isCopy(card.title)) errors.push(`${tag}: missing bilingual copy`);
    if (!card.cover?.startsWith('/')) errors.push(`${tag}: cover must be a site path`);
    if (card.date !== null && !(/^\d{4}-\d{2}/.test(card.date?.iso) && isCopy(card.date?.label))) errors.push(`${tag}: invalid date`);
  });
  return { ok: errors.length === 0, errors };
}
