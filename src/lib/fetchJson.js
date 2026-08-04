const CACHE_NAME = 'afflatus-json-v1';
const CACHE_TIME_HEADER = 'x-afflatus-cached-at';
const DEFAULT_TIMEOUT_MS = 8000;

const objectWith = (...keys) => (data) => {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level value must be an object'] };
  }
  for (const key of keys) {
    if (!(key in data)) errors.push(`missing "${key}"`);
  }
  return { ok: errors.length === 0, errors };
};

const lazyValidator = (load) => {
  let validatorPromise;
  const prepare = () => {
    validatorPromise ||= load();
    return validatorPromise;
  };
  const validator = async (data) => {
    const validate = await prepare();
    return validate(data);
  };
  validator.prepare = prepare;
  return validator;
};

const validators = {
  sectors: lazyValidator(async () => (await import('./validateSectorsData.js')).validateSectorsData),
  sectorsCompetition: lazyValidator(async () => (await import('./validateSectorsCompetition.js')).validateSectorsCompetition),
  sectorsRivalry: lazyValidator(async () => (await import('./validateSectorsRivalry.js')).validateSectorsRivalry),
  signal: lazyValidator(async () => (await import('./validateSignalEvents.js')).validateSignalEvents),
  leagues: lazyValidator(async () => (await import('./validateLeaguesData.js')).validateLeaguesData),
  games: lazyValidator(async () => (await import('./validateGamesData.js')).validateGamesData),
  novelsIndex: lazyValidator(async () => (await import('./validateNovelsData.js')).validateNovelsIndex),
  novelBook: lazyValidator(async () => (await import('./validateNovelsData.js')).validateNovelBook),
  arenaUniverse: lazyValidator(async () => (await import('./validateArenaUniverse.js')).validateArenaUniverse),
  arenaPicks: lazyValidator(async () => (await import('./validateArenaPicks.js')).validateArenaPicks),
  arenaQuantModel: lazyValidator(async () => (await import('./validateArenaQuantModel.js')).validateArenaQuantModel),
  arenaDigest: lazyValidator(async () => (await import('./validateArenaDigest.js')).validateArenaDigest),
};

const validateHistory = (data) => ({
  ok: Boolean(data && data.status === 'ok' && Array.isArray(data.values)),
  errors: data && data.status === 'ok' && Array.isArray(data.values)
    ? []
    : ['history payload must have status="ok" and a values array'],
});

const validateQuote = (data) => ({
  ok: Boolean(data && typeof data === 'object' && Number.isFinite(Number(data.c))),
  errors: data && typeof data === 'object' && Number.isFinite(Number(data.c))
    ? []
    : ['quote payload must contain a finite current price "c"'],
});

const STATIC_RESOURCES = Object.freeze({
  sectors: { url: '/sectors-data.json', freshness: 60 * 60_000, validate: validators.sectors },
  'sectors-ecosystem': { url: '/sectors-ecosystem.json?v=4', freshness: 6 * 60 * 60_000, validate: objectWith('updated', 'nodes', 'edges', 'chapters') },
  'sectors-competition': { url: '/sectors-competition.json?v=1', freshness: 6 * 60 * 60_000, validate: validators.sectorsCompetition },
  'sectors-rivalry': { url: '/sectors-rivalry.json?v=1', freshness: 6 * 60 * 60_000, validate: validators.sectorsRivalry },
  signal: { url: '/signal-events.json', freshness: 15 * 60_000, validate: validators.signal },
  leagues: { url: '/leagues-data.json', freshness: 60 * 60_000, validate: validators.leagues },
  games: { url: '/games-data.json', freshness: 60 * 60_000, validate: validators.games },
  'novels-index': { url: '/novels-index.json', freshness: 5 * 60_000, validate: validators.novelsIndex },
  'arena-universe': { url: '/arena-universe.json', freshness: 60 * 60_000, validate: validators.arenaUniverse },
  'arena-quant-model': { url: '/arena-quant-model.json', freshness: 60 * 60_000, validate: validators.arenaQuantModel },
  'arena-picks': { url: '/arena-picks.json', freshness: 5 * 60_000, validate: validators.arenaPicks },
  'arena-digest': { url: '/arena-daily-digest.json', freshness: 5 * 60_000, validate: validators.arenaDigest },
  'arena-news': { url: '/arena-news.json', freshness: 5 * 60_000, validate: objectWith('date', 'items', 'prices') },
  'arena-ledger': { url: '/arena-ledger.json', freshness: 5 * 60_000, validate: objectWith('season', 'models', 'bench') },
  transits: { url: '/transits-daily.json', freshness: 6 * 60 * 60_000, validate: objectWith('date', 'planets') },
});

const memory = new Map();
const inflight = new Map();

export class JsonDataError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'JsonDataError';
    this.code = code;
    this.key = details.key || '';
    this.url = details.url || '';
    this.status = details.status || 0;
    this.retriable = details.retriable !== false;
    this.validationErrors = details.validationErrors || [];
    if (details.cause) this.cause = details.cause;
  }
}

function normalizeTicker(value) {
  const ticker = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{1,5}([.-][A-Z]{1,2})?$/.test(ticker)) {
    throw new JsonDataError('INVALID_KEY', `Invalid ticker in JSON resource key: ${value}`, { retriable: false });
  }
  return ticker;
}

function resolveResource(key) {
  if (STATIC_RESOURCES[key]) return { key, ...STATIC_RESOURCES[key] };

  if (key.startsWith('novel:')) {
    const id = key.slice(6);
    if (!/^[a-z0-9-]{1,80}$/.test(id)) {
      throw new JsonDataError('INVALID_KEY', `Invalid novel resource key: ${key}`, { key, retriable: false });
    }
    return { key, url: `/novels/${id}.json`, freshness: 60 * 60_000, validate: validators.novelBook };
  }

  if (key.startsWith('quote:')) {
    const symbol = normalizeTicker(key.slice(6));
    return {
      key,
      url: `/api/quote?symbol=${encodeURIComponent(symbol)}`,
      freshness: 12_000,
      validate: validateQuote,
      persistent: false,
    };
  }

  if (key.startsWith('history:')) {
    const [, rawSymbol, interval = '1day', rawSize = '250'] = key.split(':');
    const symbol = normalizeTicker(rawSymbol);
    if (!/^[0-9a-z]{1,6}$/.test(interval)) {
      throw new JsonDataError('INVALID_KEY', `Invalid interval in JSON resource key: ${key}`, { key, retriable: false });
    }
    const outputsize = Math.max(1, Math.min(5000, Number.parseInt(rawSize, 10) || 250));
    return {
      key,
      url: `/api/history?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}`,
      freshness: 60 * 60_000,
      validate: validateHistory,
      persistent: true,
    };
  }

  throw new JsonDataError('UNKNOWN_KEY', `Unknown JSON resource key: ${key}`, { key, retriable: false });
}

function abortError(resource) {
  return new JsonDataError('ABORTED', `JSON request aborted: ${resource.key}`, {
    key: resource.key,
    url: resource.url,
    retriable: false,
  });
}

function raceAbort(promise, signal, resource) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError(resource));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError(resource));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function validateData(resource, data) {
  let result;
  try {
    result = await resource.validate(data);
  } catch (cause) {
    throw new JsonDataError('SCHEMA', `Schema validator failed for ${resource.key}`, {
      key: resource.key,
      url: resource.url,
      retriable: false,
      cause,
    });
  }
  if (result === true || (result && result.ok)) return data;
  const validationErrors = Array.isArray(result?.errors) ? result.errors : ['schema rejected payload'];
  throw new JsonDataError('SCHEMA', `Invalid JSON payload for ${resource.key}: ${validationErrors.join('; ')}`, {
    key: resource.key,
    url: resource.url,
    retriable: false,
    validationErrors,
  });
}

async function cacheRead(resource) {
  if (resource.persistent === false || typeof caches === 'undefined') return null;
  // Load the route-specific validator while CacheStorage resolves. This keeps
  // schema validation off the initial bundle without adding a serial network
  // round trip before cached data can render.
  resource.validate.prepare?.();
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(resource.url);
    if (!response) return null;
    const data = await validateData(resource, await response.json());
    return { data, at: Number(response.headers.get(CACHE_TIME_HEADER)) || 0 };
  } catch {
    return null;
  }
}

async function cacheWrite(resource, entry) {
  if (resource.persistent === false || typeof caches === 'undefined' || typeof Response === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify(entry.data), {
      headers: {
        'content-type': 'application/json',
        [CACHE_TIME_HEADER]: String(entry.at),
      },
    });
    await cache.put(resource.url, response);
  } catch {
    // CacheStorage is an optional acceleration layer; data delivery succeeded.
  }
}

async function networkLoad(resource, { headers, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Fetch payload and validator chunk concurrently. Dynamic validators remain
  // route-scoped, but data rendering no longer waits for a second RTT after
  // the JSON response has already arrived.
  resource.validate.prepare?.();
  try {
    const response = await fetch(resource.url, {
      headers,
      signal: controller.signal,
      cache: resource.url.startsWith('/api/') ? 'no-store' : 'default',
    });
    if (!response.ok) {
      throw new JsonDataError('HTTP', `HTTP ${response.status} loading ${resource.key}`, {
        key: resource.key,
        url: resource.url,
        status: response.status,
        retriable: response.status >= 500 || response.status === 408 || response.status === 429,
      });
    }
    let data;
    try {
      data = await response.json();
    } catch (cause) {
      throw new JsonDataError('PARSE', `Invalid JSON returned for ${resource.key}`, {
        key: resource.key,
        url: resource.url,
        cause,
      });
    }
    await validateData(resource, data);
    const entry = { data, at: Date.now() };
    memory.set(resource.url, entry);
    void cacheWrite(resource, entry);
    return data;
  } catch (error) {
    if (error instanceof JsonDataError) throw error;
    if (controller.signal.aborted) {
      throw new JsonDataError('TIMEOUT', `JSON request timed out after ${timeoutMs}ms: ${resource.key}`, {
        key: resource.key,
        url: resource.url,
      });
    }
    throw new JsonDataError('NETWORK', `Network error loading ${resource.key}`, {
      key: resource.key,
      url: resource.url,
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
}

function sharedNetworkLoad(resource, options) {
  const requestKey = `${resource.url}\n${JSON.stringify(options.headers || {})}`;
  if (!inflight.has(requestKey)) {
    const request = networkLoad(resource, options).finally(() => inflight.delete(requestKey));
    inflight.set(requestKey, request);
  }
  return inflight.get(requestKey);
}

/**
 * Load a registered JSON resource.
 *
 * Fresh entries return immediately. Stale entries return immediately and
 * trigger a de-duplicated background revalidation. A caller AbortSignal only
 * cancels that caller's wait; shared work continues for other consumers.
 *
 * @param {string} key registered resource key
 * @param {{signal?: AbortSignal, freshness?: number, timeoutMs?: number, headers?: Record<string,string>, forceRefresh?: boolean}} options
 */
export async function fetchJson(key, options = {}) {
  const resource = resolveResource(key);
  const freshness = Number.isFinite(options.freshness)
    ? Math.max(0, options.freshness)
    : resource.freshness;
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(250, options.timeoutMs)
    : DEFAULT_TIMEOUT_MS;
  const loadOptions = { headers: options.headers, timeoutMs };

  if (!options.forceRefresh) {
    const cached = memory.get(resource.url) || await cacheRead(resource);
    if (cached) {
      memory.set(resource.url, cached);
      const age = Date.now() - cached.at;
      if (age > freshness) void sharedNetworkLoad(resource, loadOptions).catch(() => {});
      return raceAbort(Promise.resolve(cached.data), options.signal, resource);
    }
  }

  return raceAbort(sharedNetworkLoad(resource, loadOptions), options.signal, resource);
}

export function clearJsonCacheForTests() {
  memory.clear();
  inflight.clear();
}

export const JSON_RESOURCE_KEYS = Object.freeze(Object.keys(STATIC_RESOURCES));
