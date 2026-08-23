# AFFLATUS M10 — Restrained Cinematic Lighting

Date: 2026-08-23
Scope: M10 materials, engine treatment and selective post-processing.

## Outcome

`src/showcase/experience/cinematicPipeline.js` adds a restrained lighting and post-processing contract:

- ACES Filmic tone mapping with route-authored exposure;
- one cold structural rim and one weak warm planetary reflection;
- separate engine emissive materials and two bounded engine lights;
- Command Orange for authored paths/actions and Ion Cyan for navigation/environment;
- selective bloom only on three named emissive/navigation objects in High profile.

The carrier material pass preserves readable roughness and normals in shadow. Bloom strength is capped at `0.52`; it never affects the DOM or the full carrier. Medium, Mobile, Static and Reduced profiles disable bloom, and the silhouette remains readable without it.

## Verification

- material naming, light count, ACES and selective-bloom ownership: `tests/m10CinematicPipeline.test.js`;
- browser comparison with bloom enabled/disabled and profile downgrade: `e2e/m09-m10-scene.spec.js`;
- visually inspected engine-pass evidence: `docs/refactor/screenshots/m10-engine-lighting-desktop-1440x1000.png`.

No global glow, animated film grain or additional render loop was introduced. No commit was created for M10.
