# Research calculation and evidence contract

This document defines the pure research modules exported from `src/research/index.mjs`. They have no network access, database connection, broker capability, dependency on an LLM SDK, or access to mutable model weights. Inputs are ordinary JavaScript objects. Outputs are JSON-serializable objects. The service owns authentication, source acquisition, snapshot storage, orchestration, persistence, and the separate paper-execution risk gate.

All implementations are new code for this integration. Financial-workflow concepts were adapted from the pinned upstream audit in `upstream-audit.md`; upstream runtime scripts were not copied into the execution path.

## Shared conventions

| Item | Contract |
| --- | --- |
| Module entry | `import { calculateDCF, ... } from './src/research/index.mjs'` |
| Runtime | ESM on modern Node.js; no external packages; `node:test` verification |
| Errors | Most invalid computational inputs throw `ResearchError` with `code`, `message`, `details`. Evidence/research validation returns `valid:false` plus `errors`. Forecast validation excludes invalid samples with explicit codes. |
| Numbers | Finite JavaScript numbers; numeric strings, `NaN`, and infinities are invalid. |
| Rates | Decimal fractions: `0.10` means 10%; output percentages also use decimal fractions. |
| Timestamps | ISO date or ISO timestamp with `Z`/explicit offset. A date-only string is **00:00 UTC**, not end of the named day. Supply a full timestamp for a market cutoff. Invalid calendar dates are rejected. |
| Determinism | The caller supplies `asOf`; no wall-clock defaults. Functions do not mutate inputs. |
| Monetary units | Explicit `ones`, `thousands`, `millions`, or `billions`; three-letter uppercase currency. No implicit FX conversion. |
| Missing values | `null`/omitted data remain missing. No model knowledge, synthetic amount, or zero replaces missing observations. |
| Assurance | A structurally valid citation is not proof that a provider returned that content. Ingestion must verify content, vintage, entitlements, and extracted numbers. |

## 1. `calculateWACC(input)`

Required fields:

```js
{
  marketEquity: 800,
  marketDebt: 200,
  preTaxCostOfDebt: 0.06,
  taxRate: 0.25,
  // Choose ONE way to supply equity cost:
  riskFreeRate: 0.04,
  beta: 1.2,
  equityRiskPremium: 0.05
  // OR: costOfEquity: 0.10
}
```

`marketEquity` and gross, interest-bearing `marketDebt` must be supplied in the same units and currency. The function computes equity/debt market weights, CAPM equity cost when requested, the explicit tax shield, and WACC. It rejects `cash` or `netDebt` as a capital-base substitute and rejects simultaneous CAPM and explicit-equity-cost inputs. A debt-free business is supported with `marketDebt:0` and an explicit debt-cost field, normally zero. The caller must choose an appropriate tax shield and any operating-risk/beta adjustments; these are not inferred.

For the example, equity cost is 10%, weights are 80%/20%, after-tax debt cost is 4.5%, and WACC is 8.9%.

## 2. `calculateDCF(input)`

```js
{
  asOf: '2026-10-12T12:00:00Z',
  currency: 'USD',
  units: 'millions',
  debt: 200,
  cash: 50,
  shares: { basic: 100_000_000, incremental: 0 },
  scenarios: {
    bear: { fcff: [80, 88], wacc: 0.12, terminalGrowth: 0.01 },
    base: { fcff: [100, 110], wacc: 0.10, terminalGrowth: 0.02 },
    bull: { fcff: [120, 132], wacc: 0.08, terminalGrowth: 0.03 }
  },
  sensitivity: { waccStep: 0.005, growthStep: 0.005 }
}
```

### FCFF and discounting

`fcff` contains 1–30 explicit annual unlevered free-cash-flow amounts, payable at each year end. All three scenarios are required and must use the same horizon. No revenue, margin, CapEx, tax, or working-capital assumptions are invented. A caller can generate the FCFF inputs from its sourced financial model before invoking this function.

The last FCFF must be positive for this stable perpetuity model. Earlier losses are allowed. `wacc > 0`, `terminalGrowth > -1`, and `wacc > terminalGrowth` are hard constraints.

The returned schedule shows each FCFF, discount factor, and present value. Terminal FCFF is the final forecast multiplied by `1 + terminalGrowth`; terminal value is this amount divided by `wacc - terminalGrowth`; terminal value is discounted from the last forecast year. The returned operating enterprise value is the sum of forecast and terminal present values.

### Equity bridge and dilution

Use exactly one net-debt representation:

| Representation | Required fields | Rule |
| --- | --- | --- |
| Components | `debt`, `cash` | Both are nonnegative; `netDebt = debt - cash`. Cash means eligible non-operating cash. |
| Already netted | `netDebt`, `cashIncludedInNetDebt:true` | Net cash is a negative net-debt number. `debt` and `cash` are forbidden in this representation. |

Optional `preferredEquity`, `nonControllingInterest`, and `otherNonOperatingAssets` default to zero. Other assets must exclude cash already included in net debt. Equity value equals operating EV minus net debt, preferred equity, and non-controlling interests, plus those other assets. Negative equity is returned with a warning and is never clamped to a positive price.

Shares are an **actual count**, irrespective of monetary units. Supply either `shares.diluted`, or `shares.basic` plus explicitly declared `shares.incremental`. Both modes reject overlapping fields. Incremental shares must be nonnegative and should already reflect the caller's chosen treatment of options, RSUs, convertibles, and treasury-stock adjustments. The engine does not price those instruments.

### Sensitivity output

`scenarios.bear/base/bull` each contains `schedule`, `enterpriseValue`, `equityValue`, `pricePerShare`, `terminalValueShare`, and warnings. The `sensitivity` object contains five WACC values, five growth values, and a 5×5 `grid`. Each valid cell independently recomputes the complete PV schedule and perpetuity. The center `[2,2]` exactly matches the base scenario. Invalid edge cells return `valid:false`, `pricePerShare:null`; they are never approximated.

Terminal-value concentration above 80% is a sensitivity warning, not a universal valuation failure. The supported convention is annual year end; mid-year discounts, quarterly stub periods, bank capital models, and option-based dilution are outside this function's contract.

## 3. `compareCompanies(peers)`

Each peer has:

```js
{
  symbol: 'SYNTH',
  asOf: '2026-10-12T12:00:00Z',
  currency: 'USD', units: 'millions',
  period: { basis: 'TTM', end: '2026-09-30', accounting: 'GAAP' },
  marketCap: 1000, enterpriseValue: 1200,
  revenue: 100, revenuePrior: 80,
  grossProfit: 70, ebitda: 20, netIncome: 10, fcf: 20,
  sector: 'software',
  sourceIds: ['source-id']
}
```

The function accepts 1–200 unique symbols. It normalizes monetary units to `ones`, but it requires the same currency, valuation snapshot, period basis (`TTM`, `NTM`, `FY`), period end, and accounting label for all peers. For NTM data, the same snapshot prevents silently mixing old and new consensus vintages. Different corporate fiscal calendars must be calendarized upstream or shown in separate peer tables. The function does not invent FX rates or normalize incompatible GAAP/adjusted definitions.

When explicit EV is absent, it can derive EV from market capitalization, debt, cash, and optional preferred/non-controlling amounts. Missing inputs remain missing. The caller must check consistency when providing a provider's explicit EV and separate debt/cash details; explicit EV is the source value in that mode.

`rows[].metrics` contains `evRevenue`, `evEbitda`, `pe`, `fcfYield`, `grossMargin`, `ebitdaMargin`, `fcfMargin`, and `revenueGrowth`. `ruleOf40` is only computed for software/SaaS peers with both inputs. A metric returns `{value,status,reason?}`. Invalid valuation denominators, nonpositive EV/market-cap numerators, or missing inputs return `status:'NM',value:null`. Loss-making peers therefore cannot accidentally rank as cheap because of a negative P/E. Negative profitability margins and negative FCF yields remain meaningful negative values.

`statistics` contains valid count, minimum, first quartile, median, third quartile, and maximum. Quartiles use linear interpolation at `(n-1)*p`. Nonmeaningful ratios are excluded. Outliers beyond 1.5 IQR are flagged when at least four valid observations exist; they are retained in both table and statistics. No universal gross-margin > EBITDA-margin > net-margin assumption is applied.

## 4. `analyzeEarnings({actual, consensus, prior, directions})`

The three columns are maps from metric name to a number, `null`, or `{value, units, currency, period, basis, sourceIds}`. Numeric-only maps mean the caller explicitly supplies values already normalized to the same units, period, and accounting basis. Do not combine GAAP actual EPS with adjusted consensus EPS in numeric-only form.

The object form compares the metadata exactly. A mismatch returns `incomparable`, with no delta or percentage. Missing data returns `missing`. Each row contains actual, consensus, prior, source IDs by column, and independent `versusConsensus`/`versusPrior` results.

`delta = actual - reference`; `percent = delta / abs(reference)`. The percentage is undefined at a zero reference and stays `null`; the absolute delta is still reported. Negative reference values are described as directional changes, not ordinary growth rates. Thus an EPS loss improving from consensus -0.30 to actual -0.10 is correctly classified as a beat. `directions` optionally maps metrics to `higher` or `lower`; lower costs can be a beat. Default is `higher`. This is a numerical variance table, not a stock-price reaction predictor.

## 5. `validateEvidence(sources, {asOf})`

Each source requires:

```js
{
  id: 'filing-1', kind: 'filing', title: 'Document title',
  url: 'https://issuer.example/filing',
  publishedAt: '2026-10-10T20:00:00Z',
  availableAt: '2026-10-10T20:00:01Z',
  retrievedAt: '2026-10-12T12:01:00Z',
  versionAt: '2026-10-10T20:00:00Z'
}
```

Supported kinds: `filing`, `market_data`, `news`, `transcript`, `user`, `dataset`, `research_report`. A `user` source can omit its URL; other kinds need an HTTP(S) URL without embedded credentials. Source IDs are unique. The parser rejects invalid dates, duplicate IDs, future availability, and future/invalid vintages.

Required ordering is `publishedAt <= availableAt <= asOf`. When given, `versionAt` must lie between publication and availability; `retrievedAt >= availableAt`. A historical reconstruction can be retrieved after `asOf`, but the specific content vintage must have been available before the historical cutoff. The ingestion service must substantiate that timestamp; setting an old timestamp on a newer revised database value does not make it historically valid.

Output includes `valid`, `accepted`, `errors`, and `assurance:'structure-and-time-only'`. It does not fetch URLs, authenticate the publisher, assess data licensing, or prove a number is correctly extracted.

## 6. `validateResearch(research, {asOf, sources?})`

Required arrays, including when empty:

| Section | Required fields | Additional numerical rules |
| --- | --- | --- |
| `facts` | `id`, `claim`, nonempty `sourceIds` | Use `numericClaims:[{name,value,unit,sourceIds,availableAt?}]`; do not put untyped numerical fields directly on a fact. |
| `assumptions` | `id`, `claim`, `rationale` | Optional `value` requires `unit`. Optional `sourceIds` must resolve. |
| `inferences` | `id`, `claim`, nonempty `basedOn` | Only factual/assumption IDs may be dependencies. Numerical inference needs `value`, `unit`, and `calculation:{method,inputIds}`. |

Factual, assumption, and inference IDs share a unique namespace. Cyclic or inference-to-inference dependencies are disallowed in this contract. Every numeric fact has its own explicit source IDs and units. Unknown fields inside those claim objects are rejected so untyped numbers cannot bypass the gate. Numbers in a factual sentence are supported by that fact's source IDs; the engine cannot verify prose extraction against the remote source.

Optional `decision` is `{action:'buy'|'sell'|'hold',confidence:0..1,rationale,evidenceIds,invalidation?}`. Buy/sell research requires factual evidence and an invalidation condition. The decision is research output; it never authorizes a fill. **`decision.confidence` expresses confidence in the research action. It is not automatically a probability that the underlying instrument's return is positive.** Keep that separate from calibrated event probabilities.

When both `research.snapshotAt` and `asOf` are supplied, they must match exactly. Sources are supplied via options or `research.sources`. Output includes `valid`, `errors`, counts, and `executionAuthorized:false`. The service must apply its own complete decision schema, source-content verification, risk rules, quote checks, and signed/persistent state transition after this gate.

## 7. `createThesis(input)` / `updateThesis(thesis, event, {asOf?})`

Creation fields: `id`, `symbol`, `statement`, `createdAt`, `pillars`, `risks`, `stopTrigger`; optional `side:'long'|'short'` (long default), `conviction:'low'|'medium'|'high'` (medium default), `targetPrice`. Each pillar is `{id,expectation,invalidation}`. A new thesis has revision 1, active status, pending pillars, and a creation event.

Each event has a unique `id`, `at`, `type`, and `description`. Supported types:

| Event | Additional fields | Behavior |
| --- | --- | --- |
| `evidence` | `pillarId`, `impact:'strengthens'|'weakens'|'neutral'`, nonempty `sourceIds` | Appends evidence to a pillar; weakening evidence challenges an active thesis. Positive evidence alone does not restore a challenged thesis. |
| `review` | Optional `nextStatus`, `conviction`, `targetPrice` | Records an explicit review; target-price edits require this type. |
| `transition` | `nextStatus` | Changes state according to allowed transitions. |

Allowed transitions: `active -> challenged/invalidated/closed`; `challenged -> active/invalidated/closed`; `invalidated -> closed`; `closed` is immutable. Revisiting an invalidated/closed idea requires a new thesis ID. Every accepted event increments revision and appends a history entry. Duplicate events and out-of-order timestamps fail. If provided, `asOf` prevents applying future events. These functions validate source ID shape; the service must resolve them against accepted source records at the actual cutoff.

## 8. `calibrateForecasts(samples, options)`

```js
{
  id: 'forecast-123', modelId: 'analyst-profile', modelVersion: 'model-and-prompt-v1',
  cohort: 'live:positive-return:24h',
  createdAt: '2026-10-10T12:00:00Z',
  featureSnapshotAt: '2026-10-10T11:59:00Z',
  maxFeatureAvailableAt: '2026-10-10T11:58:00Z',
  horizonAt: '2026-10-11T12:00:00Z',
  resolvedAt: '2026-10-11T12:01:00Z',
  probability: 0.65, outcome: 1
}
```

Options: `{asOf,minSamples:30,bins:10,epsilon:1e-15}`. Required fields are shown above except `maxFeatureAvailableAt`; `outcomeAvailableAt` is also optional. IDs cannot duplicate. Required ordering: `featureSnapshotAt <= createdAt < horizonAt <= resolvedAt <= asOf`. Future, immature, unresolved, malformed, or duplicate records appear in `excluded` and do not inflate the eligible count. If supplied, feature/outcome availability timestamps must support the same ordering.

`probability` must mean the cohort's explicitly named binary event. For the arena mapping, this is **P(the underlying instrument's total return is positive over the stated horizon)**, irrespective of buy/sell/hold. A sell may have low upward probability; do not convert it to confidence in the sell action. Use `outcome:1` for that exact event and `0` otherwise. Freeze how dividends, corporate actions, market closures, and starting/ending observations define the return before resolving outcomes.

Scores are Brier, clipped binary log loss, expected calibration error, 0.5-threshold accuracy, observed base rate, and mean probability. Reliability bins include count, average probability, observed event frequency, Wilson 95% frequency interval, gap, and a Laplace-smoothed **candidate** frequency for offline experiments. Empty bins have null values. Exact p=0/p=1 are accepted, and log loss is finite via a declared epsilon no smaller than machine epsilon.

Cohorts are partitioned by `modelId + modelVersion + cohort`. Multiple cohorts produce `status:'mixed_cohorts'`, per-cohort results, and no pooled headline metric. Fewer than `minSamples` is always `insufficient`; computed statistics are exploratory. There is no claim that 30 dependent forecasts establish statistical confidence. Serial dependence and symbol overlap can substantially reduce effective sample size.

The output proposes a separate candidate version with a frozen training cutoff and mandatory future holdout comparison. `liveWeightsChanged:false` is invariant. No calibration map is automatically deployed.

## 9. `evaluateStrategy(points, options)`

Each point is `{at,equity,externalFlow?:0,benchmarkEquity?,availableAt?,resolvedAt?}`. Equity must include posted costs, spread, slippage, dividends, corporate actions, and realized/unrealized valuation effects. External flow is a deposit/withdrawal **at the end of that observation period**. For intraperiod flows, split the time series at the flow first.

Options:

```js
{
  asOf: '2026-10-12T12:00:00Z',
  minObservations: 20,
  annualizationPeriods: 252,
  riskFreeRate: 0,
  dailyCloseSeries: false,
  fixedFrequencySeries: false
}
```

Future observations/availability/resolution are excluded. Accepted points are sorted; duplicated timestamps fail. The opening equity is positive with zero opening flow. A bankrupt/zero-equity account cannot restart inside the same series.

Period return is `(equity - externalFlow) / priorEquity - 1`; cumulative return and drawdown use the compounded flow-adjusted wealth index. Net P&L separately subtracts external flows. Benchmark and excess return require benchmark observations at every accepted timestamp.

Annualized volatility, Sharpe, and Sortino are **null unless** there are enough observations and the caller explicitly confirms `dailyCloseSeries:true` or `fixedFrequencySeries:true`. `dailyCloseSeries` additionally rejects more than one observation per UTC date. For a fixed-frequency series the caller must supply its appropriate `annualizationPeriods` (e.g., 52 for weekly). Zero/negligible variance produces null Sharpe. The module cannot infer a statistically valid frequency from uneven intraday snapshots.

**CAGR is null until at least 365 elapsed days and the minimum observation count.** Short histories remain visible through unannualized return/P&L/drawdown. Sample variance uses `n-1`. These are descriptive metrics, not significance tests or predictions of future strategy quality.

## 10. `proposeFeedback({calibration, performance, currentVersion, asOf})`

This returns a candidate-version experiment proposal, frozen training cutoff, hypotheses, and required future/holdout checks. It refuses results whose evaluation date lies beyond the proposed cutoff. Probability calibration and severe-drawdown risk reviews may be proposed when supported by input results; otherwise the proposal collects evidence.

Invariant fields: `mode:'new_version_only'`, `liveWeightsChanged:false`, `activationAllowed:false`, `requiresOutOfSampleValidation:true`. This function cannot change a live model, prompt, position cap, or allocation. The service must keep candidate promotion explicit and preserve the prior model version and experiment cohort.

## 11. `buildMorningBrief(context)`

Inputs: `asOf`, source records, optional `quotes`, `catalysts`, `theses`, `earnings`, `research`, and `maxQuoteAgeSeconds` (120 default). It assembles JSON sections and a Markdown summary from supplied data only.

Quotes need `symbol`, `price`, `currency`, `asOf`, `receivedAt`, `sourceId`, `mode` (`live`, `delayed`, `cached`, `demo`), and session. Optional `changePct` uses a decimal fraction. Quality distinguishes sourced, stale, unverified, market closed, and demo. A quote's `executionEligible` field is only the local freshness/mode/session predicate; **the whole brief returns `executionAuthorized:false`**, and this flag must not replace the service risk/entitlement gate.

Catalysts need `title`, `scheduledAt`, `availableAt`, and nonempty accepted `sourceIds`; future publication knowledge is excluded even when the event's scheduled date is in the future. Thesis revisions newer than the snapshot are excluded; the service can instead supply the correct historical revision. Earnings summaries need availability and accepted source IDs. Bad or future records are listed in `excluded`; nothing is silently replaced with fabricated data.

## Synthetic demonstration and validation

`fixtures/research-demo.json` contains entirely fictional companies, financials, prices, sources, and research. `anchorAsOf` permits shifting every date by the same delta for a current demo while preserving point-in-time ordering. The mode remains `demo`, all labels remain synthetic, and it must never be merged into a live performance cohort.

Run:

```bash
node --test tests/research.test.mjs
```

The research suite covers analytical DCF/WACC values, dilution and cash double-counting, all 25 sensitivity cells, bad units/basis/denominators, earnings loss improvements, evidence vintage and numerical citations, thesis transitions, future-leakage exclusions, exact Brier/log-loss calculations, cohort separation, cash-flow-adjusted performance, annualization eligibility, and complete execution of the synthetic fixture.
