/* leaguesPick.js — U21 Phase 1 §2.2/§2.4: consumer-side robustness for two
   data-shape risks the RFC found by inspection in leagues-data.json /
   games-data.json.

   §2.2 — opusScore direction ambiguity: `{ opus: 'away', opusScore: '3-1' }`
   doesn't say whether "3-1" is written home-away or picked-side-opponent —
   U18 found a real case (msi-lb-r2-g2) where the string coincidentally
   matched the actual final score despite the winner being called wrong.
   The RFC's recommended fix is an unambiguous `{ pick: { side, score:
   {home,away} } }` shape, but leagues-data.json is still being written
   nightly by a live scheduled task in the old shape (see Urgent.md U20),
   so force-migrating the live file risks a silent revert on its next run.
   pickedTeam()/pickedScoreLabel() below centralize the derivation so every
   consumer (stats.html) reads it the same correct way today, and are the
   single place to update if/when a future data file adopts the
   unambiguous shape.

   §2.4 — finalsMvp is matched against mvp[].team by exact string equality
   (e.g. "Knight · BLG"); a stray space or a different separator character
   silently breaks the match. matchesMvp() normalizes before comparing. */

/** Which team a series[] entry actually picked. */
export function pickedTeam(s) {
  return s.opus === 'home' ? s.home : s.away;
}

/** Whether the outcome was called correctly (winner side matches the pick). */
export function pickCorrect(s) {
  if (!s || !s.result) return null;
  const actualHome = s.result.home > s.result.away;
  return actualHome === (s.opus === 'home');
}

/** Exact-scoreline hit: requires the outcome to be correct first (U19
    convention) — a string coincidence with the winner called wrong is not
    a hit, regardless of what opusScore happens to equal. */
export function pickExact(s) {
  if (!pickCorrect(s) || !s.result) return false;
  return s.opusScore === `${s.result.home}-${s.result.away}`;
}

function normalizeName(v) {
  return String(v || '').replace(/[·•|/]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Robust match between an mvp[] board entry and a finalsMvp value that may
    be a plain string or a { player, team } object. */
export function matchesMvp(entry, finalsMvp) {
  if (!entry || finalsMvp == null) return false;
  if (typeof finalsMvp === 'object') {
    const entryTeam = normalizeName(entry.team);
    return normalizeName(finalsMvp.player) && entryTeam.includes(normalizeName(finalsMvp.player)) && (!finalsMvp.team || entryTeam.includes(normalizeName(finalsMvp.team)));
  }
  return normalizeName(entry.team) === normalizeName(finalsMvp);
}
