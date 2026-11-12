/* One outbound request with every limit the feed rules ask for: host allowlist,
   timeout, byte cap, conditional headers. Failures become a FeedError whose kind
   the collector turns into backoff. No credentials are logged here. */
export class FeedError extends Error {
  constructor(kind, message, { retryAfterSeconds = null } = {}) {
    super(message);
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function retryAfter(headers, now) {
  const value = headers.get('retry-after');
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, Math.round((at - now) / 1000));
}

export async function boundedFetch(url, {
  allowedHosts, timeoutMs, maxBytes, etag = null, lastModified = null, headers = {}, now = Date.now(), fetchImpl = fetch,
}) {
  const parsed = new URL(url);
  if (!allowedHosts.includes(parsed.host)) throw new FeedError('host_blocked', `${parsed.host} is not on the allowlist`);
  const request = { ...headers };
  if (etag) request['If-None-Match'] = etag;
  if (lastModified) request['If-Modified-Since'] = lastModified;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // A redirect could leave the allowlist, so it is an error here rather than followed.
    const response = await fetchImpl(url, { headers: request, redirect: 'manual', signal: controller.signal });
    const meta = { status: response.status, etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified') };
    if (response.status === 304) return { ...meta, bytes: null };
    if (response.status === 429 || response.status === 503) {
      throw new FeedError('rate_limited', `HTTP ${response.status}`, { retryAfterSeconds: retryAfter(response.headers, now) });
    }
    if (response.status === 404 || response.status === 410) throw new FeedError('gone', `HTTP ${response.status}`);
    if (response.status !== 200) throw new FeedError('http_error', `HTTP ${response.status}`);
    const declared = Number(response.headers.get('content-length'));
    if (declared > maxBytes) throw new FeedError('too_large', `Declared ${declared} bytes, over ${maxBytes}`);

    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > maxBytes) {
        controller.abort();
        throw new FeedError('too_large', `Body passed ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(chunk));
    }
    return { ...meta, bytes: Buffer.concat(chunks) };
  } catch (error) {
    if (error instanceof FeedError) throw error;
    if (error.name === 'AbortError') throw new FeedError('timeout', `No complete response in ${timeoutMs} ms`);
    throw new FeedError('network', 'Upstream connection failed');
  } finally {
    clearTimeout(timer);
  }
}
