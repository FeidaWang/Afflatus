# Melbourne local Analysis preview engineering baseline

- Date: 2026-08-16 (Australia/Melbourne)
- Work item: `CITY-REAL-P0-04`
- Package: `melbourne-flinders-federation-v1`
- Manifest SHA-256: `6ba99fc6830c46c42f740ff5de241040c971295ca79d18257cb3009adb8a7b60`
- Decision: local Analysis vertical slice accepted as engineering evidence; production release not granted

## Local-only boundary

The preview entry is `city-analysis-preview.html`. It is deliberately absent from `BUILD_ROUTES`, the sitemap, navigation and localized production output. Its client gate requires Vite development mode and a loopback hostname (`127.0.0.1`, `localhost` or IPv6 loopback). The candidate package remains under `data/city/candidates/`; no manifest, GLB or preview page is copied into `public/` or `dist/`.

The standalone page and the dev-only Cityview shell adapter share one runtime preparation layer. It hashes the manifest before parsing it, accepts candidate asset URIs only when they resolve to safe filenames below the exact package root, opens one verified package session, and freezes the first-frame budget before a renderer can start. The candidate loader then verifies the entity index and every GLB by manifest byte length and SHA-256, resolves entity home-tile dependencies, supports cancellation and returns a fail-closed fallback state.

## Frozen first-frame slice

The baseline requests LOD0 `tile-c01-r02`. Its exact direct ownership-dependency closure is:

1. `tile-c00-r01`
2. `tile-c00-r02`
3. `tile-c01-r01`
4. `tile-c01-r02`

Dependencies are not recursively expanded. Each dependency points to the home tile that already contains the complete cross-boundary entity; that home tile's dependencies describe rendering it as a separate spatial request. Recursive expansion previously loaded unrelated home tiles and was corrected before the streaming policy was frozen.

The verified first-frame asset baseline is 428,448 bytes, 22 draw calls, 6,640 triangles, 2,049 line segments and 43 points. Any change to the manifest hash or these byte/draw/triangle totals fails the preview closed until the engineering baseline is explicitly reviewed and updated.

The Three.js renderer decodes the staged GLBs with the Meshopt decoder, uses the package's local ENU/AHD coordinates, starts from one fixed camera preset and permits orbit plus a deterministic reset. Camera target and distance select one primary spatial tile and LOD0/1/2 with hysteresis. Every possible primary-tile direct-dependency set remains below 1,100,000 visible bytes, 36 draw calls and 40,000 triangles.

Decoded tile/LOD assets are reference-counted. An unreferenced deterministic LRU is capped at 2,500,000 bytes and 18 decoded assets; eviction disposes geometries, materials and textures without releasing the active renderer. Superseded loads are aborted and a failed spatial update retains the last verified visible set. The renderer also raycasts `_FEATURE_ID_0`, resolves the stable entity/layer identity from the GLB feature table, marks the hit and exposes the source-layer attribution pinned by the manifest.

## Browser evidence

A 1440 × 1000 headless Chromium run against the loopback Vite server reached `ready` with all four baseline tiles. Runtime renderer telemetry matched the visible package baseline exactly at 22 draw calls and 6,640 triangles. Six subsequent programmed camera views exercised multiple precinct edges and all three LODs. The run decoded 28 tile/LOD assets, evicted 10, returned to the baseline with 18 resident assets / 1,976,200 resident bytes, and never exceeded either LRU limit. A real click resolved `melbourne-buildings-2023:13763` and its `City of Melbourne — 2023 Building Footprints, licensed CC BY.` attribution.

The earliest unseparated smoke runs observed render p95 values from approximately 0.5 ms after warm-up to 25.2 ms in a cold transition window. They remain historical diagnostics rather than an approval. Camera reset succeeded, `aria-busy` returned to `false`, the home route also returned HTTP 200, and the run recorded zero console errors, page exceptions, failed requests or Vite error overlays.

## Reproducible visual and stability evidence

The original dev-only candidate recorded two Playwright viewport baselines: the verified fixed-camera Analysis view and the injected-offline poster view. Their historical SHA-256 hashes and byte lengths remain preserved in both the five- and 30-minute stability evidence. On 2026-08-17 the dev-only environment selector changed shell pixels without changing the Analysis camera, geometry, LOD or package truth, so both current screenshots were refreshed by a clean Chromium regression. The evidence records both the historical hashes and this explicit refresh rather than implying that the formal soak was rerun. These are local desktop engineering snapshots; their platform suffix is intentional and they do not represent physical mobile devices.

A separate 303,897 ms headless Chromium window cycled six spatial targets through LOD2, LOD1 and LOD0, waiting for each of the 18 distinct selections before proceeding. Across 565 transitions and 251 one-second heap samples, every sample remained WebGL, within visible/resident budgets, without lifecycle fallback or horizontal overflow. The run decoded 1,460 assets and evicted 1,442; the final resident set was 18 assets / 2,041,028 bytes. After discarding the first 20 percent, the heap window median moved from 29,658,148 to 30,003,688 bytes (`+345,540`), with a fitted slope of approximately 42,783 bytes/minute.

The formal release soak then ran for 1,804,051 ms without restarting the renderer. It completed 3,373 transitions across all 18 views and collected 1,499 distinct heap samples. After the same 20 percent warm-up exclusion, the heap window median moved from 29,500,608 to 29,616,360 bytes (`+115,752`); the fitted slope was approximately `−9,569 bytes/min`, below the `4 MiB/min` release limit. The run decoded 8,480 assets, evicted 8,462 and finished at 18 resident assets / 2,041,028 bytes. Every sample remained WebGL, within visible and resident budgets, without lifecycle fallback, browser errors or horizontal overflow.

The 30-minute run measured a 670 ms cold boot and separated 180-frame CPU render windows of 0.3 ms cold p95, 0.2 ms warm p95 and 0.3 ms maximum steady p95 on the recorded Apple M4 Pro host. These are renderer CPU durations, not GPU frame time or thermal evidence. The five-minute intermediate record remains preserved in `2026-08-16-melbourne-analysis-stability-5m.json`; the formal result is pinned separately in `2026-08-16-melbourne-analysis-stability-30m.json`.

## Existing-shell fallback matrix

The same verified runtime can now be mounted into the existing `cityview.html` DOM shell only when Vite development mode, a loopback hostname and the explicit `analysis-preview=melbourne` query are all present. This is an engineering adapter, not a production feature flag. In this mode the shell replaces its concept copy with candidate/package truth, hides the construction timeline, simulated metrics, profile switching, concept layers, tour and seed controls, and retains only language switching plus a renderer-dependent camera reset. If rendering or verification fails, reset stays disabled while the poster, manifest/source copy and accessible summary remain usable.

A real Chromium matrix passed the normal public concept path plus the Analysis success, injected first-GLB 404, corrupted-checksum and offline paths. Success reached `webgl`; all three failures reached `poster` with distinct fail-closed codes. In every Analysis case the DOM truth class remained `licensed-real-data-candidate`, the source summary stayed readable, simulated controls stayed hidden, and there were zero console errors or uncaught page exceptions. Visual inspection at 1440 × 1000 confirmed both the successful massing view and offline poster state after a CSS cascade defect that initially left hidden controls visible was corrected. Separate success/poster WCAG 2 A/AA and WCAG 2.1 A/AA Axe runs reported zero violations; Chinese switching preserved the candidate/source truth, and reset remained enabled only in the successful renderer state.

The production build tree-shakes the dev-only adapter and its verified runtime/renderer dependency path. No candidate package ID, adapter module, GLB, standalone preview page or licensed-source runtime copy appears in `dist/` or `public/`; the normal production Cityview continues to use the generated concept adapter.

## EnvironmentClock and style-twin slice (2026-08-17)

The local Cityview adapter now exposes `Analysis`, `Day`, `Sunset`, `Night` and `Auto · Melbourne local` environment requests. `EnvironmentClock` calculates the Sun for Melbourne CBD (`−37.817`, `144.967`, 15 m; `Australia/Melbourne`) using Astronomy Engine and converts azimuth/altitude to the candidate's East/Up/North axes. Fixed modes use explicit reproducible instants. Auto-local accepts an explicit clock instant from the shell and has no hidden wall-clock read inside the pure clock model. Solar altitude bands are Day at or above 8°, Sunset/civil twilight above −6°, and Night at or below −6°. Analysis remains a neutral style and deliberately retains the original fixed engineering light rather than presenting its preset solar position as observed lighting.

`cityStyleTwin.ts` owns four immutable semantic palettes across the seven named GLB material roles. The renderer stores each decoded material's authored baseline in a `WeakMap`, mutates existing material instances in place, and restores the exact baseline on return to Analysis. An environment switch creates no replacement geometry or material and performs no disposal; subsequently streamed assets receive the currently selected style immediately. Night uses a restrained cool building emissive layer and the shell explicitly labels that glow as simulated. No environment texture or external weather resource is fetched.

The control is created only by the dev-loopback Cityview branch. Its bilingual selection changes scene background, fog, hemisphere light, directional light, exposure and semantic material values while preserving camera position/target, primary tile, LOD, resident bytes, resident asset count, decoded count, picking IDs and source attribution. An unknown environment or injected environment failure resolves to the verified Analysis snapshot without triggering the WebGL lifecycle fallback. The UI exposes that fail-closed state instead of silently claiming the requested mode.

Picked-entity identity is now independent of transient shell status text. A successful raycast stores the stable entity/layer/tile/LOD and local ENU/AHD hit position in renderer telemetry; the shell enriches it from the verified manifest source-layer map with provider and exact attribution. A separate bilingual live-status DOM remains visible when environment or language status changes, and clears only on an explicit empty-space pick or renderer teardown. The node is created only by the dev-loopback branch and remains absent from production output.

Chromium invariant tests switched Analysis → Day → Sunset → Night and confirmed identical camera, spatial selection and cache/decode facts at every step. Current 1440 × 1000 baselines cover all four styles plus the offline Analysis poster; hashes and byte lengths are pinned in `2026-08-17-melbourne-environment-engineering.json`. Browser page/console errors were zero, and the night panel contrast was corrected after visual inspection. The earlier Analysis-only soak remains historical evidence; the separate multi-environment formal result below supersedes only the previously open long-soak item, while physical-device review remains open.

The soak driver rotates all four fixed environments while traversing the existing 18 spatial/LOD views and asserts each sample's environment/style identity, styled-material count, render/cache budgets and lifecycle state. A 15,000 ms requested smoke measured 19,035 ms, completed 23 loop iterations / 24 environment switches, visited all 18 views and four environments, and finished at 17 assets / 2,366,876 resident bytes after 101 decodes and 84 evictions. Cold/warm CPU render p95 was 0.3/0.2 ms. Its 11-sample heap median grew by 4,724,284 bytes; the fitted short-window slope is explicitly not accepted as long-term evidence. The exact historical smoke record is `2026-08-17-melbourne-multi-environment-smoke.json`.

The formal multi-environment run then measured 1,803,605.692 ms in one uninterrupted page lifetime. It completed 4,236 loop iterations / 4,237 environment switches, visited all 18 spatial/LOD views and all four environments, and collected 1,454 distinct heap samples. After discarding the first 20 percent, the steady heap median moved from 20,910,884 to 23,606,912 bytes (`+2,696,028`); the fitted slope was approximately 220,946 bytes/minute, below the 4 MiB/minute limit. Cold/warm CPU render p95 was 0.4/0.2 ms and the maximum steady p95 was 0.3 ms. The run decoded 10,633 assets, evicted 10,616 and finished at 17 resident assets / 2,372,728 bytes. Every sample stayed WebGL, within visible and resident budgets, inside the environment/style contract, without lifecycle fallback or horizontal overflow; browser console/page errors were zero.

An earlier attempt was invalidated at approximately 3.4 minutes when the ordinary Vite HMR client lost its server connection and reloaded the page, destroying the in-flight execution context. The formal harness therefore retains the `import.meta.env.DEV` production boundary but uses `vite.city-analysis.config.js` with HMR disabled. Long-run Playwright trace screencasts are also disabled because continuously recording a changing WebGL canvas would generate measurement-distorting I/O; failure screenshots and the browser-error postcondition remain active. A repeated 15-second qualification passed before the formal timer started. The exact formal record, including the invalidated attempts, harness settings and limits, is `2026-08-17-melbourne-multi-environment-stability-30m.json`.

## Remaining boundary

This closes the loopback-only full-precinct spatial/LOD path, the existing-shell DOM/poster failure matrix, deterministic EnvironmentClock/style-twin slice, reproducible desktop visual baselines, the 30-minute Analysis-only and multi-environment warm/cold engineering soaks, and desktop automated Axe pass, but not `CITY-REAL-P0-04` as a whole and not any production gate. Manual accessibility review and desktop/iPhone/Samsung physical-device GPU, thermal and gesture sign-off remain open. All four package approvals remain `review`, the production registry remains `melbourne: null`, and the current public Cityview continues to render its generated concept adapter.
