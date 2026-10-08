# Haiku 5.5 and subscription economics — 9 October 2026

The user requested publication on the existing `feida.au/sectors.html` page. The implementation retains the site's observatory and bilingual architecture. It adds Haiku to the existing 18-family selection, rather than claim an exhaustive worldwide ranking. Rank 14 is **within these 19 selected max/high configurations**, with rounded-score ties preserved. The five Haiku effort variants are compared separately.

## Evidence and authority

- [SemiAnalysis, 5 October](https://newsletter.semianalysis.com/p/anthropic-subscriptions-offer-5x): read the accessible public article, including rate measurement and its assumptions. The Tokenomics Dashboard and locked final third-party-plan comparison were unavailable. Its approximate daily-driver 5× API-equivalent ratio is attributed and dated, never described as a fresh local experiment.
- [Anthropic, 7 October](https://www.anthropic.com/claude-haiku-5-5): authoritative product release, 100k stepped token prices, Sonnet cache-read reduction and announced subscription API credits. No vendor benchmark is inserted into the independent Intelligence Index.
- [Artificial Analysis public model table](https://artificialanalysis.ai/leaderboards/models): a frozen visible-table read on 9 October (Melbourne date), using v4.3.2. `aa-observations.json` records the selected rows and five effort variants. Median output speed and first-chunk latency change between observations and differ from the model FAQ's instantaneous values; all displayed rows use this table read. Argon's unavailable speed/latency remain null.
- Existing logo provenance remains recorded in the repository manifest. The two additions are Xiaomi's inline `logo__mi` SVG from [its official site](https://www.mi.com/global/) and [StepFun's official icon](https://www.stepfun.com/step_favicon.svg). Digests and official source URLs are in the new snapshot's `makers` registry. Chart colors are editorial representatives inspired by brand identity, not claims of exact official color specifications. SpaceXAI uses the recorded SpaceX parent mark; Z AI uses the official Zhipu mark.

## Independent analysis and reproducible scenarios

The original analysis distinguishes an API list-price reference from token allowance and accepted work, explains utilization constraints, proposes verification and escalation criteria, and discusses subscription-to-API conversion as a testable business hypothesis. It does not forecast revenue or assert task quality from the AA index.

Utilization-adjusted ratio = reported 5 × Claude utilization / OpenAI utilization. Default 60% / 80% gives 3.75×. A zero denominator is unavailable, not infinity. This ratio excludes quality and workload differences and is labeled a scenario.

API request cost = (fresh input × input rate + cached input × read rate + output × output rate) / 1,000,000. The modeled output is 1,000 tokens. At 25,000 prompt tokens and 80% cache hits, Haiku 5.5 costs $0.00120, Haiku 4.5 $0.01200, Sonnet 5.5 $0.02200. At exactly 100k prompt tokens, Haiku uses the lower tier. Above 100k, the higher rate applies to the whole request. Cache writes, tools, retries, batch discounts, tokenizer differences and equal task quality are not assumed. Cache tokens are included when determining prompt length.

The capability–cost frontier excludes points dominated on both dimensions in the current filtered population. Haiku max is not on the full selected frontier, because MiMo has higher capability and lower benchmark task cost. This is explicitly discussed; output speed and task fit are different dimensions.

## Verification

- Production build passed all existing prebuild gates, data validation, bilingual lint and emitted SEO checks.
- 31 focused tests passed across observatory evidence, research, economics boundaries, fonts and media contracts. Historical schema-v1 snapshots remain unchanged and valid; current schema-v2 requires maker and observation provenance.
- In-app browser exercised effort switching, intersected maker/search/openness filters, empty results, filtered scatter points and CSV export. The downloaded CSV contained precisely the selected Haiku max row and a rank recomputed within that filter.
- Browser exercised zero-utilization denominators, reset, and long-prompt price transition.
- English 320px and Chinese 390px/desktop previews were inspected. No page-wide horizontal overflow; the mobile scatter is intentionally scrollable inside its own container. Official logo requests loaded. Observed browser console had no errors.
- No installed browser bundle or personal browser profile was modified. Browser inspection used the provided in-app browser.

Deployment receipt will record the published commit and verified production deployment after release.
