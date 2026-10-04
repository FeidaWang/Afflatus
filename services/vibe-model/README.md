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
capped at 30 seconds. Limits are per request, not a global usage quota.

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
