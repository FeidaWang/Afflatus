// Extracted from the pinned MIT-licensed English lexicon; see THIRD_PARTY_NOTICES.md.
export const SENTIMENT_COMMIT = "251b094320c1f97d1486626d3618113526914d4c";
const positive = new Set(["beat", "beats", "bullish", "buy", "cheap", "crush", "crushed", "crushing", "gain", "gained", "gaining", "gains", "green", "growth", "high", "higher", "hit", "improve", "improved", "jump", "jumped", "lead", "leading", "leads", "long", "opportunity", "outperform", "outperformed", "profit", "profitable", "profits", "raise", "raised", "raises", "rallied", "rally", "rebound", "record", "rise", "rises", "rising", "rose", "strong", "stronger", "surge", "surged", "surges", "top", "undervalued", "up", "upgrade", "upgraded", "upside", "win"]);
const negative = new Set(["bearish", "bleed", "bottom", "bust", "crash", "crashed", "cut", "cuts", "cutting", "decline", "declined", "declining", "deficit", "downgrade", "downgraded", "downside", "drop", "dropped", "dropping", "fall", "falling", "fell", "fined", "firing", "frozen", "headwind", "headwinds", "investigation", "lawsuit", "layoff", "layoffs", "litigation", "lose", "loses", "losing", "loss", "losses", "low", "lower", "lowered", "miss", "missed", "missing", "negative", "overvalued", "penalty", "plunge", "plunged", "poor", "probe", "recall", "red", "risk", "risks", "sanction", "scandal", "sell", "selling", "short", "shrink", "sliding", "slump", "slumped", "turmoil", "underperform", "volatile", "volatility", "warn", "warned", "warning", "warns", "weak", "weaker", "worries", "worry", "worse", "worst"]);
export function scoreText(text) {
  const punctuation = new Set(".,;:!?\"'()[]{}");
  let pos = 0, neg = 0;
  for (let token of String(text).split(/\s+/u)) {
    while (token && punctuation.has(token[0])) token = token.slice(1);
    while (token && punctuation.has(token.at(-1))) token = token.slice(0, -1);
    if (!/^[\p{L}]+$/u.test(token)) continue;
    token = token.toLowerCase();
    if (positive.has(token)) pos++;
    if (negative.has(token)) neg++;
  }
  return { score: pos + neg ? roundLikePython((pos - neg) / (pos + neg)) : 0, positive: pos, negative: neg };
}

// Python round(float, 4) uses ties-to-even on the exact binary float. Preserve
// that boundary too (e.g. 33 positive / 31 negative -> 0.0312, not 0.0313).
function roundLikePython(value) {
  if (!value) return 0;
  const buffer = new ArrayBuffer(8); const view = new DataView(buffer); view.setFloat64(0, Math.abs(value));
  const bits = view.getBigUint64(0); const exponent = Number((bits >> 52n) & 2047n) - 1023 - 52;
  const mantissa = (bits & ((1n << 52n) - 1n)) | (1n << 52n);
  const numerator = exponent >= 0 ? (mantissa << BigInt(exponent)) * 10000n : mantissa * 10000n;
  const denominator = exponent < 0 ? 1n << BigInt(-exponent) : 1n;
  let rounded = numerator / denominator; const remainder = numerator % denominator;
  if (2n * remainder > denominator || (2n * remainder === denominator && rounded % 2n)) rounded++;
  return Math.sign(value) * Number(rounded) / 10000;
}
