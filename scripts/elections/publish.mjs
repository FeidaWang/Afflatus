import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publicFeedOpen, publicStorage, readPublicBlob, validPublicDocument, MAX_PUBLIC_BYTES, VEC_EVENT } from './vec-public-store.mjs';

/** Publish the pending snapshots first, then conditionally advance the public pointer. */
export async function publishVecLatest(store, { env = process.env, fetchImpl } = {}) {
  if (!publicFeedOpen(env)) throw new Error('VEC public publication is disabled');
  const storage = publicStorage(env.ELECTION_SNAPSHOT_WRITER_URL);
  const readLocal = async (name) => {
    const bytes = await readFile(join(store, VEC_EVENT, name));
    if (bytes.length > MAX_PUBLIC_BYTES) throw new Error('VEC publication document exceeds the size limit');
    const data = JSON.parse(bytes.toString('utf8'));
    if (!validPublicDocument(name, data)) throw new Error('Invalid local VEC publication document');
    return data;
  };
  const next = await readLocal('latest.json').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!next) return 'waiting';

  const current = await readPublicBlob(storage, 'latest.json', fetchImpl);
  if (current && current.data.revision >= next.revision) {
    if (current.data.revision === next.revision && current.data.snapshotId === next.snapshotId) return 'unchanged';
    throw new Error('The public pointer is ahead of this collector or belongs to a different store');
  }
  if (current && (!current.etag || current.data.updatedAt > next.updatedAt ||
      (next.history[0].publishedAt <= current.data.publishedAt &&
      !next.history.some((entry) => entry.snapshotId === current.data.snapshotId)))) {
    throw new Error('The local store does not continue the published history');
  }
  const known = new Set(current?.data.history.map((entry) => entry.snapshotId));
  for (const { snapshotId } of next.history) {
    if (known.has(snapshotId)) continue;
    const name = `snapshots/${snapshotId}.json`;
    const snapshot = await readLocal(name);
    const wrote = await storage.put(`${VEC_EVENT}/${name}`, JSON.stringify(snapshot), { 'If-None-Match': '*' }, fetchImpl);
    if (!wrote) {
      const existing = await readPublicBlob(storage, name, fetchImpl);
      if (JSON.stringify(existing?.data) !== JSON.stringify(snapshot)) throw new Error('Public snapshot conflicts with local snapshot');
    }
  }
  const condition = current ? { 'If-Match': current.etag } : { 'If-None-Match': '*' };
  const advanced = await storage.put(`${VEC_EVENT}/latest.json`, JSON.stringify(next), condition, fetchImpl);
  if (!advanced) throw new Error('The public pointer changed during publication; retry with the current store');
  return 'published';
}
