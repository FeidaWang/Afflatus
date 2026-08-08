/* Shape and editorial-integrity gate for public/sectors-rivalry.json.
 *
 * This dataset is intentionally a compact research snapshot rather than a live
 * quote feed. The validator therefore protects the commitments visible on the
 * page: evidence-layer separation, balanced US/CN comparisons, explicit N/A
 * states, a complete 20-instrument supply chain and valuation denominators.
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

function validateEquities(items, path, chainStages, errors) {
  if (!requireExactArray(items, 10, path, errors)) return;
  const tickers = new Set();
  items.forEach((item, index) => {
    const tag = `${path}[${index}]`;
    if (item?.rank !== index + 1) errors.push(`${tag}.rank: expected ${index + 1}`);
    for (const key of ['ticker', 'name', 'layer', 'stance']) {
      if (!isText(item?.[key])) errors.push(`${tag}.${key}: missing`);
    }
    if (!chainStages.has(item?.chainStage)) errors.push(`${tag}.chainStage: unknown supply-chain stage`);
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

  if (data.schemaVersion !== '2026-08-08') {
    errors.push(`schemaVersion: expected "2026-08-08", got ${JSON.stringify(data.schemaVersion)}`);
  }
  if (!isText(data.updated) || Number.isNaN(Date.parse(data.updated))) errors.push('updated: must be an ISO-style date');
  requireBilingual(data.editorialNote, 'editorialNote', errors);
  if (/github\.com\//i.test(JSON.stringify(data))) {
    errors.push('privacy: public rivalry research may not use GitHub provenance');
  }

  if (!isObject(data.k3)) errors.push('k3: missing');
  else {
    requireBilingual(data.k3.headline, 'k3.headline', errors);
    requireBilingual(data.k3.summary, 'k3.summary', errors);
    requireExactArray(data.k3.stats, 4, 'k3.stats', errors);
    if (requireExactArray(data.k3.architecture, 4, 'k3.architecture', errors)) {
      data.k3.architecture.forEach((item, index) => {
        const tag = `k3.architecture[${index}]`;
        if (!isText(item?.code)) errors.push(`${tag}.code: missing`);
        for (const key of ['axis', 'title', 'official', 'thread', 'investment']) {
          requireBilingual(item?.[key], `${tag}.${key}`, errors);
        }
      });
    }
    requireExactArray(data.k3.costFrontier, 4, 'k3.costFrontier', errors);
    requireBilingual(data.k3.evidenceBoundary?.title, 'k3.evidenceBoundary.title', errors);
    requireBilingual(data.k3.evidenceBoundary?.body, 'k3.evidenceBoundary.body', errors);
    if (requireExactArray(data.k3.evidenceBoundary?.sources, 3, 'k3.evidenceBoundary.sources', errors)) {
      data.k3.evidenceBoundary.sources.forEach((source, index) => {
        if (!isUrl(source?.url)) errors.push(`k3.evidenceBoundary.sources[${index}].url: must be http(s)`);
        requireBilingual(source?.label, `k3.evidenceBoundary.sources[${index}].label`, errors);
        if (!['PRIMARY', 'COMMENTARY'].includes(source?.level)) errors.push(`k3.evidenceBoundary.sources[${index}].level: invalid`);
      });
    }
  }

  if (!isObject(data.deepSeek)) errors.push('deepSeek: missing');
  else {
    for (const key of ['status', 'headline', 'assessment']) requireBilingual(data.deepSeek[key], `deepSeek.${key}`, errors);
    if (requireExactArray(data.deepSeek.models, 2, 'deepSeek.models', errors)) {
      data.deepSeek.models.forEach((model, index) => {
        const tag = `deepSeek.models[${index}]`;
        for (const key of ['id', 'version', 'parameters', 'context', 'concurrency']) {
          if (!isText(model?.[key])) errors.push(`${tag}.${key}: missing`);
        }
        requireBilingual(model?.availability, `${tag}.availability`, errors);
      });
    }
    if (requireExactArray(data.deepSeek.pricing, 2, 'deepSeek.pricing', errors)) {
      data.deepSeek.pricing.forEach((price, index) => {
        for (const key of ['model', 'cacheHit', 'cacheMiss', 'output']) {
          if (!isText(price?.[key])) errors.push(`deepSeek.pricing[${index}].${key}: missing`);
        }
      });
    }
    if (requireExactArray(data.deepSeek.operations, 4, 'deepSeek.operations', errors)) {
      data.deepSeek.operations.forEach((item, index) => {
        if (!isText(item?.code)) errors.push(`deepSeek.operations[${index}].code: missing`);
        requireBilingual(item?.title, `deepSeek.operations[${index}].title`, errors);
        requireBilingual(item?.body, `deepSeek.operations[${index}].body`, errors);
      });
    }
    for (const key of ['label', 'fact', 'hypothesis']) requireBilingual(data.deepSeek.causality?.[key], `deepSeek.causality.${key}`, errors);
    if (!Array.isArray(data.deepSeek.sources) || data.deepSeek.sources.length < 5) errors.push('deepSeek.sources: must contain at least five direct sources');
    else data.deepSeek.sources.forEach((source, index) => {
      if (!isUrl(source?.url)) errors.push(`deepSeek.sources[${index}].url: must be http(s)`);
      requireBilingual(source?.label, `deepSeek.sources[${index}].label`, errors);
    });
  }

  requireBilingual(data.frontierLabs?.method, 'frontierLabs.method', errors);
  const runtimeMarker = data.frontierLabs?.runtimeMarker;
  if (!isObject(runtimeMarker)) errors.push('frontierLabs.runtimeMarker: missing');
  else {
    if (runtimeMarker.name !== '5.6 Sol Ultra') errors.push('frontierLabs.runtimeMarker.name: expected 5.6 Sol Ultra');
    if (!isText(runtimeMarker.after)) errors.push('frontierLabs.runtimeMarker.after: missing');
    const rankedModels = [
      ...(Array.isArray(data.frontierLabs?.US) ? data.frontierLabs.US : []),
      ...(Array.isArray(data.frontierLabs?.CN) ? data.frontierLabs.CN : []),
    ].map((lab) => lab?.model);
    if (isText(runtimeMarker.after) && !rankedModels.includes(runtimeMarker.after)) {
      errors.push('frontierLabs.runtimeMarker.after: anchor model does not exist');
    }
    requireBilingual(runtimeMarker.route, 'frontierLabs.runtimeMarker.route', errors);
    requireBilingual(runtimeMarker.note, 'frontierLabs.runtimeMarker.note', errors);
    if (runtimeMarker.score !== null) errors.push('frontierLabs.runtimeMarker.score: must be null/N/A');
    if (!Array.isArray(runtimeMarker.vector) || runtimeMarker.vector.length !== 5
      || runtimeMarker.vector.some((value) => value !== null)) {
      errors.push('frontierLabs.runtimeMarker.vector: all five values must be null/N/A');
    }
  }
  validateLabs(data.frontierLabs?.US, 'frontierLabs.US', errors);
  validateLabs(data.frontierLabs?.CN, 'frontierLabs.CN', errors);
  requireExactArray(data.eventStudy, 4, 'eventStudy', errors);
  requireExactArray(data.transmission, 4, 'transmission', errors);

  requireBilingual(data.valuationMethod?.title, 'valuationMethod.title', errors);
  requireBilingual(data.valuationMethod?.body, 'valuationMethod.body', errors);
  requireBilingual(data.supplyChain?.title, 'supplyChain.title', errors);
  requireBilingual(data.supplyChain?.body, 'supplyChain.body', errors);
  const stageIds = new Set();
  if (requireExactArray(data.supplyChain?.stages, 5, 'supplyChain.stages', errors)) {
    data.supplyChain.stages.forEach((stage, index) => {
      if (!isText(stage?.id)) errors.push(`supplyChain.stages[${index}].id: missing`);
      if (stageIds.has(stage?.id)) errors.push(`supplyChain.stages[${index}].id: duplicate`);
      stageIds.add(stage?.id);
      if (stage?.step !== String(index + 1).padStart(2, '0')) errors.push(`supplyChain.stages[${index}].step: invalid sequence`);
      requireBilingual(stage?.label, `supplyChain.stages[${index}].label`, errors);
    });
  }
  validateEquities(data.equities?.US, 'equities.US', stageIds, errors);
  validateEquities(data.equities?.CN, 'equities.CN', stageIds, errors);
  const allEquities = [...(data.equities?.US || []), ...(data.equities?.CN || [])];
  if (allEquities.length !== 20) errors.push(`equities: expected 20 total entries, got ${allEquities.length}`);
  const globalTickers = new Set(allEquities.map((equity) => equity?.ticker).filter(isText));
  if (globalTickers.size !== allEquities.length) errors.push('equities: tickers must be globally unique across US and CN');
  stageIds.forEach((stage) => {
    if (!allEquities.some((equity) => equity.chainStage === stage)) errors.push(`supplyChain.stages.${stage}: has no instruments`);
  });

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
