# Dependency and permission map

The immutable reference is HKUDS/Vibe-Trading `251b094320c1f97d1486626d3618113526914d4c`. Five original sentinel blobs pass. Bridge runtime additionally hashes Yahoo/OKX loader and technical indicator files against blobs from that same commit before importing them. The copied MIT license/root NOTICE are in `licenses/`; no upstream fonts or Electron frontend are shipped. Mixed-market source stays in the ignored reference checkout, behind the bridge's exact instrument/source boundary. Factor subcomponent notices must accompany any future factor extraction.

|Surface|Reused source/dependency|Enabled implementation|Remaining gate|
|---|---|---|---|
|US daily|src.market_data; Yahoo direct loader; pandas/requests|AAPL/MSFT/NVDA/MU/SPY/QQQ allowlist|Private by default; more symbols/search not yet adapted|
|Crypto spot daily|src.market_data; OKX spot loader|BTC/ETH/SOL-USDT; no CryptoEngine|UTC+8 bar-open/close semantics; undeclared volume unit remains unknown|
|Technical|src.tools.technical_indicator_tool pure helpers|RSI/MACD/BB/SMA/EMA/volume stats on complete unsampled bars|Q01 pattern tools not yet adapted; insufficient warmup = unavailable|
|SEC/financials|sec_edgar_client, filings/statements tools|Source audited; not yet mounted|Operator `VIBE_TRADING_SEC_UA` with a real contact; no upstream example.com contact reused|
|Profile/institutions/ETF/news|Yahoo and mixed-market tools|Source audited; not yet mounted|US branch/point-in-time/source contracts and real failure tests still needed; template ≠ flow data|
|US options/factors/backtests|Options helpers; GlobalEquityEngine; metadata/strategy store|Not mounted|Worker isolation; validated costs/borrow/calendar; retain nested licenses|
|Spot backtest|Independent cash/asset ledger required|Not implemented|CryptoEngine is perpetual; leverage=1 cannot satisfy spot acceptance|
|Strict perpetual|CryptoEngine|Not mounted|Historical funding/mark/margin/risk inputs; no fixed-funding substitution|
|Sessions/Swarm/Shadow/reports|Owned persistent stores and agent tools|Not mounted|Real owner identity + object authorization; no ARENA_ADMIN_KEY identity shortcut|
|Connectors/paper|Actual connector capabilities|Not mounted|Owned credentials and real sandbox account; no live authorization|
|Paid/MCP/shell/live settings|Excluded or optional sources|Disabled; no routes|No arbitrary path/URL/command/config surface|

Python `.venv` was installed from upstream `requirements-lock.txt` with hashes. `.venv-tests` uses the kit's exact offline requirements; actual pinned integration also runs in `.venv`. Local installed distributions are recorded in `validation/python-runtime-freeze.txt`; this is a local audit, not a production container/sandbox certification. Short-lived subprocesses plus filtered environment are not a sandbox for untrusted strategies.

Configuration names (values never logged): `VITE_VIBE_MARKETS_ENABLED` (non-secret UI flag), `VIBE_FEATURE_ENABLED`, `VIBE_BRIDGE_URL`, `VIBE_BRIDGE_TOKEN`, `VIBE_UPSTREAM_AGENT`, `ARENA_ADMIN_KEY` (quota only), `VIBE_LOCAL_RESEARCH` (loopback dev only). Production defaults remain off. Public redistribution additionally requires separately approved rights and `VIBE_ENABLE_PUBLIC_MARKET_DATA`, `VIBE_PUBLIC_DATA_RIGHTS_ACK`, `VIBE_PUBLIC_INSTRUMENTS`; this request does not enable them. `FINNHUB_KEY` / `TWELVE_KEY` remain only in the original host APIs.

No configured identity provider or authenticated owner session exists in this integration. An identity architecture must be selected and verified before personal modules, then its exact environment names documented; invented placeholder credentials are not a real identity system. No LLM or broker credentials are needed for the implemented daily/indicator path. On-chain/DeFi/unlock/liquidation datasets are missing data integrations, not merely missing environment variables.
