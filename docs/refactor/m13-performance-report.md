# AFFLATUS M13 — Performance and Quality Governance Report

Date: 2026-08-23
Scope: resource profiles, dynamic quality, compressed surfaces and lifecycle governance.

## Quality matrix

| Profile | Target | DPR | Carrier | Dust | Bloom | KTX2 surface |
|---|---:|---:|---|---|---|---|
| High | 60 fps | 1.50 | full | yes | selective | idle-loaded |
| Medium | 45 fps | 1.25 | reduced | yes | no | no |
| Mobile | 30 fps | 1.20 | reduced | yes (~35% of High) | no | no |
| Static | no RAF | n/a | poster | no | no | no |
| Reduced | no RAF | n/a | poster | no | no | no |

Static, Reduced Motion, Save Data and unsupported-WebGL paths retain zero initial Three.js scene load. The High profile loads its surface textures during idle time after the first scene frame.

## Dynamic governor

`src/showcase/experience/qualityGovernor.js` uses a smoothed frame time and changes one resource class at a time:

```text
>22 ms sustained for 2 s
  -> reduce DPR
  -> disable dust
  -> disable selective bloom

<14 ms sustained for 5 s
  -> restore in reverse order
```

Every change has a 5-second cooldown. Text, semantic content and input handling never enter the degradation ladder.

## Asset and scene inventory

Committed KTX2/Basis payload:

| Asset | Size |
|---|---:|
| `vanguard-normal.ktx2` | 1,332,545 B |
| `vanguard-orm.ktx2` | 211,608 B |
| `vanguard-detail-wear.ktx2` | 193,947 B |
| Total | 1,738,100 B / 1.66 MiB |

All three are 1024px textures with 11 mip levels. Real Chromium verification reached `surfaceTextures = ktx2-basis` and reported four texture resources including the first-frame readiness image. Estimated GPU residency is about 2–4 MiB when transcoded to a supported block format, with a conservative RGBA fallback ceiling of roughly 16 MiB.

Static topology measurement for the High scene:

- carrier: 4,312 triangles;
- complete scene: 7,124 triangles;
- 19 drawable objects, 16 geometries and 16 materials;
- 51 instanced scale references;
- three selective-bloom objects and two engine point lights.

Render-pass draw calls vary with selective bloom; the topology inventory is stored separately so post-processing calls are not confused with model complexity.

## Bundle report

Final production build, minified / gzip:

| Chunk | Size |
|---|---:|
| eager home JS (`main` + `homeExperience`) | 230.88 kB / 84.28 kB |
| home CSS (`main` + `homeExperience`) | 24.34 kB / 6.37 kB |
| deferred `SignatureScene` | 18.42 kB / 7.28 kB |
| deferred Three.js | 743.97 kB / 191.40 kB |
| deferred Three texture loader | 55.02 kB / 23.06 kB |
| procedural Vanguard helper | 7.16 kB / 2.96 kB |

The large shared Three.js chunk remains deferred and is not requested by Static/Reduced or either M14 route.

## Lifecycle and evidence

The scene pauses on `visibilitychange` and `pagehide`, resumes on `pageshow`, destroys renderer/resources on unmount, and gives a lost WebGL context a 1.2-second restore window before fallback. Context restore reuses the existing Canvas.

- governor/profile/resource unit contract: `tests/m13QualityGovernor.test.js`;
- High, Mobile, Static and context lifecycle browser coverage: `e2e/m13-performance-governor.spec.js`;
- archived Playwright trace: `docs/refactor/traces/m13/m13-performance-governor-M-6a2ad-urces-in-the-authored-order-desktop-chromium/trace.zip`.

M14 route Lighthouse measurements are recorded in `lighthouse-baseline.json`. The M17 release homepage then recorded LCP 1.953–1.957s, TBT 0 and CLS 0 across three final lab runs; field budgets remain LCP ≤2.5s, INP ≤200ms and CLS ≤0.1. No commit was created for M13.
