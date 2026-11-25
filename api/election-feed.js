import { getRequestId, sendApiError, setApiHeaders } from '../src/lib/apiHttp.js';
import { isVecElectionNight } from '../src/config/electionSources.js';
import { publicFeedOpen, publicFile, publicStorage, readPublicBlob, VEC_EVENT } from '../scripts/elections/vec-public-store.mjs';

export default async function handler(req, res) {
  const requestId = getRequestId(req);
  setApiHeaders(res, requestId);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', requestId);
  }
  const { event, file } = req.query || {};
  if (event !== VEC_EVENT || !publicFile(file) || !publicFeedOpen(process.env)) {
    return sendApiError(res, 404, 'RESULT_UNAVAILABLE', requestId);
  }

  try {
    const storage = publicStorage(process.env.ELECTION_SNAPSHOT_READER_URL);
    const result = await readPublicBlob(storage, file);
    if (!result) return sendApiError(res, 404, 'RESULT_UNAVAILABLE', requestId);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    const ttl = file === 'latest.json' ? (isVecElectionNight() ? 10 : 20) : 120;
    res.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${ttl}`);
    return res.status(200).json(result.data);
  } catch {
    return sendApiError(res, 503, 'RESULT_FEED_UNAVAILABLE', requestId);
  }
}
