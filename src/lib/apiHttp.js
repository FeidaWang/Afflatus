const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,80}$/;

export function getRequestId(req) {
  const incoming = String(req?.headers?.['x-request-id'] || '').trim();
  if (REQUEST_ID_RE.test(incoming)) return incoming;
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `aff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function setApiHeaders(res, requestId) {
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export function sendApiError(res, status, code, requestId, details = {}) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(status).json({
    error: {
      code,
      message: details.message || code,
      ...(Number.isInteger(details.upstreamStatus) ? { upstreamStatus: details.upstreamStatus } : {}),
    },
    requestId,
  });
}

export async function fetchWithTimeout(url, init = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function isAbortError(error) {
  return Boolean(error && (error.name === 'AbortError' || error.code === 'ABORT_ERR'));
}
