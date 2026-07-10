/* ============================================================
   QUIZ NORM (U3, Urgent.md) — population-percentile helpers for the three
   quizzes. The models are DOCUMENTED APPROXIMATIONS, not claims of real
   norming (the page says so):

   - Logic quiz: percentile of the playful IQ-shaped funScore against the
     conventional IQ model N(100, 15) — the same normal model every
     mainstream IQ instrument norms to (WAIS/Stanford-Binet convention).
   - EQ quiz: self-report EQ-style totals skew high in published trait-EI
     data, so the overall 0-100 score is compared against N(62, 14) — an
     approximation of that right-shifted self-report distribution.
   - MBTI-style types: PERSONA_FREQ (persona.js) carries commonly cited
     US population estimates per type; here we just format them.
   ============================================================ */

// Abramowitz–Stegun 7.1.26 erf approximation (|error| < 1.5e-7) — plenty
// for one-decimal percentiles.
export function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

/** P(X <= x) for X ~ N(mu, sigma), as a percentage rounded to one decimal, clamped to [0.1, 99.9]. */
export function normalPercentile(x, mu, sigma) {
  const p = 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2))) * 100;
  return Math.max(0.1, Math.min(99.9, Math.round(p * 10) / 10));
}

export const iqPercentile = (funScore) => normalPercentile(funScore, 100, 15);
export const eqPercentile = (overall) => normalPercentile(overall, 62, 14);
