// Build metadata only; this does not certify the model's geometry or provenance.
export function validateShipManifest(data) {
  const errors = [];
  for (const key of ['generator', 'notes']) {
    if (typeof data?.[key] !== 'string' || !data[key].trim()) errors.push(`${key} must be nonempty text`);
  }
  for (const key of ['seed', 'referenceImages']) {
    if (!Number.isSafeInteger(data?.[key]) || data[key] < 0) errors.push(`${key} must be a nonnegative integer`);
  }
  for (const key of ['nominalLengthMeters', 'materials']) {
    if (!Number.isFinite(data?.[key]) || data[key] <= 0) errors.push(`${key} must be positive`);
  }
  for (const variant of ['desktop', 'mobile']) {
    for (const key of ['triangles', 'objects', 'bytes']) {
      if (!Number.isSafeInteger(data?.[variant]?.[key]) || data[variant][key] <= 0) errors.push(`${variant}.${key} must be a positive integer`);
    }
  }
  return { ok: errors.length === 0, errors };
}
