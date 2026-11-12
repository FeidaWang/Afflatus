import { boundedFetch, FeedError } from './bounded-fetch.mjs';

const SERVICE_VERSION = '2023-11-03';

export function azureContainer(value, { name } = {}) {
  let base;
  try {
    base = new URL(value);
  } catch {
    throw new Error('An Azure container SAS URL is required');
  }
  if (base.protocol !== 'https:' || !/^[a-z0-9]{3,24}\.blob\.core\.windows\.net$/.test(base.host) ||
      base.username || base.password || base.hash || !/^\/[a-z0-9-]+\/?$/.test(base.pathname) ||
      (name && base.pathname.replace(/\/$/, '') !== `/${name}`) ||
      !base.searchParams.get('sig') || base.searchParams.has('comp') || base.searchParams.has('restype')) {
    throw new Error('Expected an HTTPS Azure container SAS URL');
  }
  base.pathname = base.pathname.replace(/\/$/, '');
  const urlFor = (path = '', query = {}) => {
    const url = new URL(base);
    if (path) url.pathname += `/${path.split('/').map(encodeURIComponent).join('/')}`;
    const params = new URLSearchParams(query).toString();
    if (params) url.search += `&${params}`;
    return url;
  };

  return {
    get(path, { query, maxBytes, etag, fetchImpl } = {}) {
      return boundedFetch(urlFor(path, query), {
        allowedHosts: [base.host], timeoutMs: 15000, maxBytes, etag, fetchImpl,
        headers: { 'x-ms-version': SERVICE_VERSION },
      });
    },
    async put(path, body, condition, fetchImpl = fetch) {
      let response;
      try {
        response = await fetchImpl(urlFor(path), {
          method: 'PUT',
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
          headers: {
            'x-ms-version': SERVICE_VERSION,
            'x-ms-blob-type': 'BlockBlob',
            'Content-Type': 'application/json',
            ...condition,
          },
          body,
        });
      } catch {
        throw new FeedError('network', 'Snapshot storage connection failed');
      }
      await response.body?.cancel();
      if (response.status === 412) return false;
      if (response.status !== 201) throw new FeedError('http_error', `Snapshot storage returned HTTP ${response.status}`);
      return true;
    },
  };
}
