/* Schema checks for the versioned election maps. A map holds shapes and ids only: no results. */
const FEATURE_KEYS = new Set(['id', 'd', 'b', 'c']);
const isBox = (box) => Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) && box[2] > box[0] && box[3] > box[1];

export function validateElectionMap(data) {
  const errors = [];
  if (typeof data?.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data?.version ?? '')) errors.push('map needs an id and a dated version');
  if (!Array.isArray(data?.viewBox) || data.viewBox.length !== 4 || !data.viewBox.every(Number.isFinite)) errors.push('map needs a numeric viewBox');
  if (!Array.isArray(data?.features) || !data.features.length) return { ok: false, errors: [...errors, 'map has no features'] };
  const seen = new Set();
  for (const feature of data.features) {
    if (seen.has(feature.id)) errors.push(`duplicate feature ${feature.id}`);
    seen.add(feature.id);
    if (!Object.keys(feature).every((key) => FEATURE_KEYS.has(key))) errors.push(`feature ${feature.id} has unexpected fields`);
    if (!/^M-?\d[^<>"]*z$/.test(feature.d ?? '')) errors.push(`feature ${feature.id} has no path`);
    if (!isBox(feature.b)) errors.push(`feature ${feature.id} has a bad bounding box`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateElectionMapManifest(data) {
  const errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.version ?? '')) errors.push('manifest needs a dated version');
  for (const source of data?.sources ?? []) {
    for (const key of ['label', 'licence', 'boundaryVersion', 'electionValidity']) {
      if (!source[key]) errors.push(`${source.id} is missing ${key}`);
    }
    if (!source.files?.length) errors.push(`${source.id} lists no files`);
    for (const file of source.files ?? []) {
      if (!/^https:\/\//.test(file.url ?? '') || !/^[0-9a-f]{64}$/.test(file.sha256 ?? '') || Number.isNaN(Date.parse(file.fetchedAt))) {
        errors.push(`${source.id} has an incomplete file record`);
      }
    }
  }
  if (!data?.sources?.length) errors.push('manifest lists no sources');
  if (!Object.keys(data?.maps ?? {}).length) errors.push('manifest lists no maps');
  if (!Array.isArray(data?.gaps)) errors.push('manifest must state its gaps');
  return { ok: errors.length === 0, errors };
}
