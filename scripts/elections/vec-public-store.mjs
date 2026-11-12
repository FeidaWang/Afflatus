import { VEC_POLLS_CLOSE } from '../../src/config/electionSources.js';
import { pointerErrors, snapshotErrors } from '../../src/lib/electionResults.js';
import { azureContainer } from './azure-blob.mjs';

export const VEC_EVENT = 'vic-2026';
const SNAPSHOT_ID = /^vic-2026-\d{8}T\d{9}Z-[a-f0-9]{8}$/;
const SNAPSHOT_PATH = /^snapshots\/(vic-2026-\d{8}T\d{9}Z-[a-f0-9]{8})\.json$/;
const SOURCE = 'vec-2026';
export const MAX_PUBLIC_BYTES = 4 * 1024 * 1024;
const atOrAfterClose = (at) => Date.parse(at) >= Date.parse(VEC_POLLS_CLOSE);

export const publicFeedOpen = (env, now = Date.now()) =>
  env.VEC_PUBLIC_RESULTS === '1' && now >= Date.parse(VEC_POLLS_CLOSE);

export const publicStorage = (url) => azureContainer(url, { name: 'afflatus-elections' });
export const publicFile = (name) => typeof name === 'string' && (name === 'latest.json' || SNAPSHOT_PATH.test(name));

export function validPublicDocument(name, data) {
  if (!publicFile(name) || !data || data.eventId !== VEC_EVENT || data.isSynthetic !== false ||
      data.sourceIds?.length !== 1 || data.sourceIds[0] !== SOURCE || !atOrAfterClose(data.publishedAt)) return false;
  if (name === 'latest.json') {
    return !pointerErrors(data).length && data.revision > 0 && SNAPSHOT_ID.test(data.snapshotId) &&
      data.sources.length === 1 && data.sources[0].sourceId === SOURCE &&
      data.history.at(-1)?.snapshotId === data.snapshotId &&
      data.history.every((entry) => entry.isSynthetic === false && SNAPSHOT_ID.test(entry.snapshotId) && atOrAfterClose(entry.publishedAt));
  }
  return data.mode === 'live' && data.snapshotId === SNAPSHOT_PATH.exec(name)[1] &&
    atOrAfterClose(data.sourcePublishedAt) && !snapshotErrors(data).length &&
    data.races.length > 0 && data.races.every((race) =>
      race.provenance.sourceId === SOURCE && atOrAfterClose(race.provenance.publishedAt));
}

export async function readPublicBlob(storage, name, fetchImpl) {
  if (!publicFile(name)) throw new Error('Unknown public result file');
  let response;
  try {
    response = await storage.get(`${VEC_EVENT}/${name}`, { maxBytes: MAX_PUBLIC_BYTES, fetchImpl });
  } catch (error) {
    if (error.kind === 'gone') return null;
    throw error;
  }
  const data = JSON.parse(response.bytes.toString('utf8'));
  if (!validPublicDocument(name, data)) throw new Error('Invalid VEC publication document');
  return { data, etag: response.etag };
}
