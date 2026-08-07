import picks from '../../public/arena-picks.json' with { type: 'json' };
import quantModel from '../../public/arena-quant-model.json' with { type: 'json' };
import { resolveAllowlist } from './arenaAccess.js';

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
  return resolveAllowlist({ picks, quantModel });
}
