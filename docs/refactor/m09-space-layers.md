# AFFLATUS M09 — Five Space Layers and Monumental Scale

Date: 2026-08-23
Scope: M09 spatial depth and scale references on the M08 camera route.

## Outcome

The home scene now composes five independently governed layers:

```text
Deep Stars
  -> Distant Environment
  -> Midfield Dust
  -> Near-field Scale References
  -> Carrier
```

`src/showcase/experience/spaceLayers.js` owns the layer construction, profile matrix and route-driven updates. Stars are sparse and deliberately uneven, the scene contains one distant planetary limb, and dust is visible only around speed/wake passages. None of these layers changes the fixed carrier transform or creates another RAF.

## Scale evidence

Four reference classes make the ship legible without copy:

- instanced hull windows;
- hangar/aperture geometry;
- instanced escort craft and drones;
- engine apertures against the planetary limb.

High profile renders 51 scale-reference instances. Medium and Mobile reduce references, dust and distant detail independently while retaining the semantic Chapters and navigation. Scale comes from camera crop, occlusion and differential movement—not carrier `scale` animation.

## Verification

- layer/profile/instancing/pulse contracts: `tests/m09SpaceLayers.test.js`;
- real-browser visibility and scale relationship: `e2e/m09-m10-scene.spec.js`;
- visually inspected evidence: `docs/refactor/screenshots/m09-scale-without-text-desktop-1440x1000.png`.

The M08 seven-node camera route, 4,312-triangle carrier, one Canvas and one RAF contracts remain intact. No commit was created for M09.
