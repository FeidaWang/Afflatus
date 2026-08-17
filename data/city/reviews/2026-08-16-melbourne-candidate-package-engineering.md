# Melbourne candidate CityPackage engineering freeze

- Date: 2026-08-16 (Australia/Melbourne)
- Package: `melbourne-flinders-federation-v1`
- Package version: `2026.08.16+engineering.1`
- Manifest SHA-256: `6ba99fc6830c46c42f740ff5de241040c971295ca79d18257cb3009adb8a7b60`
- Decision: engineering precinct and staged tile inventory frozen; release approval not granted

## Frozen engineering scope

The candidate uses the cross-layer QA bounds `WGS84 [144.9615, -37.8205, 144.9715, -37.8105]`, the anchor `[144.963, -37.815, 0]`, local ENU axes and the `Australia/Melbourne` time zone. The earlier Hoddle Grid–Docklands discovery window is not the package boundary.

The staged package contains 20 contiguous 250 m local-ENU tiles in a 4 × 5 grid, with deterministic LOD0, LOD1 and LOD2 JSON geometry assets plus 60 GPU-ready Analysis GLBs. It indexes 10,156 vector entities across the seven verified source layers and retains 9,761 native DEM cells whose transformed centres fall inside the frozen WGS84 precinct. DEM heights remain unchanged AHD values; packaging does not reproject or resample cell heights.

Terrain placement uses an explicit `EPSG:3111 → GDA94 → EPSG:8048 GDA2020 → local ENU` horizontal pipeline. This keeps the DEM's GDA94 source datum distinct from the GDA2020 survey-control coordinates while retaining AHD as the vertical authority.

All staged asset byte lengths and SHA-256 values are pinned by `manifest.json` and `entities-index.json`. The validator checks the full 250 m grid for gaps/overlaps, all three LOD references, stable entity-to-tile membership, cross-tile home dependencies, properties coverage, native terrain-cell uniqueness and the no-resampling flag.

The 60 GLBs use required `EXT_meshopt_compression`, feature-ID vertex attributes and compact embedded feature metadata. They contain no textures, so KTX2 is not applicable to this Analysis representation. The complete runtime set is 6,596,972 bytes; the largest tile/LOD asset is 332,980 bytes, the maximum observed draw-call count is 6, and all three LOD inventories contain 154,463 triangle instances in total. The LOD0/1/2 byte totals are 1,576,720 / 2,035,736 / 2,984,516 bytes and their triangle totals are 24,845 / 37,771 / 91,847.

## Release boundary

The candidate directory remains below `data/city/candidates/`; no candidate bytes were copied to `public/`, no public runtime adapter or public feature flag was enabled, and `data/city/city-package-registry.json` still records `melbourne: null`.

All four package approvals remain `review`. The earlier approvals authorize acquisition and engineering processing, not production publication. A candidate-only loader now verifies the index and every GLB by byte length and SHA-256, resolves cross-tile dependencies, supports cancellation, and fails closed to an explicit fallback result; tests also decode a staged GLB through Three.js and the Meshopt decoder. Engineering approval still requires review of this candidate and its runtime budgets. Product release remains independently required after local Analysis rendering, complete runtime adapter work, browser QA and physical-device sign-off.

This freeze closes the deterministic spatial-tile/index and optimized Analysis GLB/Meshopt candidate contracts. A subsequent loopback-only vertical-slice renderer is recorded in `2026-08-16-melbourne-analysis-preview-engineering.md`; this package freeze still does not claim public-page integration, streaming LRU/eviction and disposal, picking, dynamic attribution, texture packaging, or production Analysis/Day/Night rendering work.
