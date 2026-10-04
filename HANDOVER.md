# Afflatus Vibe handover — 2026-10-05 Melbourne

## Checkpoint

- Actual worktree `/Users/feida/.codex/worktrees/5615/afflatus`, branch `codex/vibe-us-crypto-integration`. Do not edit the detached b2fb checkout or the primary checkout for this task.
- Prior commits: P0/P1 c3fee505, handover 97f2f893, P2 3f6815e9, Arena rails df8c8630. User authorized push/deployment: df8c8630 reached origin/main and the feature branch; Vercel production dpl_F8sBAEjSXf9WF1U6M68bKtUQ8Mv5 is READY, feida.au. Production research flags remain off. Prior GitHub CI has the documented 96 baseline unit failures; it is not an all-green release.
- Latest user request: push this conversation’s code online and ensure the website displays the update. Release P3 commit 010853b3 plus the deployment state labels to both main and the feature branch. Enable production UI flags VITE_VIBE_MARKETS_ENABLED and VITE_VIBE_QUANT_ENABLED. Production has no VIBE_BRIDGE_URL/token and server research gates stay off: visible forms are not successful online data/calculation acceptance. Verify the exact release commit and aliases using Vercel and the public bilingual Arena pages; do not confuse the prior df8c8630 deployment with this release.
- User explicitly keeps P4/P5 blocked pending real owner identity. Shared ARENA_ADMIN_KEY is a quota gate, never an identity provider. No personal sessions, shared personal cash flows/reports, accounts, paid resources, MCP configuration or orders are enabled.
- Fixed source 251b094320c1f97d1486626d3618113526914d4c remains in ignored `integrations/vibe-us-crypto-kit/vendor/vibe-trading`. P2 blob lock and the quant source-tree lock are checked before imports. No unpinned main, fonts, broker secrets, or upstream instructions are copied/executed.

Read root IMPLEMENTATION_STATUS.md, kit validation/P3_TEST_REPORT.md and docs/P3_QUANT_GUIDE.md. P0/P1 and P2 reports are historical evidence, not current acceptance. Original manifest inventory/IDs remain intact; do not redo the full source scan. PACKAGE_CONTENTS.json remains the original package snapshot.

## New P3 engineering

- Fixed POST/GET/DELETE quant jobs: two worker slots, four active tasks, 120-second worker/150-second queue deadline, bounded input/output, TTL/retention, cancellation and shutdown cleanup. Server-only credentials, temporary HOME and filtered child environments. Fixed module/parameter/output JSON contract shared by Python and BFF/browser.
- GlobalEquityEngine(us) execution policy with Decimal host cash ledger; independent spot cash/asset ledger. Previous-close signal / next-open execution, explicit costs, prior-session volume cap, same-window benchmark, complete fills and marks. Eight-decimal half-even money, canonical fixed-point zeros, JS BigInt reconciliation rounds total equity once. Only long/unlevered; no dividend cash credit or terminal forced liquidation.
- Yahoo actual options chain, European BS/Greeks and multi-leg expiry payoff separately labelled. DCF/comps/three-statement pinned models require explicit data and assumptions; no inferred rates or filed statements.
- Six-stock metadata-filtered academic factors, lagged timing, IC/IR, gross/net layers and purged chronological split. Portfolio same-currency/date-grid/timezone gates, risk/correlation and Brinson-Fachler/Carino attribution. Strategy catalogue and request/data snapshot hashes are ephemeral, not a private strategy database.
- Local CLI cash-flow performance, Decimal rigor, seeded numerical report audit, pure decay suggestions and supplied-snapshot reconciliation. Shared routes reject these owner-sensitive modules. Strict Binance USDT perpetual snapshot adapter requires actual funding/mark/history-valid hashed maintenance schedules, explicit PERP identity and UTC 8H cadence; never substitute spot. Only synthetic acceptance, no real historical risk dataset. Pinned perpetual engine uses float research math, not an exact asset ledger; intrabar path remains unknown.
- US09 quote-only pinned Futu earnings calendar: inclusive seven-day window, US market and selected-company identity, projected dates/period/session, source timestamp unknown unless supplied. Operator-only loopback gateway config; no trading context/config/account methods. Missing gateway returns US_CONNECTOR_REQUIRED before spawning a worker. Real SDK/OpenD remain external requirements.
- Bilingual UI action-triggered jobs, cancellation/stale clearing, tables within their own scroll areas and explicit unknown/error states. AMZN/GOOGL bring registry to 15 instruments (six stocks, three ETFs, six venue-specific spot pairs). Prototype composition and Arena rails are preserved.
- Portable overlay synchronized with host adapters/contracts, including package-data source locks; no host root config/routes/AGENTS overwritten.

## Verification and boundaries

Current counts and artifact paths are in P3_TEST_REPORT.md. Host Python 142 pass; selected pinned upstream 943 pass with sockets denied; Node proxy 51 pass; focused Vitest 28 pass. Typecheck/build and data/site/header/CSS/i18n/asset/SEO gates pass. Entire host retains the same 96 failures / 19 failed files, no added failure names; original browser quality failures are not claimed repaired.

Six actual local host/BFF/worker chains succeed: AAPL backtest, OKX BTC spot backtest, Binance BTC spot backtest, AAPL/MSFT portfolio/attribution, Yahoo AAPL option chain, six-stock academic_strev. Initial failures are retained separately from final success. Browser option reference, live equity output, real DELETE cancellation, server-secret header absence, EN/ZH rails at 320/375/440/1440 and source/feature gates are separately recorded. Viewport simulation, not a physical device or production acceptance of P3.

External blockers remain real SEC operator contact, actual compatible OpenD quote connector, real historical perpetual risk snapshots, full US sector/research feeds and owner/object authorization. US01 full search/personal persistence, US02 additional intervals, full Alpha Zoo/strategy discovery and P4/P5 are not silently marked complete. Paid/public/live expansion remains off.

## Local commands and recovery

`python3 scripts/vibe-local.py` runs loopback bridge 8765 and Vite 5175 with temporary server credentials. The current preview may already be running: inspect the exact process/ports before restarting. UI http://127.0.0.1:5175/arena.html. No secret values are written in reports or printed.

```sh
VIBE_TEST_HOST_ROOT="$PWD" VIBE_UPSTREAM_TEST_AGENT="$PWD/integrations/vibe-us-crypto-kit/vendor/vibe-trading/agent" integrations/vibe-us-crypto-kit/.venv/bin/python -m pytest integrations/vibe-us-crypto-kit/tests -q
VIBE_TEST_HOST_ROOT="$PWD" node --test integrations/vibe-us-crypto-kit/tests/proxy.test.mjs
npx vitest run tests/vibeMarket.test.js tests/vibeResearch.test.js tests/vibeQuant.test.js
npm run typecheck
npm run build
node integrations/vibe-us-crypto-kit/scripts/verify_live_quant.mjs
```

Live verification overwrites its report; preserve prior evidence first. Use kit Python 3.11+ for `scripts/vibe-quant.py`, stdin JSON, optional local normalized `--snapshot` or `--perpetual-snapshot`. The system Python launcher does not execute bridge math itself.

Configuration names and exact input contracts are in P3_QUANT_GUIDE.md. Rollback: disable VITE_VIBE_QUANT_ENABLED / VIBE_QUANT_ENABLED, stop bridge to cancel in-flight children, then revert this local P3 commit to df8c8630. Disable VITE_VIBE_MARKETS_ENABLED / VIBE_FEATURE_ENABLED for all research. No personal data was created; do not delete edited files using the original overlay receipt.

## Vercel-only continuation

User confirmed only Vercel is available. The existing 6255796f production deployment is READY. Add an independently gated stateless Python /api/vibe-model for option_model, option_payoff and catalogue on the same project; no new resource, public quote rights or owner identity is assumed. 29 unmodified pinned Python files plus MIT LICENSE are extracted under services/vibe-model/fixed with per-call Git blob checks. Python 3.12 dependencies are separately locked. UI routes only these calculations to the new endpoint, defaults to an available model, and says Stop waiting (no persistent job cancellation claim). All other modules retain private bridge routes. Before declaring online functionality, verify production response DTOs and browser results; tests/vibe_models_test.py uses synthetic assumptions and denies outbound sockets in maths. See services/vibe-model/README.md.
