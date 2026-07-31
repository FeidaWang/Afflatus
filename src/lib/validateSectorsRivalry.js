/* Shape and editorial-integrity gate for public/sectors-rivalry.json.
 *
 * This dataset is intentionally a compact research snapshot rather than a live
 * quote feed. The validator therefore protects the commitments visible on the
 * page: balanced US/CN comparisons, exact audit counts, bilingual analysis and
 * explicit valuation denominators.
 */

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isUrl = (value) => isText(value) && /^https?:\/\//.test(value);

function requireBilingual(value, path, errors) {
  if (!isObject(value)) {
    errors.push(`${path}: must contain en/zh text`);
    return;
  }
  if (!isText(value.en)) errors.push(`${path}.en: missing or empty`);
  if (!isText(value.zh)) errors.push(`${path}.zh: missing or empty`);
}

function requireExactArray(value, length, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: must be an array`);
    return false;
  }
  if (value.length !== length) errors.push(`${path}: expected ${length} entries, got ${value.length}`);
  return true;
}

function requireUniqueStrings(value, path, errors) {
  if (!Array.isArray(value)) return;
  const seen = new Set();
  value.forEach((entry, index) => {
    if (!isText(entry)) errors.push(`${path}[${index}]: missing or empty`);
    if (seen.has(entry)) errors.push(`${path}[${index}]: duplicate "${entry}"`);
    seen.add(entry);
  });
}

function validateLabs(labs, path, errors) {
  if (!requireExactArray(labs, 5, path, errors)) return;
  const names = new Set();
  labs.forEach((lab, index) => {
    const tag = `${path}[${index}]`;
    if (!isText(lab?.name)) errors.push(`${tag}.name: missing`);
    if (names.has(lab?.name)) errors.push(`${tag}.name: duplicate "${lab?.name}"`);
    names.add(lab?.name);
    for (const key of ['model', 'route']) {
      if (!isText(lab?.[key])) errors.push(`${tag}.${key}: missing`);
    }
    if (!Number.isFinite(lab?.score) || lab.score < 0 || lab.score > 100) {
      errors.push(`${tag}.score: must be in [0,100]`);
    }
    if (!Array.isArray(lab?.vector) || lab.vector.length !== 5
      || lab.vector.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      errors.push(`${tag}.vector: must contain five scores in [0,100]`);
    }
    requireBilingual(lab?.edge, `${tag}.edge`, errors);
    requireBilingual(lab?.risk, `${tag}.risk`, errors);
  });
}

function validateEquities(items, path, errors) {
  if (!requireExactArray(items, 10, path, errors)) return;
  const tickers = new Set();
  items.forEach((item, index) => {
    const tag = `${path}[${index}]`;
    if (item?.rank !== index + 1) errors.push(`${tag}.rank: expected ${index + 1}`);
    for (const key of ['ticker', 'name', 'layer', 'stance']) {
      if (!isText(item?.[key])) errors.push(`${tag}.${key}: missing`);
    }
    if (tickers.has(item?.ticker)) errors.push(`${tag}.ticker: duplicate "${item?.ticker}"`);
    tickers.add(item?.ticker);
    if (!Number.isFinite(item?.strength) || item.strength < 0 || item.strength > 100) {
      errors.push(`${tag}.strength: must be in [0,100]`);
    }
    if (!isText(item?.fairBand) || !/(EPS|FCF|sales)/i.test(item.fairBand)) {
      errors.push(`${tag}.fairBand: must state a valuation denominator`);
    }
    requireBilingual(item?.thesis, `${tag}.thesis`, errors);
    requireBilingual(item?.risk, `${tag}.risk`, errors);
  });
}

/**
 * @param {unknown} data parsed public/sectors-rivalry.json
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateSectorsRivalry(data) {
  const errors = [];
  if (!isObject(data)) return { ok: false, errors: ['top-level value must be an object'] };

  if (data.schemaVersion !== '2026-07-29') {
    errors.push(`schemaVersion: expected "2026-07-29", got ${JSON.stringify(data.schemaVersion)}`);
  }
  if (!isText(data.updated) || Number.isNaN(Date.parse(data.updated))) errors.push('updated: must be an ISO-style date');
  requireBilingual(data.editorialNote, 'editorialNote', errors);

  if (!Array.isArray(data.sources) || data.sources.length < 8) {
    errors.push('sources: must contain at least eight primary/reported sources');
  } else {
    data.sources.forEach((source, index) => {
      if (!isText(source?.label)) errors.push(`sources[${index}].label: missing`);
      if (!isUrl(source?.url)) errors.push(`sources[${index}].url: must be http(s)`);
      if (!['primary', 'reported'].includes(source?.kind)) errors.push(`sources[${index}].kind: must be primary/reported`);
    });
  }

  if (!isObject(data.k3)) errors.push('k3: missing');
  else {
    requireBilingual(data.k3.headline, 'k3.headline', errors);
    requireBilingual(data.k3.summary, 'k3.summary', errors);
    requireExactArray(data.k3.stats, 4, 'k3.stats', errors);
    requireExactArray(data.k3.architecture, 4, 'k3.architecture', errors);
    requireExactArray(data.k3.costFrontier, 4, 'k3.costFrontier', errors);
  }

  requireBilingual(data.frontierLabs?.method, 'frontierLabs.method', errors);
  validateLabs(data.frontierLabs?.US, 'frontierLabs.US', errors);
  validateLabs(data.frontierLabs?.CN, 'frontierLabs.CN', errors);
  requireExactArray(data.eventStudy, 4, 'eventStudy', errors);
  requireExactArray(data.transmission, 4, 'transmission', errors);

  requireBilingual(data.valuationMethod?.title, 'valuationMethod.title', errors);
  requireBilingual(data.valuationMethod?.body, 'valuationMethod.body', errors);
  validateEquities(data.equities?.US, 'equities.US', errors);
  validateEquities(data.equities?.CN, 'equities.CN', errors);

  const letter = data.openWeightsLetter;
  if (!isObject(letter)) errors.push('openWeightsLetter: missing');
  else {
    requireExactArray(letter.screenshotNames, 50, 'openWeightsLetter.screenshotNames', errors);
    requireExactArray(letter.officialNames, 77, 'openWeightsLetter.officialNames', errors);
    requireUniqueStrings(letter.screenshotNames, 'openWeightsLetter.screenshotNames', errors);
    requireUniqueStrings(letter.officialNames, 'openWeightsLetter.officialNames', errors);
    if (letter.officialSnapshot?.count !== letter.officialNames?.length) {
      errors.push('openWeightsLetter.officialSnapshot.count: must match officialNames length');
    }
    if (!isUrl(letter.officialSnapshot?.source)) errors.push('openWeightsLetter.officialSnapshot.source: must be http(s)');
    if (!Array.isArray(letter.missing) || letter.missing.length < 4) {
      errors.push('openWeightsLetter.missing: must contain important absences');
    } else {
      letter.missing.forEach((item, index) => {
        if (!isText(item?.name)) errors.push(`openWeightsLetter.missing[${index}].name: missing`);
        requireBilingual(item?.why, `openWeightsLetter.missing[${index}].why`, errors);
      });
    }
  }

  if (requireExactArray(data.postMemoryTheses, 10, 'postMemoryTheses', errors)) {
    data.postMemoryTheses.forEach((item, index) => {
      const tag = `postMemoryTheses[${index}]`;
      if (item?.id !== String(index + 1).padStart(2, '0')) errors.push(`${tag}.id: invalid sequence`);
      requireBilingual(item?.title, `${tag}.title`, errors);
      requireBilingual(item?.thesis, `${tag}.thesis`, errors);
      requireBilingual(item?.invalidate, `${tag}.invalidate`, errors);
      if (!isText(item?.own)) errors.push(`${tag}.own: missing`);
    });
  }

  return { ok: errors.length === 0, errors };
}
