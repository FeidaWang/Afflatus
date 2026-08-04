const TICKER = /^[A-Z]{1,5}([.-][A-Z]{1,2})?$/;
const finite = (value) => Number.isFinite(Number(value));

export function validateArenaQuantModel(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['top-level value must be an object'] };
  if (typeof data.id !== 'string' || !data.id.trim()) errors.push('id must be a non-empty string');
  if (typeof data.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(data.version)) errors.push('version must use semantic x.y.z form');
  if (typeof data.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) errors.push('updated must be YYYY-MM-DD');
  if (!TICKER.test(data.benchmark || '')) errors.push('benchmark must be a valid uppercase ticker');

  if (!Array.isArray(data.universe) || data.universe.length < 2 || data.universe.length > 30) {
    errors.push('universe must contain 2-30 assets');
  } else {
    const seen = new Set();
    data.universe.forEach((asset, index) => {
      if (!asset || typeof asset !== 'object') { errors.push(`universe[${index}] must be an object`); return; }
      if (!TICKER.test(asset.sym || '')) errors.push(`universe[${index}].sym must be a valid uppercase ticker`);
      if (seen.has(asset.sym)) errors.push(`universe ticker ${asset.sym} is duplicated`);
      seen.add(asset.sym);
      if (typeof asset.name !== 'string' || !asset.name.trim()) errors.push(`universe[${index}].name is required`);
      if (typeof asset.sector !== 'string' || !asset.sector.trim()) errors.push(`universe[${index}].sector is required`);
    });
  }

  const factorKeys = ['momentum', 'trend', 'resilience', 'lowVol'];
  if (!data.weights || typeof data.weights !== 'object') errors.push('weights object is required');
  else {
    factorKeys.forEach((key) => {
      if (!finite(data.weights[key]) || Number(data.weights[key]) < 0) errors.push(`weights.${key} must be non-negative and finite`);
    });
    if (factorKeys.reduce((sum, key) => sum + Number(data.weights[key] || 0), 0) <= 0) errors.push('factor weights must have a positive total');
  }

  const settings = data.settings;
  if (!settings || typeof settings !== 'object') errors.push('settings object is required');
  else {
    if (!Number.isInteger(settings.maxNames) || settings.maxNames < 2 || settings.maxNames > (data.universe?.length || 30)) errors.push('settings.maxNames must fit the universe');
    if (!finite(settings.maxWeight) || settings.maxWeight <= 0 || settings.maxWeight > 1) errors.push('settings.maxWeight must be in (0, 1]');
    if (!finite(settings.sectorCap) || settings.sectorCap <= 0 || settings.sectorCap > 1) errors.push('settings.sectorCap must be in (0, 1]');
    if (finite(settings.maxWeight) && finite(settings.sectorCap) && Number(settings.sectorCap) < Number(settings.maxWeight)) errors.push('settings.sectorCap cannot be below maxWeight');
    if (!Number.isInteger(settings.rebalanceDays) || settings.rebalanceDays < 5 || settings.rebalanceDays > 63) errors.push('settings.rebalanceDays must be an integer from 5 to 63');
    if (!finite(settings.transactionCostBps) || settings.transactionCostBps < 0 || settings.transactionCostBps > 500) errors.push('settings.transactionCostBps must be from 0 to 500');
  }
  return { ok: errors.length === 0, errors };
}
