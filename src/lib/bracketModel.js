/* ============================================================
   BRACKET MODEL — U38. Pure functions that turn games-data.json's
   knockout shape (each stage's matches live as the NEXT stage slot's
   `legs`) + record.log score labels into a flat, render-agnostic
   stage list for the Apple-Sports-style stage slider.

   Kept generic on purpose: leagues (Esports World Cup / Season 16)
   will feed the same stage model from its own adapter (roadmap §7.4
   follow-up) — the slider UI consumes ONLY this model shape.

   Model shape:
     [{ key, label_en, label_zh, matches: [{
         id, date?, venue_en?, venue_zh?,
         home: { name_en, name_zh, flag, code },
         away: { ... },
         winner: 'home'|'away'|null,
         score: { h, a, extra } | null      // extra: '(AET)'/'(… pens)' text
     }]}]
   ============================================================ */

// 3-letter display codes (Apple Sports style). Fallback = first 3 letters.
const CODES = {
  France: 'FRA', Morocco: 'MAR', Switzerland: 'SUI', Colombia: 'COL',
  Argentina: 'ARG', Egypt: 'EGY', 'United States': 'USA', USA: 'USA',
  Belgium: 'BEL', Spain: 'ESP', Portugal: 'POR', Mexico: 'MEX',
  England: 'ENG', Brazil: 'BRA', Norway: 'NOR', Paraguay: 'PAR',
  Canada: 'CAN', Netherlands: 'NED', 'South Africa': 'RSA', Germany: 'GER',
  Sweden: 'SWE', Croatia: 'CRO', Austria: 'AUT', 'Bosnia-Herzegovina': 'BIH',
  Senegal: 'SEN', Japan: 'JPN', "Côte d'Ivoire": 'CIV', Ecuador: 'ECU',
  Australia: 'AUS', Türkiye: 'TUR', Qatar: 'QAT', Scotland: 'SCO',
  Haiti: 'HAI', 'Korea Republic': 'KOR', Czechia: 'CZE',
};
export function codeFor(name) {
  if (!name) return '???';
  return CODES[name] || name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '???';
}

/* Parse "France 2-0 Morocco", "Switzerland 0-0 Colombia (Switzerland win
   4-3 pens)", "Norway 1-2 England (AET)". Returns { h, a, extra } oriented
   to the LABEL's own left/right team order, plus the left team's name so
   callers can re-orient against their home/away if needed. */
export function parseScoreLabel(label) {
  if (!label) return null;
  const m = label.match(/^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+?)(?:\s*\((.+)\))?$/);
  if (!m) return null;
  return { left: m[1].trim(), h: +m[2], a: +m[3], right: m[4].trim(), extra: m[5] ? `(${m[5]})` : '' };
}

// score for a leg, re-oriented to the leg's home/away (by English name).
function scoreForLeg(leg, logById) {
  const e = logById.get(leg.__id);
  if (!e) return null;
  const p = parseScoreLabel(e.label_en);
  if (!p) return null;
  if (p.left === leg.away) return { h: p.a, a: p.h, extra: p.extra }; // label reversed vs leg
  return { h: p.h, a: p.a, extra: p.extra };
}

const team = (leg, side) => ({
  name_en: leg[side], name_zh: leg[side + '_zh'] || leg[side],
  flag: leg[side + 'Flag'] || '', code: codeFor(leg[side]),
});

function matchFromLeg(leg, idKey, logById, slotMeta = {}) {
  const withId = { ...leg, __id: leg[idKey] };
  return {
    id: leg[idKey] || null,
    ...slotMeta,
    home: team(leg, 'home'), away: team(leg, 'away'),
    winner: leg.winner || null,
    score: scoreForLeg(withId, logById),
  };
}

const winnerTeam = (leg) => leg.winner ? team(leg, leg.winner) : null;

/* buildWcStages(bracket, recordLog) — tolerates partially-played
   tournaments: stages appear only when their matches exist in the data. */
export function buildWcStages(bracket, recordLog = []) {
  if (!bracket) return [];
  const logById = new Map((recordLog || []).map((e) => [e.id, e]));
  const stages = [];
  const flat = (slots, idKey) => (slots || []).flatMap((slot) =>
    (slot.legs || []).map((leg) => matchFromLeg(leg, idKey, logById)));

  const r16 = flat(bracket.qf, 'r16Id');
  if (r16.length) stages.push({ key: 'r16', label_en: 'R16', label_zh: '16强', matches: r16 });

  const qf = flat(bracket.sf, 'qfId');
  if (qf.length) stages.push({ key: 'qf', label_en: 'QF', label_zh: '8强', matches: qf });

  const sf = flat(bracket.final, 'sfId');
  if (sf.length) stages.push({ key: 'sf', label_en: 'SF', label_zh: '4强', matches: sf });

  // the final itself = pairing of the final slot's leg winners
  const fslot = (bracket.final || [])[0];
  if (fslot && (fslot.legs || []).length === 2) {
    const a = winnerTeam(fslot.legs[0]), b = winnerTeam(fslot.legs[1]);
    if (a && b) {
      const id = 'wc-final';
      const e = logById.get(id);
      const p = e ? parseScoreLabel(e.label_en) : null;
      let score = null, winner = null;
      if (p) {
        score = p.left === b.name_en ? { h: p.a, a: p.h, extra: p.extra } : { h: p.h, a: p.a, extra: p.extra };
        winner = score.h === score.a ? (e.pick_en && e.ok != null ? null : null) : (score.h > score.a ? 'home' : 'away');
        // penalty deciders: extra text names the winner
        if (score.h === score.a && score.extra) winner = score.extra.includes(a.name_en) ? 'home' : (score.extra.includes(b.name_en) ? 'away' : null);
      }
      stages.push({
        key: 'f', label_en: 'F', label_zh: '决赛',
        matches: [{ id, date: fslot.date, venue_en: fslot.venue_en, venue_zh: fslot.venue_zh, home: a, away: b, winner, score, isFinal: true }],
      });
    }
  }
  return stages;
}
