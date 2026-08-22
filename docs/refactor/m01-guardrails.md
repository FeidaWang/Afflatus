# AFFLATUS M01 guardrails and rollback

## Single configuration entry point

`src/config/experienceMode.js` is the single home-experience resolver. It exposes four modes:

- `cinematic` — current React showcase plus interactive Three.js command deck.
- `static` — same React content/data and Command Deck information, with the interactive DeckScene replaced by a static poster surface.
- `reduced` — selected for `prefers-reduced-motion` or Save-Data; it uses the same static command-deck path.
- `legacy` — redirects to the existing `portfolio.html` experience; no business content is duplicated.

## Configuration and environment policy

| Input | Scope | Effect |
|---|---|---|
| `VITE_CINEMATIC_HOME_V2=false` | Preview or production build | Force `legacy` home |
| `VITE_AFFLATUS_EXPERIENCE_MODE=cinematic\|static\|reduced\|legacy` | Preview or production build | Explicit mode; takes priority over the boolean flag |
| `?experience=<mode>` | Development/localhost, or preview with the explicit allow flag | Temporary review override; ignored on public production hosts |
| `VITE_AFFLATUS_ALLOW_EXPERIENCE_QUERY=true` | Explicitly configured preview | Allows the review query override outside localhost |

Default production behavior remains `cinematic`, preserving the existing `/` experience. Preview deployments can select `static` or `legacy` through an environment variable before merging future modules. The query override exists only for local/preview review and does not persist in storage.

For local browser verification only, `?scene=unavailable` simulates an unavailable Deck WebGL initialization. It is restricted to localhost and exists solely to exercise the automatic fallback contract.

## Failure and rollback contract

```text
cinematic scene import / WebGL initialization failure
  -> static showcase with poster deck
  -> legacy /portfolio.html only if static rendering itself fails
```

- Existing legacy Home/Deck remains at `/portfolio.html`, including localized paths such as `/zh/portfolio.html`.
- Locale, query parameters, and anchors are preserved on the legacy redirect.
- The static/reduced route reuses the existing showcase content source; it does not introduce a copied data model.
- Existing analytics, bilingual URLs, and accessibility labels are left unchanged.

## M17 cleanup candidates

- Revisit the long-lived `portfolio.html` legacy shell only after M14/M15 establish the final Command and experiment route ownership.
- Retire review query overrides only after the feature flag has been replaced by a stable product configuration policy.
