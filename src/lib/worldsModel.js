// Worlds 2026 probability model — pure functions, no DOM/fetch/Date.now.
// See docs/superpowers/specs/2026-10-25-worlds-2026-odds-design.md §5.

/** Regional seed Elo for the 16 Worlds 2026 teams. */
export const TEAM_SEED_ELO = Object.freeze({
  GEN: 1750, HLE: 1700, T1: 1650, DK: 1650,
  BLG: 1750, TES: 1700, AL: 1650, IG: 1650,
  G2: 1600, MKOI: 1550, KC: 1550, TL: 1600,
  LYON: 1550, CFO: 1600, TSW: 1550, LOS: 1500,
});

const ROLE_PRIOR = { mid: 0.30, adc: 0.25, jng: 0.20, top: 0.15, sup: 0.10 };

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Standard 400-point Elo logistic: P(A beats B in one game). */
export function eloExpected(rA, rB) {
  return 1 / (1 + 10 ** ((rB - rA) / 400));
}

/** Apply `games` ([{winner, loser}]) in order; returns a new ratings object. */
export function updateElo(ratings, games, K = 40) {
  const next = { ...ratings };
  for (const { winner, loser } of games) {
    const e = eloExpected(next[winner], next[loser]);
    next[winner] += K * (1 - e);
    next[loser] -= K * (1 - e);
  }
  return next;
}

/** Series win probability from a constant per-game probability p. */
export function seriesWinProbFromGame(p, bo) {
  if (bo === 3) return p * p * (3 - 2 * p);
  if (bo === 5) return p * p * p * (10 - 15 * p + 6 * p * p);
  return p;
}

/** Inverse of seriesWinProbFromGame by bisection on [0.001, 0.999]. */
export function gameProbFromSeries(P, bo) {
  if (bo !== 3 && bo !== 5) return P;
  let lo = 0.001;
  let hi = 0.999;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (seriesWinProbFromGame(mid, bo) < P) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 0.6·market + 0.4·Elo when a finite market probability exists, else Elo. */
export function blendGameProb({ pMarket, pElo }) {
  return Number.isFinite(pMarket) ? 0.6 * pMarket + 0.4 * pElo : pElo;
}

/** Fearless-draft depth edge for the home side, clamped to ±0.05. */
export function fearlessDelta(depthHome, depthAway) {
  return clamp(0.01 * (depthHome - depthAway), -0.05, 0.05);
}

/** Enumerate game sequences: game 1 at p, later games at clamp(p+delta). Scores are home-away. */
export function enumerateSeries(p, bo, delta = 0) {
  const need = Math.ceil(bo / 2);
  const pLater = clamp(p + delta, 0.01, 0.99);
  const scores = {};
  const walk = (hw, aw, prob) => {
    if (hw === need || aw === need) {
      const key = `${hw}-${aw}`;
      scores[key] = (scores[key] || 0) + prob;
      return;
    }
    const q = hw + aw === 0 ? p : pLater;
    walk(hw + 1, aw, prob * q);
    walk(hw, aw + 1, prob * (1 - q));
  };
  walk(0, 0, 1);
  let pHome = 0;
  let pAway = 0;
  let best = { score: '', p: -1 };
  for (const [score, prob] of Object.entries(scores)) {
    if (Number(score.split('-')[0]) === need) pHome += prob; else pAway += prob;
    if (prob > best.p) best = { score, p: prob };
  }
  return { pWin: [pHome, pAway], scores, best };
}

/** Decimal odds (2dp, floor 1.01) implied by a [home, away] probability pair. */
export function impliedOdds(pWin) {
  return pWin.map((p) => Math.max(1.01, Math.round(100 / p) / 100));
}

/** Bounded manual adjustment: clamped probability when |adj| ≤ 0.05, else null. */
export function applyAdjustment(pWinHome, adj) {
  if (!(Math.abs(adj) <= 0.05)) return null;
  return clamp(pWinHome + adj, 0.01, 0.99);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Seeded Monte Carlo of the remaining Swiss rounds + Bo5 bracket; returns { CODE: percent } summing to 100.0. */
export function simulateChampion({ teams, ratings, scheduled = [], runs = 10000, seed = 1 }) {
  const rng = mulberry32(seed);
  const n = teams.length;
  const codes = teams.map((t) => t.code);
  const idx = new Map(codes.map((c, i) => [c, i]));
  const pGame = codes.map((a) => codes.map((b) => eloExpected(ratings[a], ratings[b])));
  const sched = scheduled
    .filter((s) => idx.has(s.home) && idx.has(s.away))
    .map((s) => ({ h: idx.get(s.home), a: idx.get(s.away), p: s.pWinHome }));
  const titles = new Array(n).fill(0);
  const w = new Array(n);
  const l = new Array(n);
  const opp = new Array(n);
  const active = (i) => w[i] < 3 && l[i] < 3;
  let played = false;

  const playSwiss = (h, a, pHome) => {
    played = true;
    opp[h] |= 1 << a;
    opp[a] |= 1 << h;
    if (rng() < pHome) { w[h]++; l[a]++; } else { w[a]++; l[h]++; }
  };
  const swissProb = (h, a) => {
    const bo = w[h] === 2 || l[h] === 2 || w[a] === 2 || l[a] === 2 ? 3 : 1;
    return seriesWinProbFromGame(pGame[h][a], bo);
  };
  // Pair a shuffled record group greedily, avoiding previous opponents; returns the odd leftover or -1.
  const pairGroup = (group) => {
    while (group.length > 1) {
      const h = group.shift();
      let k = group.findIndex((x) => !(opp[h] & (1 << x)));
      if (k < 0) k = 0;
      const a = group.splice(k, 1)[0];
      playSwiss(h, a, swissProb(h, a));
    }
    return group.length ? group[0] : -1;
  };

  for (let run = 0; run < runs; run++) {
    for (let i = 0; i < n; i++) {
      w[i] = teams[i].status === 'advanced' ? 3 : teams[i].w;
      l[i] = teams[i].status === 'eliminated' ? 3 : teams[i].l;
      opp[i] = 0;
    }
    const schedDone = new Array(sched.length).fill(false);
    while (codes.some((_, i) => active(i))) {
      let paired = 0;
      played = false;
      sched.forEach((s, k) => {
        if (schedDone[k] || !active(s.h) || !active(s.a) || (paired & (1 << s.h)) || (paired & (1 << s.a))) return;
        schedDone[k] = true;
        paired |= (1 << s.h) | (1 << s.a);
        playSwiss(s.h, s.a, s.p);
      });
      const groups = new Map();
      for (let i = 0; i < n; i++) {
        if (!active(i) || (paired & (1 << i))) continue;
        const key = w[i] * 4 + l[i];
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(i);
      }
      const leftovers = [];
      for (const key of [...groups.keys()].sort((x, y) => x - y)) {
        const rest = pairGroup(shuffle(groups.get(key), rng));
        if (rest >= 0) leftovers.push(rest);
      }
      const lone = pairGroup(shuffle(leftovers, rng));
      // A lone active team with nobody to play (inconsistent input): coin-flip it out of the loop.
      if (lone >= 0 && !played) { if (rng() < 0.5) w[lone]++; else l[lone]++; }
    }

    const qualifiers = codes.map((_, i) => i).filter((i) => w[i] === 3);
    const byLoss = (k) => qualifiers.filter((i) => l[i] === k);
    let bracket;
    if (qualifiers.length === 8 && byLoss(0).length === 2 && byLoss(1).length === 3 && byLoss(2).length === 3) {
      const top = byLoss(0);
      const low = shuffle(byLoss(2), rng);
      const rest = shuffle([...byLoss(1), low[2]], rng);
      bracket = [top[0], low[0], top[1], low[1], ...rest];
    } else {
      bracket = shuffle(qualifiers, rng);
    }
    while (bracket.length > 1) {
      const next = [];
      for (let i = 0; i + 1 < bracket.length; i += 2) {
        const h = bracket[i];
        const a = bracket[i + 1];
        next.push(rng() < seriesWinProbFromGame(pGame[h][a], 5) ? h : a);
      }
      if (bracket.length % 2) next.push(bracket[bracket.length - 1]);
      bracket = next;
    }
    if (bracket.length) titles[bracket[0]]++;
  }

  const pct = titles.map((t) => Math.round((t / runs) * 1000) / 10);
  const sum = pct.reduce((x, y) => x + y, 0);
  const top = pct.indexOf(Math.max(...pct));
  pct[top] = Math.round((pct[top] + 100 - sum) * 10) / 10;
  return Object.fromEntries(codes.map((c, i) => [c, pct[i]]));
}

/** Per-team MVP weights: role prior × mean stat ratio vs team means, normalised to 1 within each team. */
export function mvpWeights(players) {
  const STATS = ['kda', 'kp', 'dpm'];
  const byTeam = new Map();
  for (const p of players) {
    if (!byTeam.has(p.teamCode)) byTeam.set(p.teamCode, []);
    byTeam.get(p.teamCode).push(p);
  }
  const out = [];
  for (const roster of byTeam.values()) {
    const mean = {};
    for (const s of STATS) {
      const vals = roster.map((p) => p[s]).filter(Number.isFinite);
      mean[s] = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
    }
    const raw = roster.map((p) => {
      const ratios = STATS.map((s) => (Number.isFinite(p[s]) && mean[s] > 0 ? p[s] / mean[s] : 1));
      return (ROLE_PRIOR[p.role] ?? 0.2) * (ratios.reduce((x, y) => x + y, 0) / 3);
    });
    const total = raw.reduce((x, y) => x + y, 0);
    roster.forEach((p, i) => out.push({ player: p.player, teamCode: p.teamCode, w: total > 0 ? raw[i] / total : 0 }));
  }
  return out;
}

/** Top-6 finals-MVP board: P(team champion) × w(player), renormalised to 100 (1dp). */
export function mvpBoard(champion, weights) {
  const rows = weights
    .map((x) => ({ player: x.player, teamCode: x.teamCode, prob: (champion[x.teamCode] || 0) * x.w }))
    .filter((r) => r.prob > 0)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 6);
  const total = rows.reduce((x, r) => x + r.prob, 0);
  return rows.map((r) => ({ ...r, prob: Math.round((r.prob / total) * 1000) / 10 }));
}

/** Hit / exact / Brier for a series with both `pick` and `result`; null otherwise. */
export function scoreSeries(series) {
  const { pick, result } = series;
  if (!pick || !result) return null;
  const winner = result.home > result.away ? 'home' : 'away';
  const hit = pick.side === winner;
  const q = pick.pWin[pick.side === 'home' ? 0 : 1];
  return {
    hit,
    exact: hit && pick.score === `${result.home}-${result.away}`,
    brier: hit ? (q - 1) ** 2 : q ** 2,
  };
}

/** Aggregate track record over resolved series; `log` keeps the last ≤12 oldest-first. */
export function buildRecord(series, since) {
  const scored = series
    .map((s) => ({ s, r: scoreSeries(s) }))
    .filter((x) => x.r)
    .sort((a, b) => Date.parse(a.s.kickoff) - Date.parse(b.s.kickoff));
  const resolved = scored.length;
  const correctOutcome = scored.filter((x) => x.r.hit).length;
  const exactScore = scored.filter((x) => x.r.exact).length;
  const brierSum = scored.reduce((acc, x) => acc + x.r.brier, 0);
  return {
    since,
    resolved,
    correctOutcome,
    exactScore,
    winRate: resolved ? Math.round((100 * correctOutcome) / resolved) : 0,
    brier: resolved ? Math.round((brierSum / resolved) * 1000) / 1000 : 0,
    log: scored.slice(-12).map(({ s, r }) => {
      const code = s.pick.side === 'home' ? s.home : s.away;
      const label = `${s.home} ${s.result.home}-${s.result.away} ${s.away}`;
      return { id: s.id, label_en: label, label_zh: label, pick_en: `${code} win`, pick_zh: `${code} 胜`, ok: r.hit, exact: r.exact };
    }),
  };
}

/* ---------- round 2 (spec 2026-10-26 §6) ---------- */

const round3 = (v) => Math.round(v * 1000) / 1000;

/** Scoreline map rounded to 3 dp (residual folded into the likeliest score) plus,
 *  for Bo3/Bo5, pDecider = P(the series goes the full distance). */
export function seriesDistribution(scores, bo) {
  const entries = Object.entries(scores).map(([k, v]) => [k, round3(v)]);
  const top = entries.reduce((best, e, i) => (e[1] > entries[best][1] ? i : best), 0);
  entries[top][1] = round3(entries[top][1] + 1 - entries.reduce((sum, [, v]) => sum + v, 0));
  const out = { scores: Object.fromEntries(entries) };
  if (bo > 1) {
    out.pDecider = round3(Object.entries(scores)
      .filter(([k]) => k.split('-').reduce((a, b) => a + Number(b), 0) === bo)
      .reduce((sum, [, v]) => sum + v, 0));
  }
  return out;
}

const PLAYER_STATS = ['kda', 'dpm', 'kp', 'gd15'];

/** Best and worst player per team by mean in-role z-score of KDA, DPM, KP% and GD@15.
 *  Players with fewer than two games are ignored; teams with fewer than two eligible players are omitted. */
export function teamPlayerExtremes(rows) {
  const eligible = rows.filter((r) => r.teamCode && r.role && r.games >= 2);
  const z = new Map();
  for (const role of new Set(eligible.map((r) => r.role))) {
    const group = eligible.filter((r) => r.role === role);
    for (const stat of PLAYER_STATS) {
      const values = group.map((r) => r[stat]).filter(Number.isFinite);
      const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
      const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length || 1));
      for (const r of group) {
        const zs = z.get(r) || [];
        zs.push(Number.isFinite(r[stat]) && sd > 0 ? (r[stat] - mean) / sd : 0);
        z.set(r, zs);
      }
    }
  }
  const byTeam = {};
  for (const r of eligible) (byTeam[r.teamCode] ||= []).push(r);
  const out = {};
  for (const [team, players] of Object.entries(byTeam)) {
    if (players.length < 2) continue;
    const scored = players.map((r) => ({
      player: r.player,
      role: r.role,
      score: round3(z.get(r).reduce((a, b) => a + b, 0) / PLAYER_STATS.length),
      stats: Object.fromEntries(PLAYER_STATS.map((s) => [s, r[s] ?? null])),
    }));
    const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
    const worst = scored.reduce((a, b) => (b.score < a.score ? b : a));
    out[team] = { best, worst };
  }
  return out;
}

export const TACTIC_KEYS = Object.freeze(['GD@15', 'FB%', 'FT%', 'DRA%', 'VGPG', 'NASH%']);

/** Percentile (0..1, ties share their mean rank) of every tactic metric across teams;
 *  each team's highest and lowest metric become its best and worst tactic. */
export function teamTacticExtremes(rows) {
  const pct = new Map(rows.map((r) => [r.team, {}]));
  for (const key of TACTIC_KEYS) {
    const present = rows.filter((r) => Number.isFinite(r.values?.[key]?.raw));
    for (const r of present) {
      const v = r.values[key].raw;
      const below = present.filter((o) => o.values[key].raw < v).length;
      const equal = present.filter((o) => o.values[key].raw === v).length;
      const rank = below + (equal + 1) / 2;
      pct.get(r.team)[key] = present.length > 1 ? round3((rank - 1) / (present.length - 1)) : 1;
    }
  }
  const out = {};
  for (const r of rows) {
    const keys = TACTIC_KEYS.filter((k) => pct.get(r.team)[k] != null);
    if (!keys.length) continue;
    const pick = (better) => keys.reduce((a, b) => (better(pct.get(r.team)[b], pct.get(r.team)[a]) ? b : a));
    const entry = (key) => ({ key, value: r.values[key].display, pct: pct.get(r.team)[key] });
    out[r.team] = { best: entry(pick((x, y) => x > y)), worst: entry(pick((x, y) => x < y)) };
  }
  return out;
}

/** Decimal implied odds for a 0–100 probability; null when the probability is 0. */
export function oddsFromPct(prob) {
  return prob > 0 ? Math.round((100 / prob) * 100) / 100 : null;
}
