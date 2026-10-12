import { assert, boundedNumber, symbol } from './common.mjs';
export const PROFILE_IDS = ['S', 'P', 'T'];
export const PROFILE_MANDATES=Object.freeze({
  S:'Fundamental and catalyst research: connect public business evidence to a falsifiable thesis, check upcoming catalysts, and hold when only a current quote is supplied.',
  P:'Valuation discipline: use explicitly supplied deterministic valuation outputs and their assumptions, assess downside and comparability, and hold when no source-backed valuation evidence is available.',
  T:'Portfolio risk discipline: prioritize diversification, cash, invalidation and reduction of unsupported exposure; never infer earnings or expected returns from a single quote.'
});
export const SECTORS = Object.freeze({AAPL:'Technology',MSFT:'Technology',NVDA:'Technology',AMZN:'Consumer Discretionary',GOOGL:'Communication Services',META:'Communication Services',TSLA:'Consumer Discretionary',MU:'Technology',AVGO:'Technology',SPY:'Broad Market ETF',SMH:'Semiconductor ETF'});
export function configuration(env = process.env) {
  const mode = env.ARENA_MODE || 'live'; assert(['demo','live'].includes(mode), 'INVALID_MODE');
  const watchlist = [...new Set((env.ARENA_WATCHLIST || 'AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA,MU,AVGO,SPY,SMH').split(',').map(symbol))];
  assert(watchlist.length <= 40 && watchlist.length > 0, 'WATCHLIST_LIMIT');
  const feed = env.ALPACA_DATA_FEED || 'iex'; assert(['iex','sip','delayed_sip'].includes(feed), 'INVALID_FEED');
  return {
    mode, watchlist, feed, publicQuotes: env.ARENA_PUBLIC_QUOTES === 'true', autorun: env.ARENA_AUTORUN === 'true',
    initialCash: boundedNumber(env.ARENA_INITIAL_CASH,10000,100,10000000),
    maxRunsPerDay: boundedNumber(env.ARENA_MAX_RUNS_PER_DAY,6,1,48),
    maxOutputTokens: boundedNumber(env.ARENA_MAX_OUTPUT_TOKENS,1800,300,4000),
    marketConfigured: !!(env.ALPACA_API_KEY && env.ALPACA_SECRET_KEY),
    profiles: PROFILE_IDS.map(id => {
      const provider = env[`ARENA_${id}_PROVIDER`] || (id === 'P' ? 'openai' : 'anthropic');
      assert(['anthropic','openai'].includes(provider), 'INVALID_AI_PROVIDER');
      const model = String(env[`ARENA_${id}_MODEL`] || '').trim();
      assert(model.length <= 160, 'INVALID_MODEL');
      return {id, label: {S:'S · Research',P:'P · Valuation',T:'T · Risk-aware'}[id], mandate:PROFILE_MANDATES[id], provider, model,
        configured: !!(model && env[provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'])};
    })
  };
}
