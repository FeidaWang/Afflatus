import picks from '../../public/arena-picks.json' with { type: 'json' };
import quantModel from '../../public/arena-quant-model.json' with { type: 'json' };
import { resolveAllowlist } from './arenaAccess.js';
import { JOURNAL_SYMBOLS } from '../features/arena-journal/journalStocks.js';

/**
 * Build the anonymous Arena API allowlist from the exact data shipped with the
 * deployment. Importing the manifests keeps this decision independent of an
 * HTTP round-trip to the deployment URL, which may itself be protected by
 * Vercel Deployment Protection.
 *
 * Arena data updates are committed and deployed together, so the function
 * bundle and the public JSON files always advance as one immutable release.
 */
export function getPublishedArenaAllowlist() {
  const allowlist = resolveAllowlist({ picks, quantModel });
  // The Arena journal's fixed company list is always quotable, independent of
  // whichever symbols the picks and model manifests currently publish.
  for (const symbol of JOURNAL_SYMBOLS) allowlist.add(symbol);
  return allowlist;
}
