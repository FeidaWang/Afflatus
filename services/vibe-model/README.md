# Vercel stateless models

The operator has only Vercel. `/api/vibe-model` runs bounded `option_model`,
`option_payoff` and `catalogue` requests on the existing Vite project's Python
function. Each response is complete. No job polling, database, account, owner,
historical quotes, SEC request, market option quote or provider token is used.
Inputs are assumptions supplied by the caller; they are not saved or logged.

Enable the independent `VIBE_MODELS_ENABLED=true` server gate and
`VITE_VIBE_MODELS_ENABLED=true` UI gate. Existing bridge/public-data flags are
independent and stay off. Roll back these two model flags to disable models.

`fixed/` contains only the 29 Python modules imported by these calculations and
the original MIT LICENSE, from HKUDS/Vibe-Trading commit
`251b094320c1f97d1486626d3618113526914d4c`. No font is included. Files are
unmodified and their Git blob hashes in `source-lock.json` are checked before
each calculation. This is a narrow extraction, not the full upstream app.
The host's `bridge.quant` adapter retains existing validation and output DTOs.

Only POST JSON is accepted: at most 32 KiB, exact module/field allowlists, up to
eight legs and 400 payoff spots. Unknown or owner-sensitive operations fail
before loading helpers. Models do not create jobs that another function
instance would need to find. Stop waiting aborts the browser's wait; it is not
advertised as deletion of a persistent task. Platform function duration is
capped at 30 seconds. Redis request quotas are described below.

The function's numerical dependencies are isolated from Node.js and omit all
LLM, MCP, broker and market-data SDKs. Dependencies are locked for Python 3.12.
Offline tests also deny outbound sockets during calculations. Validation calls
use explicit synthetic assumptions, never production defaults or quote fallback.

Historical research remains private and depends on a bridge/access layer.
Deploying the existing in-memory quant queue across Vercel instances would need
shared state or a different synchronous protocol. Vercel Services also use
Functions/Fluid Compute, so adding a Services block does not solve job state:
https://vercel.com/docs/services/pricing

Run `integrations/vibe-us-crypto-kit/.venv-model-validation/bin/python tests/vibe_models_test.py` after installing the root Python requirements in an
isolated Python 3.12 environment. Cross-check response DTOs with
`src/lib/vibeQuantContract.js`; verify the actual production function separately.

## Distributed rate limits

Production requires an Upstash Redis **Free** database linked to this Vercel
project, with **autoUpgrade=false**, **prodPack=false**, and **eviction=false**.
Never choose a paid plan, enable automatic upgrades, or add purchase/upgrade UI.
If the free quota is exhausted, the API returns 503; no paid fallback is used.
Provisioning may require the operator to accept Upstash terms in Vercel first.

The server reads `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, or the
Marketplace aliases `KV_REST_API_URL` / `KV_REST_API_TOKEN`. These are server
secrets and must never have a `VITE_` prefix. No Redis SDK dependency is needed:
requests use the documented HTTPS REST EVAL API with a two-second timeout.
A single Lua script increments and attaches a 60-second expiry atomically.
Keys contain the environment, endpoint scope and SHA-256 of the platform's
trusted client IP, never assumptions or raw IPs. Counters expire automatically.

Models allow 20 POSTs per client per minute and 120 across all clients per
minute. Both checks run before numerical work. Quote/history/treasury routes
keep their respective 60/20/45 per-client minute limits using the same Redis.
Those route limits do not claim an account-wide upstream provider quota.
Vercel's `x-vercel-forwarded-for` is used instead of client-supplied forwarding
headers. Missing Redis configuration, errors or invalid Redis replies return
`503 RATE_LIMIT_UNAVAILABLE` with `Retry-After: 5`; exhausted counters return
`429 RATE_LIMITED` with the remaining window. Local-only development retains
bounded in-memory counters. Deployments never fall back to those counters.

## Reproduce Python dependencies

Root `requirements.txt` contains the direct and transitive pins plus package
hashes, generated from `services/vibe-model/requirements.in` for Python 3.12:

```sh
uv pip compile services/vibe-model/requirements.in --python-version 3.12 --python-platform x86_64-manylinux_2_28 --generate-hashes --output-file requirements.txt
uv venv --python 3.12 /tmp/afflatus-model-validation
uv pip install --python /tmp/afflatus-model-validation/bin/python --require-hashes --only-binary :all: -r requirements.txt
uv pip check --python /tmp/afflatus-model-validation/bin/python
/tmp/afflatus-model-validation/bin/python tests/vibe_models_test.py
```

CI uses the same hash-checked binary-only installation and `pip check`. Test
actual Linux wheels and the staged Vercel function before promoting to feida.au.
Accepting a local installation alone is insufficient production evidence.
