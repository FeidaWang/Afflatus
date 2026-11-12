import { azureContainer } from './azure-blob.mjs';
import { FeedError } from './bounded-fetch.mjs';
import { MAX_ZIP_BYTES } from './collector.mjs';
import { child, childrenOf, parseXml } from './safe-xml.mjs';

const LIST_LIMIT = 4 * 1024 * 1024;
const MAX_LIST_PAGES = 12;

/** A fresh listing per collector run, shared by both houses. */
export function vecAzureTransport(sasUrl, { prefix = 'State2026mediafileverbose', fetchImpl } = {}) {
  const container = azureContainer(sasUrl, { name: 'results' });
  let listing;

  async function list() {
    const blobs = [];
    let marker = '';
    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const query = { restype: 'container', comp: 'list', prefix, maxresults: '2000' };
      if (marker) query.marker = marker;
      const response = await container.get('', { query, maxBytes: LIST_LIMIT, fetchImpl });
      let root;
      try {
        root = parseXml(response.bytes.toString('utf8'));
      } catch {
        throw new FeedError('malformed', 'Invalid Azure results listing');
      }
      const entries = child(root, 'Blobs');
      const next = child(root, 'NextMarker');
      if (root.name !== 'EnumerationResults' || !entries || !next) {
        throw new FeedError('schema_drift', 'Unexpected Azure results listing');
      }
      for (const blob of childrenOf(entries, 'Blob')) {
        const path = child(blob, 'Name')?.text;
        if (!path || !path.startsWith(prefix) || path.split('/').some((part) => !part || part === '..' || part === '.')) continue;
        const etag = child(child(blob, 'Properties'), 'Etag')?.text || null;
        blobs.push({ path, fileName: path.split('/').at(-1), etag });
      }
      marker = next.text;
      if (!marker) return blobs;
    }
    throw new FeedError('too_large', 'Azure results listing exceeded the page limit');
  }

  return async (feed, previous) => {
    listing ??= list();
    let latest;
    for (const blob of await listing) {
      const match = feed.pattern.exec(blob.fileName);
      if (!match) continue;
      const stamp = match[1] + match[2];
      if (stamp === latest?.stamp && blob.path !== latest.path) {
        throw new FeedError('wrong_identity', 'Multiple VEC files share the newest timestamp');
      }
      if (!latest || stamp > latest.stamp) latest = { ...blob, stamp };
    }
    if (!latest) throw new FeedError('gone', `No ${feed.key} ZIP in the VEC container`);
    const sameFile = previous?.fileName === latest.fileName;
    if (sameFile && latest.etag && previous.etag === latest.etag) return { status: 304 };
    const response = await container.get(latest.path, {
      maxBytes: MAX_ZIP_BYTES,
      etag: sameFile ? previous.etag : null,
      fetchImpl,
    });
    return { ...response, fileName: latest.fileName };
  };
}
