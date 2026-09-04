# Project Afflatus — Website-Wide Structural Optimization Proposal

> Audit baseline: 2026-07-25 · source tree, production build, route branches, data contracts, rendering loops, metadata, and CI inspected.
>
> This is an execution backlog, not a visual redesign brief. `design.md` remains the visual/narrative SSOT and `tech.md` remains the current architecture SSOT. Preserve the Vite MPA, page-specific identities, local-first privacy, and git-backed content pipeline unless a measured gate below explicitly justifies reopening a decision.

## 0. Executive decision

The highest-return work is not a framework migration. It is to turn the current collection of strong page implementations into a governed platform:

1. Establish one route/content/locale manifest that generates Vite entries, navigation, canonical metadata, sitemap, and redirects.
2. Establish one runtime performance coordinator for canvas/WebGL lifecycle, DPR, visibility, reduced motion, and adaptive quality.
3. Move heavy inline controllers and compute loops into testable modules/workers without changing each page's visual identity.
4. Make every interactive visualization expose a semantic DOM/table equivalent and pass keyboard/screen-reader use.
5. Generate crawlable EN and ZH documents at build time instead of relying on a client-only language toggle.

### Measured baseline

| Evidence | Current state | Architectural implication |
| --- | --- | --- |
| Delivery model | Vite 8 multi-page static site; 11 build entries; 8 active navigation routes | Keep MPA; remove retired entries and generate route wiring from one manifest |
| Build weight | `vendor-three` 674.55 kB raw / 171.29 kB gzip; home JS 191.85 kB raw / 70.28 kB gzip; Horoscope JS 211.75 kB raw / 87.25 kB gzip | Three.js must stay off non-3D critical paths; Horoscope needs feature-level splitting |
| HTML weight | Course 181.89 kB raw / 56.33 kB gzip; Sectors 59.93 kB; Signal 52.61 kB | Extract structured content at build time while preserving fully rendered HTML |
| CSS | Home bundle 229.81 kB raw / 41.71 kB gzip; large legacy layer and many historical overrides | Migrate by component family; add CSS budgets and ownership, not a rewrite |
| 3D assets | Procedural `BufferGeometry`, primitives, shaders, canvas textures; no production GLTF/GLB loader or LOD system | Retain procedural assets; introduce a gated GLB pipeline only for authored high-detail assets |
| Rendering | Multiple WebGL/canvas renderers, independent rAF/timers, DPR caps of 1/1.5/1.75/2/3, partial visibility gates | Centralize policy and lifecycle; do not merge every renderer into one monolith |
| State | URL, DOM, closure state, `localStorage`, and `sessionStorage`; homepage locale key differs from sub-pages | Locale/store migration is P0; typed page stores are P1 |
| Quality gates | Unit/type/data/build/bundle/`!important`; Playwright desktop/flagship-mobile smoke, keyboard, console, axe-regression, screenshots, and anonymous CWV transport; Lighthouse runs every active route 3× against route-specific regression budgets | Treat lab baselines as debt floors, and make production p75 the product-health decision source after sufficient traffic |

## 0A. Cityview reality-first rebuild — urgent correction (2026-08-18)

> Scope correction: `/cityview.html` must become a geographically truthful, locally recognizable city experience. A random construction whitebox with city-flavoured silhouettes is not an acceptable destination. This section overrides the earlier Cityview concept direction; the shared lifecycle and measured performance budgets in §5 still apply.

### 0A.1 Corrected product decision

1. **Keep procedural generation only as an explicitly named `Sandbox`.** Shanghai, Melbourne and Hong Kong may not load the sandbox generator and present the result as those real cities.
2. **A real-city option is evidence-backed or unavailable.** It loads an approved, checksummed CityPackage with real terrain, shoreline, roads, footprints, heights and landmarks. If that package is absent or fails validation, show a truthful unavailable/poster state; never silently substitute invented geometry.
3. **Use a hybrid model, not one universal technique:** GIS/DEM establishes spatial truth; authored landmark GLBs establish skyline identity; deterministic procedural façades cover ordinary buildings at scale; tiled HLOD/LOD streaming keeps the browser within budget.
4. **Separate truth modes.** `Reality` shows the frozen current-city model. `Construction scenario` is a clearly labelled overlay on that same geometry. `Sandbox` is the only mode in which a seed may change roads, plots or buildings. The 0–210 day simulation must not masquerade as historical reality.
5. **Build bounded core precincts before claiming whole cities.** A precinct must include the classic skyline observation axis, both sides of any defining river/harbour, the terrain that shapes the view, and the complete minimum landmark set below.
6. **Ship Shanghai first.** It has the clearest user-defined identity contract and exposes every important problem—river geometry, two-bank composition, supertall silhouettes, a historic ensemble, haze, water reflections and landmark night lighting. Reuse the completed runtime for Hong Kong and Melbourne.

The production target is therefore:

`verified spatial data → normalized city coordinate frame → tiled terrain/urban fabric → authored landmarks → city-specific façade grammar → day/twilight/night renderer → visual/geospatial/release gates`

### 0A.2 Evidence-based diagnosis of the current page

| Current evidence | Why it fails the target | Required disposition |
| --- | --- | --- |
| The live UI offers Sandbox plus Shanghai/Melbourne/Hong Kong “concepts”; `New seed` can rearrange the selected city | City identity is not spatially fixed | Retain this behaviour only in Sandbox |
| `src/pages/cityView.js` sends production profiles through `generateSandboxCity()` while `data/city/city-package-registry.json` has three `null` production entries | No public real-city data path exists | Make the production registry → verified CityPackage loader the only Reality path |
| `src/city/generate.ts` creates the same seeded 8×8 orthogonal grid, rectangular water channel and random height grammar for all profiles | Roads, blocks, shorelines and relative landmark locations are invented | Replace the real-city skeleton with source geometry; randomness may affect only non-geometric visual variation |
| `src/city/landmarks.ts` assembles generic boxes, cylinders, spheres and cones | Shanghai Tower, SWFC, Jin Mao, the Oriental Pearl and the Bund cannot be accurately recognized | Use authored, dimensioned, georeferenced landmark assets |
| `src/scene/cityScene.js` uses a flat plane and largely unlit `MeshBasicMaterial`; `src/city/ridge.ts` explicitly creates a decorative ridge rather than sampled elevation | Terrain, depth, sunlight, shadow and materials cannot look real | Use tiled DTM/DEM, PBR materials, solar lighting, atmosphere and source-aware water |
| The local Melbourne Analysis candidate already has real footprints, DEM tiles, Meshopt, checksums, LOD and an LRU loader, but is dev-loopback-only | The valuable engineering foundation is disconnected from production and from the other cities | Generalize this path rather than starting a second loader |
| The candidate night preset makes whole buildings blue-emissive | It reads as a style filter, not occupied buildings at night | Light deterministic windows and authored landmark groups; never make the whole envelope glow |

### 0A.3 Priority matrix

| ID | Priority | Effort | Deliverable | Non-negotiable exit gate |
| --- | --- | --- | --- | --- |
| CV-P0-01 | P0 | S | Split `Reality`, `Construction scenario` and `Sandbox`; remove random-seed controls from Reality | A profile switch or reload cannot move any real road, shoreline, footprint or landmark; missing real data fails truthfully |
| CV-P0-02 | P0 | L | **Completed 2026-08-18:** one production `CityPackageRuntime` shared by all three cities, adapting the existing Melbourne checksum/Meshopt/LOD/LRU/cancellation work | A non-null approved registry entry streams in the production renderer; local-preview-only renderer divergence is removed |
| CV-P0-03 | P0 | L | Per-city horizontal CRS, vertical datum, ENU origin, terrain, shoreline, roads and building-part normalization | Every vertex has traceable source/datum; buildings meet terrain; AHD, HKPD and ellipsoidal heights are never mixed |
| CV-P0-04 | P0 | XL | **Shanghai v1 reality package** covering the Bund–Huangpu–Lujiazui skyline and the full required landmark group | All Shanghai identity assets and both riverbanks appear at approved coordinates, scale, orientation and classic view composition |
| CV-P0-05 | P0 | L | **In progress:** shared city environment clock and physically based day/twilight/night renderer; solar-altitude-continuous ACES/PBR, city-specific procedural outdoor sky/IBL, bounded shadows, windows and dielectric IBL water are now on the production path | Local solar position, PBR/IBL, bounded shadows, exposure and water respond continuously without changing geometry or IDs |
| CV-P0-06 | P0 | L | **In progress:** deterministic ordinary-building windows, exact authored-only street/aviation/landmark material grammar, stable beacon pulses and city landmark colour mappings are live without whole-envelope emission. Three-city light-group/LOD/golden contracts plus manifest- and GLB-byte-level asset admission are frozen; approved light geometry/rigs and captured goldens remain | No whole-building glow; deterministic windows, street lights, beacons and landmark lighting pass night goldens on desktop/mobile |
| CV-P0-07 | P0 | M | **In progress:** production manifests require same-package landmark admission and at least five frozen canonical views. Registry/CI re-hashes the admission JSON, every LOD GLB, every desktop/mobile night golden and silhouette mask, and ordered 30-minute desktop/mobile performance traces; it parses trace coverage and release budgets, requires the exact frozen AOI/origin, recomputes each camera's horizontal ENU pose from WGS84 and rejects >5 cm drift or wrong order/FOV. Actual captured evidence and device sign-off remain | A package cannot enter the public registry until every gate and four-role approval is green |
| CV-P0-08 | P0 | XL | **Hong Kong v1 reality package** centred on Victoria Harbour, Central, Victoria Peak and Kowloon/West Kowloon | Harbour width/shoreline, Peak terrain and the minimum two-bank skyline are recognizable from fixed views |
| CV-P0-09 | P0 | L | **Melbourne skyline package**, expanding beyond the current Flinders–Federation engineering slice | Hoddle Grid, Yarra/Southbank and the minimum CBD/Southbank landmarks form a recognizable skyline |
| CV-P1-01 | P1 | L | City-specific ordinary-building façade and roof grammar driven by footprint parts, use, era, levels and height | White boxes and full-height random stripes are gone; near/mid/far tiers preserve roofline and local typology |
| CV-P1-02 | P1 | M | Water, terrain material, vegetation, bridges, rail and bounded traffic layers | Defining natural/infrastructure edges remain correct and coherent across tile seams and LOD changes |
| CV-P1-03 | P1 | M | **In progress:** canonical WGS84 camera order/FOV and package-local ENU poses are release-gated, and the production first frame now uses the first admitted view instead of a generic bounds-derived camera. View selector, labels, collapsible HUD and full-screen remain | No hero is cropped or hidden by the HUD; every view names its model/data source and precision |
| CV-P1-04 | P1 | M | 3D Tiles adapter plus screen-space-error HLOD where an approved upstream package uses that standard | Adapter retains the same cancellation, cache, attribution, failure and GPU-budget rules as native CityPackages |
| CV-P2-01 | P2 | L | Weather, cloud, rain/wet roads, seasonal vegetation, boats, trains, people and richer traffic | Begins only after all three P0 city identity contracts and their day/night gates pass |
| CV-P2-02 | P2 | M | High-tier SSAO/SSR/TAA or equivalent refinements | Each effect survives an A/B frame trace and has a lower-tier fallback; visual novelty alone is insufficient |

### 0A.4 Minimum city identity contracts

These are release floors, not exhaustive tourism lists. A landmark name in the UI must map to a real asset ID, not a generic form label.

| City / first precinct | Fixed geographic composition | Minimum authored landmarks and ensembles | Mandatory reference views |
| --- | --- | --- | --- |
| **Shanghai / 上海** — the Bund, Huangpu River, Lujiazui and enough North Bund/background fabric to close the skyline | Real Huangpu bend and width; accurate Pudong–Puxi relationship; Suzhou Creek mouth and Waibaidu Bridge; Lujiazui roads/plots; continuous Bund street wall; terrain/building bases in one approved vertical frame | Oriental Pearl (468 m; correct legs, spheres, columns and antenna), Shanghai Tower (632 m; true taper/twist and crown), Shanghai World Financial Center (492 m; trapezoidal aperture), Jin Mao Tower (421 m; tiered pagoda proportions), plus **all 52 Bund buildings as a continuous LOD1 group** and landmark-grade Customs House, the former HSBC Building, Sassoon House/Peace Hotel, Bank of China and Asia Building façades/roofs | Puxi/Bund looking east at Lujiazui; Pudong looking west at the Bund; oblique river axis showing all four Pudong icons; Bund street-wall and Waibaidu Bridge view; one landmark close view per hero |
| **Hong Kong / 香港** — Central/Admiralty, Victoria Harbour, Tsim Sha Tsui and West Kowloon with Victoria Peak terrain | Real harbour width and both shorelines; Hong Kong Island relief and Peak ridgeline from DTM; Central–Kowloon height relationship; piers/reclamation edges and principal roads | Bank of China Tower, HSBC Main Building, Two IFC, ICC, Central Plaza, The Center and Hong Kong Convention and Exhibition Centre; the Tsim Sha Tsui Clock Tower, Hong Kong Cultural Centre and Star Ferry pier form one waterfront group; Victoria Peak is a terrain hero, not decorative scenery | Tsim Sha Tsui looking south; Peak/upper island looking north; harbour oblique joining IFC–Central–Wan Chai–ICC; one Central, one Tsim Sha Tsui and one West Kowloon hero view |
| **Melbourne** — Hoddle Grid, Yarra, Southbank, the sports precinct and the skyline seen across the river | Real Hoddle Grid, rail corridor, Yarra banks, Princes Bridge and Southbank relationship; AHD-based terrain and building bases; current Flinders–Federation package retained as a verified inner tile set but not mislabelled as the complete skyline | Flinders Street Station, Federation Square, Arts Centre Spire, St Paul’s Cathedral, Eureka Tower, Australia 108, Rialto Towers and 120 Collins Street, with podium/setback parts retained from the official footprints; MCG retains its oval mass and six light towers at a farther HLOD | Southbank/Yarra looking north; CBD looking south to Southbank; Flinders–Federation civic axis; west/east skyline obliques; one heritage, one supertall and one sports-precinct view |

Shanghai’s published heights above are hard validation inputs, not artist estimates. Every landmark record must also freeze the approved footprint, ground reference, yaw and antenna/spire inclusion rule so “architectural height” is not mixed with roof or terrain elevation.

### 0A.5 Real-city data and modelling pipeline

1. **Freeze the AOI and coordinate contract.** Record WGS84 bounds, authoritative projected CRS, vertical datum, local ENU origin, unit scale, axis convention, terrain exaggeration (`1.0` for Reality) and epoch where relevant. Keep horizontal and vertical transforms separate and tested.
2. **Acquire through the fail-closed ledger.** Archive dataset record, download-time terms, version/date, response headers where material, artifact SHA-256 and required attribution. `Open data` is discovery evidence, not automatic permission to cache, modify or redistribute a public CityPackage.
3. **Normalize without erasing provenance.** Preserve stable source IDs and source-layer lineage through reprojection, clipping, repair, triangulation and tiling. Emit QA for invalid rings, overlaps, missing heights, datum transformations, shoreline closure and terrain voids.
4. **Build the spatial base.** Terrain comes from approved DTM/DEM tiles; water is cut from real shoreline polygons and flattened to the applicable water reference; roads/rail/bridges follow source centreline or surface geometry; each building base samples the resolved terrain/waterfront condition.
5. **Generate ordinary buildings from real parts.** Use footprint and building-part geometry, `min_height`/base, top height/levels, podium/setback, roof type and use where available. A deterministic grammar may choose façade modules, window occupancy and minor material variation; it may not move or resize the source footprint or change a verified roofline.
6. **Author identity assets separately.** Model landmark topology in Blender or an equivalent DCC from rights-cleared measurements/reference material. Preserve distinctive negative space, taper, twist, stepped crowns, antennas, roof forms and group spacing that extrusion cannot reproduce.
7. **Package for the browser.** Validate scale/origin/names → glTF 2.0 → dedupe/prune/weld → Meshopt → KTX2/BasisU baseColor/normal/ORM/emissive → LOD0/1/2/impostor → tile/HLOD index → checksums, attribution and visual thumbnails. Before admission, the city-wide landmark set must prove ordered local LOD0/1/2 GLBs, metre/ENU ground anchors, exact authored light groups, no whole-envelope emission, approved mesh/texture/signage evidence and every canonical desktop/mobile night golden.
8. **Stream one coherent scene.** Terrain, buildings, landmark assets, vegetation, roads and night-light metadata for a tile share lifecycle, cancellation and disposal. A tile does not become visible before its datum/origin and critical dependencies validate.

#### Source strategy by city

| Layer | Preferred method | Restrictions / fallback decision |
| --- | --- | --- |
| Shanghai ordinary buildings/roads | Review a frozen [Overture Buildings](https://docs.overturemaps.org/guides/buildings/) and transportation extract, preserving building parts and source lineage | Overture describes 2D footprints/parts suitable for extrusion, not landmark-grade geometry; inspect local completeness and follow [Overture attribution](https://docs.overturemaps.org/attribution/). Do not publish until the separate Shanghai public-map review and redistribution review pass |
| Shanghai terrain | Acquire an approved local DTM/DEM; treat terrain as unresolved until its exact rights and vertical reference are archived | [Copernicus DEM GLO-30](https://registry.opendata.aws/copernicus-dem/) is a DSM containing buildings/vegetation and is only a coarse gap/reference fallback, not a clean urban ground truth |
| Hong Kong base city | Evaluate the HKSAR Lands Department [3D mapping programme](https://www.landsd.gov.hk/en/survey-mapping/mapping/3d-mapping.html), [3D Spatial Data API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-spatial-data-api), [individualised 3D models](https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1671676915450_88604) and official [5 m DTM](https://www.landsd.gov.hk/en/spatial-data/open-data/kf_dtm.html) for terrain, buildings, infrastructure, vegetation and water | Freeze the exact API/dataset terms, attribution, key handling, cache/redistribution allowance, source formats, LOD coverage and Hong Kong 1980 Grid/HKPD↔runtime transformation before approval; the general [CSDI terms](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC) do not waive dataset-specific restrictions |
| Melbourne buildings | [City of Melbourne 2023 Building Footprints](https://data.melbourne.vic.gov.au/explore/dataset/2023-building-footprints/) | Preserve stacked polygons for tower/podium/setback and min/max AHD; the current approved acquisition remains a candidate until engineering/product release gates pass |
| Melbourne terrain/control | Delivered Vicmap DEM 10 m plus Survey Control Marks, governed by the existing evidence bundles and [Vicmap Elevation](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-elevation) specification | Retain EPSG:3111/GDA94→GDA2020 transformation evidence and AHD separately. Ten-metre DEM is the baseline; a finer product needs its own rights and QA rather than silent substitution |
| Vegetation/land-cover context | Approved local tree inventories first; [ESA WorldCover 10 m](https://esa-worldcover.org/en/data-access) only as a coarse density/land-cover candidate | CC BY/source attribution still requires a frozen terms snapshot. Ten-metre classified cells do not locate individual trees and must not be rendered as survey-accurate vegetation |
| Streaming interchange | Native CityPackage remains the release manifest; accept [OGC 3D Tiles](https://www.ogc.org/standards/3dtiles/) through a controlled adapter when the approved source is tiled | 3D Tiles supplies hierarchical spatial streaming/HLOD, not source rights or geometric accuracy. An adapter such as [NASA-AMMOS 3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) is an implementation candidate, not a release approval |
| Google Photorealistic 3D Tiles | Optional live comparison/reference layer only if product/legal review explicitly approves the use | [Google Map Tiles policies](https://developers.google.com/maps/documentation/tile/policies) restrict caching, extraction, tracing/derivation and require Google plus dynamic attribution. Never use them to derive or bake self-hosted Afflatus meshes/textures |
| Reference photography | Rights-cleared evaluation and art-direction references with recorded camera/lens assumptions | Do not redistribute or trace a photograph merely because it is publicly visible; building model, image, texture, logo and signage rights are separate review items |

Shanghai release remains legally/compliance blocked until a qualified review resolves the applicable public-map workflow, required approval/review number display, service/hosting obligations and data/imagery rights. The [national Map Management Regulation](https://www.gov.cn/zhengce/zhengceku/2015-12/14/content_10403.htm) and [Shanghai municipal map-management guidance](https://www.shanghai.gov.cn/nw12344/20210526/1f08ddbb59384a67a1de0a21a1e91ad0.html) are review inputs, not engineering shortcuts or legal conclusions in this document.

### 0A.6 Landmark Asset Contract

Every landmark or named ensemble must have one versioned manifest record containing:

- stable ID and local/English name; city/precinct and source-evidence URLs;
- geodetic anchor, ENU transform, approved footprint, yaw, unit scale, ground/top elevation, vertical datum and height definition;
- source `.blend` ownership, modeller, measurement/reference provenance, texture/logo/signage rights and attribution;
- `LOD0`, `LOD1`, `LOD2` and silhouette/impostor assets with screen-space thresholds and a no-pop transition rule;
- KTX2 base colour, normal and packed ORM maps; separate emissive groups/maps for windows, crown, antenna, façade wash and obstruction lights;
- day/twilight/night material parameters, picking/collision bounds, semantic label and accessible text equivalent;
- fixed hero cameras with target, position, vertical field of view, near/far planes and expected unoccluded framing;
- source/derived hashes, triangle/texture/draw-call budgets, validation results, approval state and rollback version.

For Shanghai v1, authored modelling must explicitly preserve:

- the Oriental Pearl’s support legs, sphere count/diameter hierarchy, columns and antenna—not three generic balls on a mast;
- Shanghai Tower’s asymmetric rounded triangular plan, taper and continuous twist—not stacked cylinders;
- SWFC’s trapezoidal aperture as true negative geometry visible at every skyline LOD;
- Jin Mao’s repeated tier rhythm and pagoda crown—not a generic stepped box;
- the Bund’s individual façades, cornices, domes/clocks/roof silhouettes and exact street-wall spacing as a coordinated ensemble—not one textured slab.

Official dimension references are pinned from the Shanghai Government’s [Oriental Pearl entry](https://english.shanghai.gov.cn/en-ScenicSpots/20231205/19a5f5184eca45728fd57a4d4c8efc61.html), Gensler’s [Shanghai Tower project](https://www.gensler.com/projects/shanghai-tower), SOM’s [Jin Mao Tower project](https://www.som.com/projects/jin-mao-tower/) and the Shanghai Government’s [Lujiazui city tour](https://english.shanghai.gov.cn/en-CityTour/20231226/c3c795cf933a43b7aadfed6608d24f.html). The official Shanghai tourism record for [the Bund and Waibaidu Bridge](https://www.meet-in-shanghai.net/en/huangpu-district/the-bund-648313/) pins the 1.5 km/52-building ensemble requirement. References validate dimensions and identity; they do not grant mesh or texture rights.

### 0A.7 Day, twilight and night rendering contract

The existing Astronomy Engine work should become manifest-driven for `Asia/Shanghai`, `Asia/Hong_Kong` and `Australia/Melbourne`, using each precinct’s latitude/longitude and IANA time zone. Required controls are `Day`, `Sunset`, `Night`, `Auto local` and an optional continuous local-time slider. Environment changes must never alter building geometry, feature IDs, tile membership, picking or camera targets.

| State | Required rendering behaviour | Forbidden shortcut |
| --- | --- | --- |
| Day | Solar azimuth/elevation drives a directional sun; PBR façades use linear colour workflow, ACES tone mapping, city-specific procedural sky/PMREM IBL, camera-bounded shadows, ambient contact depth, distance haze and water Fresnel/normal response | Flat unlit white materials; one global colour overlay; unlimited full-scene shadow map |
| Twilight | Continuous sun/sky/exposure transition; longer shadows; warm horizon/cool upper sky; windows, street lights and landmark rigs ramp on in staged groups; water carries controlled bright-source reflections | Abrupt preset cut or turning every light on at one threshold |
| Night | Dark but legible PBR envelopes; deterministic per-floor/per-window emissive atlas or instance mask driven by use/occupancy; authored crown/antenna/façade lighting; aggregated street/vehicle/navigation lights; lower exposure and selective high-threshold bloom | Making the entire building emissive; a point light per window; global blue tint; bloom on ordinary white surfaces |
| Auto local | Local civil time and computed sun position choose/blend the state; UI shows city time and permits an explicit override | Browser-local time applied to every city; changing simulation/construction time implicitly |

Implementation rules:

- Use `MeshStandardMaterial`/`MeshPhysicalMaterial` for production city surfaces. Prepare image-based lighting with [Three.js PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html); annotate colour and non-colour maps according to the official [Three.js colour-management guidance](https://threejs.org/manual/en/color-management.html).
- Use shared emissive texture atlases/arrays and instanced occupancy bits for ordinary towers. One deterministic seed per building may vary lit windows, but the same city/time/test seed must reproduce the same frame.
- Landmark light rigs are authored metadata, not thousands of runtime lights. Use emissive maps for façade/crown patterns, a small bounded set of actual lights only where they affect nearby surfaces, and high-threshold selective bloom only on the high tier.
- Shanghai night art direction requires a warm, continuous Bund façade ensemble opposed by individually authored Pudong landmark rigs and elongated Huangpu highlights. Hong Kong requires dense but nonuniform windows, harbour navigation cues and atmospheric separation from the Peak. Melbourne requires restrained CBD/Southbank windows, warm heritage/street lighting and Yarra reflections.
- Do not invent licensed billboard copy, corporate logos or neon signage. Geometry, façade texture, lighting pattern and signage each need their own evidence/rights decision.
- Low tier disables bloom, high-resolution shadows, reflection passes and dense traffic first; it retains correct exposure, sun/time state, silhouette, terrain, shoreline and the emissive window atlas.

### 0A.8 Streaming and browser-performance method

- Preserve the existing CityPackage checksum, direct-dependency, abort, LRU, disposal, rollback and dev-soak disciplines. Replace its local-only entry restriction; do not replace its safety model.
- Tile the core precinct at a measured 256–512 m range. Select tile/HLOD by projected screen-space error with hysteresis; preload a narrow camera-motion ring, cancel obsolete requests and never prefetch the whole city.
- Distant LOD prioritizes skyline silhouette, landmark negative spaces, terrain ridge and shoreline over windows or street furniture. Mid LOD restores podium/setback/roof grammar. Near LOD adds façade maps and bounded detail.
- Use glTF 2.0 with Meshopt and KTX2/BasisU. The official [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) supports the required compression/texture/instancing extensions; unsupported capability paths must be tested rather than assumed.
- Instance repeated ordinary-building modules, trees, lamps and furniture; atlas materials by city/typology; merge only objects with the same lifetime/selection semantics. Never merge away stable feature IDs or per-building provenance.
- Do not create a real light per illuminated window. Night adds an emissive atlas and small aggregate light budget, not a draw-call/light explosion.
- Treat the existing §5 budgets as the **first visible/active working-set budgets**, not a total-city download allowance: desktop/mobile active triangles ≤350k/120k, draw calls ≤120/70, initial compressed visible 3D payload ≤3 MB/1.5 MB and active GPU assets ≤220/140 MB. Raise a limit only from a captured trace and a documented visual necessity.
- Poster/semantic content renders before opt-in; mobile/low tier begins one LOD lower; repeated p95 frame overruns reduce shadow resolution/reflections/traffic/façade detail before they reduce terrain or landmark silhouette accuracy.

### 0A.9 Reality release gates

#### Geometry and data

- 100% of the city’s minimum landmark set is present; every hero has approved source identity, anchor, orientation, footprint and height definition.
- Landmark top-height error is ≤1% against the approved reference unless the source’s stated accuracy is worse; horizontal/vertical tolerances are source-aware and recorded rather than silently tightened.
- Reality uses `1 unit = 1 metre`. Melbourne GDA94/VicGrid + AHD, Hong Kong 1980 Grid + HKPD and any WGS84/geoid-based fallback remain explicit transformation paths with round-trip tests; no source silently inherits another city’s vertical frame.
- Terrain comparison stays within the source product’s published accuracy and the package’s frozen control-point QA. Shoreline, bridge and building/terrain seams have zero critical gaps or floating/intersecting heroes.
- A DSM containing buildings or vegetation is ground-filtered/masked before extruded buildings and trees are added; duplicate surface height is a build blocker. Water is level in its approved reference and building bases use a documented terrain-footprint sampling rule.
- Changing a visual seed changes only approved façade/window/material variation. A test hashes roads, water, terrain, footprints and landmark transforms before/after and requires byte-equivalent spatial identity.
- Datum/CRS round trips, tile edges, stable IDs, LOD membership and attribution lineage are unit- and package-tested for all three cities.

#### Visual identity

- Freeze at least five registered reference cameras per city plus one view per hero. Capture day, twilight and night at deterministic date/time, viewport, DPR, quality tier and exposure.
- For each camera, compare skyline/shoreline/terrain edge overlays against a rights-cleared reference with recorded camera/lens assumptions. Establish a reviewed edge-distance/silhouette baseline, then fail any regression; landmark-set recall must remain 100%.
- Manual sign-off answers a plain question: without reading labels, can a reviewer identify the city and every required hero from its canonical views? Generic resemblance is a failure.
- Night goldens verify lit-window distribution, dark-envelope preservation, landmark rigs, bloom containment and water response. A luminance mask must catch whole-envelope emission.
- The same feature remains selectable and in the same world position across Day/Sunset/Night and across LOD transitions.

#### Product, accessibility and failure

- Controls expose city, truth mode and local environment independently. Keyboard/touch users can select every state; reduced motion removes tours/time animation while leaving a static chosen time; a DOM summary lists all visible named landmarks and sources.
- Hero framing is not obscured by the control deck. Provide `Collapse HUD`, full-screen, reset, landmark labels and a visible data/precision/attribution panel.
- Missing, blocked, offline, 404 or checksum-failed packages retain a truthful poster/DOM state and retry affordance. They never fall through to a fake Shanghai/Hong Kong/Melbourne.
- Desktop and flagship-mobile tests cover three cities × Day/Sunset/Night × canonical cameras, registry approval, attribution, WebGL loss/restore, reduced motion, lower quality and package failure injection.
- Performance gates use p95 frame time, active GPU bytes, draw calls, visible triangles, long tasks and 30-minute camera/city/environment switching soak—not a single warm screenshot.

#### Rights and release

- Every source and derived landmark/texture has a frozen terms snapshot, artifact hash, required attribution and explicit acquisition, engineering, legal/data-owner and product-release decisions.
- ODbL-derived buildings/roads/water remain a separately identifiable data layer. A public derived database follows the approved ODbL share-alike/attribution and data-or-reproducible-rebuild offer; original landmark GLBs, code and textures stay separated so database obligations are not blurred into unrelated assets.
- Landmark meshes and textures must be original, commissioned with ownership, or explicitly licensed for modification and web redistribution. Unknown Sketchfab/marketplace assets and geometry traced from Google/Baidu/other restricted map imagery or tiles are rejected.
- Public-map compliance, dataset redistribution, reference-image use, authored-mesh ownership, façade texture, logo/signage and live API terms are separate gates; approval of one never implies the others.
- Only `approved` packages enter `city-package-registry.json`. Files placed under a public path without a registry approval remain unreachable by production.

### 0A.10 Execution waves

#### CV Wave 0 — Truth boundary and frozen contracts (2–4 days)

- [x] **Completed 2026-08-18:** rename the current generator mode Sandbox; remove concept-city claims and real-city randomization; define Reality/Scenario state contracts.
- [x] **Completed 2026-08-18:** freeze the three precinct/AOI proposals, local coordinate frames, minimum landmark manifests, canonical cameras and source/rights checklist in `data/city/city-reality-contracts.json`, guarded by the data validator.
- [x] **Exit passed 2026-08-18:** production cannot label generated geometry as a real city; missing packages fail closed and tests prove real-city spatial hashes ignore seeds.

#### CV Wave 1 — Unified real-city runtime (1–2 weeks)

- [x] **Completed 2026-08-18:** generalize the Melbourne candidate loader/renderer into one production-capable CityPackage runtime; retain fail-closed registry, checksums, Meshopt, LOD, LRU, cancellation, source attribution and last-verified-tile retention.
- [ ] **In progress:** generalize `EnvironmentClock` and PBR day/twilight/night rendering across all city manifests. The common city/time-zone/solar state, accessible public controls, ACES/PBR, city-specific procedural outdoor sky/IBL, bounded shadows, deterministic façade-window masks and non-metallic IBL water with bounded animated specular breakup are complete on the production path. Exposure, atmospheric scattering, direct/hemisphere light, IBL, windows and water now interpolate continuously from exact solar altitude rather than stepping at Day/Sunset/Night classification boundaries. Auto-local refreshes from an explicit real clock every minute, pauses while hidden, recalibrates on foreground return, stops on fixed presets/destruction and retains the last verified state on refresh failure. First-pass Huangpu, Victoria Harbour and Yarra water colour, roughness, ripple scale, speed and directional specular profiles are implemented and explicitly labelled `art-directed-visual-only`; approved-reference fixed-camera calibration is still required. Authored-only street/aviation/landmark materials, deterministic aviation pulses and Shanghai/Hong Kong/Melbourne landmark palettes are implemented; missing source light geometry remains zero rather than being procedurally invented. The reality contract now freezes each minimum landmark's required light groups, LOD0/1/2, light LOD0/1, no-envelope-emission rule and all canonical desktop/mobile night goldens. Manifest admission rejects incomplete LODs, remote/non-checksummed GLBs, invented prefixes, unapproved mesh/texture/signage rights and missing goldens; a second byte-level gate recomputes SHA-256 and inspects every GLB material table for missing/undeclared light groups and emissive `buildings-*` envelopes. Approved landmark meshes/light rigs and captured goldens remain under CV-P0-06.
- [x] **Runtime exit passed 2026-08-18:** a synthetic licensed fixture package follows the exact production route on desktop/iPhone/Galaxy, including corrupt-asset failure and a deterministic night-state path.

The production path now verifies registry path/hash/identity and four-role approval, loads a budgeted first-frame dependency closure, decodes Meshopt GLBs, streams generic LODs through the shared LRU/cancellation renderer, exposes manifest source/CRS/datum attribution and keeps failures on the truthful poster. A production manifest must reference a same-package schema-v2 `landmark-admission.json` and carry at least five canonical local views; the build/release gate loads the frozen city contract, re-hashes the admission document, every LOD GLB, every canonical desktop/mobile night golden and silhouette mask, and each ordered 30-minute desktop/mobile performance trace. Trace content must cover every canonical camera in day/twilight/night and remain inside the production WebGL draw-call, triangle, p95 frame-time, active-GPU-memory and horizontal-overflow budgets. The gate also requires the exact frozen AOI/origin, then recomputes horizontal `x=east,z=-north` camera coordinates from WGS84 with a 5 cm tolerance. Camera order, bilingual public names and FOV are exact contract checks, while local-datum Y values require explicit evidence. The production first frame uses the first admitted view rather than inventing a bounds-derived camera. When and only when that Reality package succeeds, the public Classic view selector exposes those admitted views; a switch updates the exact pose/FOV and verified tile stream atomically, restoring the prior camera and resident tile set if loading fails. Candidate manifests explicitly carry `landmarkAssets: null` and `canonicalViews: null`, so changing status alone cannot promote them. The public environment control switches Day/Sunset/Night/Auto-local without changing geometry or feature IDs. The registry remains empty until a genuinely approved real package exists; this gate does not manufacture or approve missing evidence.

#### CV Wave 2 — Shanghai spatial base and identity (3–6 weeks plus approval dependency)

- Resolve/approve Shanghai building, road, water, terrain and public-map requirements; build the real Huangpu–Bund–Lujiazui base.
- Author and integrate Oriental Pearl, Shanghai Tower, SWFC, Jin Mao and the Bund ensemble with LODs, materials, light rigs and hero cameras.
- **Exit:** all Shanghai geometry, silhouette, day/night, attribution, performance and release gates pass. If approval is unresolved, the package remains local/non-public rather than shipping fabricated fallback.

#### CV Wave 3 — Hong Kong then Melbourne (2–5 weeks each plus approval dependency)

- Hong Kong: ingest approved official 3D/DTM data through the adapter, prove HKPD transformation, preserve Victoria Harbour/Peak and overlay authored identity assets where the approved base lacks sufficient silhouette detail.
- Melbourne: use the already validated engineering package/runtime path, then expand the AOI to include Hoddle Grid, Yarra, Southbank and the required skyline landmarks; add authored heritage/supertall assets and city-specific day/night art direction.
- **Exit:** each city independently passes the same P0 contract; success in one city cannot waive another city’s data or rights gaps.

#### CV Wave 4 — Urban fabric and polish (after all P0 gates)

- Add façade/roof typologies, bridges/rail/vegetation, classic-tour choreography, bounded traffic and P2 weather/effects in measured increments.
- **Exit:** improvements do not regress skyline identity, spatial truth, night containment, accessibility or the active-working-set budgets.

### 0A.11 Explicit Cityview non-goals

- Do not attempt a whole-municipality photogrammetric download before the three core precincts are recognizable and performant.
- Do not trace/cache Google photorealistic tiles into Afflatus assets.
- Do not use random procedural forms for named landmarks or random seeds for real roads, shoreline, terrain or building massing.
- Do not publish unreviewed GIS/imagery because it is technically downloadable.
- Do not spend P0 time on rain, crowds, traffic simulation, SSAO/SSR/TAA or cinematic tours before the real skeleton, landmarks and day/night system pass.
- Do not claim survey/digital-twin accuracy beyond the frozen source metadata and measured QA.

## 1. Prioritization model

- **P0 — Critical:** broken cross-page consistency, material accessibility/performance/reliability risk, or platform work that unblocks multiple routes.
- **P1 — High:** major task success, discoverability, maintainability, or rendering improvement after P0 foundations.
- **P2 — Polish:** refinement with bounded value; ship only after P0/P1 acceptance gates remain green.
- **Effort:** S = ≤2 engineer-days, M = 3–7 days, L = 1–3 weeks, XL = multi-wave.

### Impact × effort matrix

| ID | Priority | Impact | Effort | Scope | Proposal and implementation pattern |
| --- | --- | --- | --- | --- | --- |
| P0-01 | P0 | Very high | M | All routes | [x] ~~Create `src/config/siteManifest.js` as the SSOT for path, status, locale titles/descriptions, nav group, theme, schema type, OG image, build inclusion, and redirect. Generate Vite inputs, nav data, sitemap, and a metadata audit from it. CI fails on drift.~~ |
| P0-02 | P0 | Very high | S | All bilingual routes | [x] ~~Migrate `afflatus-lang` and `afflatus:lang` to one versioned key (`afflatus:locale:v1`). Read old keys once, resolve conflicts deterministically, write the new key, and delete old keys after successful migration. Replace scene-specific locale reads with `getLocale()`.~~ |
| P0-03 | P0 | Very high | L | Home, Sectors, Boot, all canvas pages | [x] ~~Add a `RenderBudgetCoordinator`: one visibility/page-lifecycle registry, refresh-rate sampling, pixel-budget DPR, quality tier, pause/resume/dispose hooks, and telemetry. Each renderer registers; it does not own global policy.~~ |
| P0-04 | P0 | Very high | M | All routes | [x] ~~Add browser-level quality gates: Playwright smoke tests at desktop + two flagship mobile profiles, axe checks, keyboard route tests, console/page-error assertions, and two deterministic screenshots per active route.~~ |
| P0-05 | P0 | High | M | All routes | [x] ~~Add CWV budgets and field telemetry: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.10 at p75; route/locale/device-tier dimensions only, no personal input. Lighthouse CI enforces lab regression budgets rather than absolute perfection.~~ |
| P0-06 | P0 | High | M | Home/3D branches | [x] ~~Complete WebGL lifecycle ownership: rebuild after `webglcontextrestored`, dispose geometries/materials/textures/listeners, abort pending loads, cap simultaneous contexts, and fall back to a static poster after repeated loss.~~ |
| P0-07 | P0 | High | M | Stats, Sectors graph, Arena charts, Horoscope charts | [x] ~~Every visual gets a named region, keyboard interaction, textual summary, and table/list fallback. Canvas hit targets receive a parallel DOM control list; SVG points/series expose labels.~~ |
| P0-08 | P0 | High | S | Games, League, Boot | [x] ~~Remove retired `games.html` and `league.html` from Vite inputs; use permanent redirects to `stats.html`. Preserve the settled source/data in Git history and the unified Stats archive. Ensure `boot.html` stays noindex and is excluded from sitemap/nav.~~ |
| P0-09 | P0 | High | M | JSON consumers + APIs | [x] ~~Introduce `fetchJson(key, {signal, freshness})`: request dedupe, AbortController, timeout, schema validation, stale-while-revalidate cache, and typed failure states. Stop applying `no-store` to immutable/versioned assets.~~ |
| P0-10 | P0 | High | M | All routes | [x] ~~Establish responsive primitives: `viewport-fit=cover`, safe-area tokens, `100svh/100dvh` policy, `VisualViewport` keyboard handling, 44×44 CSS px minimum targets, zoom-safe layouts, and no horizontal page overflow at 320–440 CSS px.~~ |
| P1-01 | P1 | Very high | L | EN/ZH content | [x] ~~Generate crawlable locale documents (`/en/...`, `/zh/...`) from one bilingual content source. Emit fixed `lang`, self-canonical, reciprocal `hreflang`, localized metadata, and locale-aware JSON-LD. Language switching changes URL while preserving route/branch state.~~ |
| P1-02 | P1 | High | L | Home | [x] ~~Split `src/main.js` by experience: base shell, markets, terminal, combat, scene loaders. Load DOM/LCP content first; schedule Three.js and combat after visibility/intent/idle. Retain a zero-JS content path and static scene poster.~~ |
| P1-03 | P1 | High | M | Home/Sectors/Boot 3D | [x] ~~Add a three-tier LOD contract and renderer budgets for current procedural models; add authored GLB pipeline only when a model exceeds procedural maintainability. See §5.~~ |
| P1-04 | P1 | High | L | Horoscope | [x] ~~Split birth form, Bazi/ZWDS, synastry, quizzes, share card, and professional ephemeris into dynamic feature chunks. Move expensive synthesis to a worker and cancel superseded calculations.~~ |
| P1-05 | P1 | High | M | Stats | [x] ~~Move inline statistics/rendering into `src/lib/stats/*` and `src/pages/stats.js`; run bootstrap batches in a worker; keep seeded output; share one chart component contract across MSI/WC datasets.~~ |
| P1-06 | P1 | High | M | Sectors | [x] ~~Split data/card/story/graph controllers; choose one active graph renderer at a time; workerize force iterations; virtualize or progressively reveal long card collections.~~ |
| P1-07 | P1 | High | M | Arena | [x] ~~Create an explicit page state machine (`loading`, `ready`, `stale`, `gated`, `partial`, `error`) and an abortable ticker selection pipeline. Cache history by symbol + last market session, not local calendar day.~~ |
| P1-08 | P1 | High | M | Serial | [x] ~~Create stable book/chapter URLs and pre-render chapter content for SEO/sharing. Introduce `createReaderStore(adapter)` with a versioned schema for theme, font, progress, bookmarks, and audio state.~~ |
| P1-09 | P1 | High | M | All routes | [x] ~~Create a bilingual content schema and lint: `{en, zh}` parity, placeholder/token equality, punctuation rules, glossary term choice, link equality, no orphan language, and maximum UI-label lengths.~~ |
| P1-10 | P1 | High | M | All active routes | [x] ~~Generate route-specific Schema.org graphs and OG assets from the site manifest; add breadcrumb semantics and stable page dates/data provenance where truthful.~~ |
| P1-11 | P1 | Medium-high | M | CSS system | [x] ~~Migrate one component family per PR from legacy CSS into `tokens/components/overrides`; eliminate the corresponding `!important`s; standardize container queries and 3 breakpoint bands.~~ |
| P1-12 | P1 | Medium-high | S | Data pipelines | [x] ~~Extend schema validation to every public JSON and add atomic publish: validate → write temp → rename → build smoke → commit. Derived aggregates are computed, never hand-authored.~~ |
| P2-01 | P2 | Medium | M | All routes | Per-route OG artwork and bilingual social copy; preserve visual identity rather than reusing one global image. |
| P2-02 | P2 | Medium | M | Motion-heavy routes | Add motion choreography tokens (`--motion-fast/base/slow`, easing, distance) and route-level motion budgets; use GSAP/Framer only if a measured requirement cannot be met with the existing vanilla scheduler. |
| P2-03 | P2 | Medium | S | Data visualizations | Add export/share affordances (PNG/SVG/CSV where meaningful), remembered metric selection, and touch crosshair/long-press details. |
| P2-04 | P2 | Medium | S | All routes | Refine empty, stale, locked, offline, retry, success, and destructive microcopy in EN/ZH; announce async changes through restrained live regions. |
| P2-05 | P2 | Low-medium | M | Boot prototype | Decide within a dated RFC whether to merge `bootengine` capabilities into production combat or freeze the prototype. Avoid maintaining two diverging simulation stacks indefinitely. |

### P0 delivery status

| ID | Status | Completed evidence / next gate |
| --- | --- | --- |
| P0-01 | [x] ~~**Completed 2026-07-25**~~ | `src/config/siteManifest.js` now owns route status, build inclusion, nav order/group, sitemap membership, EN/ZH metadata, schema intent, theme, capabilities, and redirects. Vite derives all 11 entries from `BUILD_ROUTES`; browser navigation consumes the generated lightweight projection `navRoutes.generated.js`; `site-manifest.mjs` generates sitemap and audits source HTML + Vercel redirects; CI runs `site:check`; 8 manifest invariant tests pass. Full gate: 73 files / 1,090 tests, typecheck, 12 data schemas, `!important` baseline, production build, and bundle budgets all pass. |
| P0-02 | [x] ~~**Completed 2026-07-25**~~ | `localeStore.js` now owns `afflatus:locale:v1`; resolution order is new key → old sub-page key → old home key; legacy keys are deleted only after a verified current-key write. Home, shared i18n, Arena, Games, League, and scene copy no longer read/write legacy keys directly. Ten language-capable HTML entries run one byte-identical synchronous pre-paint/migration script, enforced by `site:check`. Eight migration/failure-mode tests pass. Full gate: 74 files / 1,098 tests, typecheck, data validation, style baseline, production build, and bundle budgets all pass. |
| P0-03 | [x] ~~**Completed 2026-07-25**~~ | `renderBudget.js` owns tier selection, mobile/desktop pixel budgets, budget-derived DPR, refresh-rate estimation, p95 evaluation, and hysteresis. `renderBudgetCoordinator.js` owns one visibility/page-lifecycle registry, coalesced resize, refresh sampling, adaptive quality, anonymous surface telemetry, and pause/resume/dispose hooks. Registered owners now include Home master/background Worker/black-hole + HUD canvas family/Alphard/combat/radar/market chart/terminal map/hologram/lazy 3D assets; both Sectors renderers; all three Boot WebGL branches + telemetry; and Arena, Signal, and Serial ambient canvases. The Worker is resumable with a generation guard; Home fully stops while hidden/frozen and resumes with a 32 ms `dt` clamp. Twelve policy/coordinator tests pass. Explicit non-loop exceptions are on-demand share/export/transition canvases and the pointer-driven scratch cards on already-redirected Games/League routes. Full gate: 76 files / 1,110 tests, typecheck, 12 data schemas, style baseline, production build, and bundle budgets all pass. |
| P0-04 | [x] ~~**Completed 2026-07-25**~~ | `playwright.config.js` defines desktop Chromium (1440×1000), iPhone 16 Pro Max-like WebKit (440×956 @3x), and Galaxy S26 Ultra-like Chromium (412×892 @3.5x). The active-route manifest drives 96 collected browser checks: all 8 routes × 3 devices for render/metadata/overflow, keyboard/menu/route navigation, and two deterministic viewport captures; axe runs once per DOM contract against an exact-target debt baseline that permits only audited contrast nodes and fails on every new serious/critical target. The deterministic fixture fixes time/random/locale, isolates external analytics/fonts, disables animation variance, and asserts zero console/page errors. CI installs Chromium/WebKit, runs the matrix after the unit/build job, and retains reports/captures for 7 days. Browser work exposed and fixed Home nested interactive cards, Arena listbox naming, Sectors hidden-clone focusability, Stats range/SVG naming plus negative SVG animation geometry, page-transition negative radii after time-origin hand-off, Signal scroll-animation overflow, and Horoscope mobile grid overflow. Final gate: 80 passed + 16 intentional non-desktop axe skips; 48 PNG captures emitted; 76 Vitest files / 1,110 tests, typecheck, 12 schemas, style baseline, production build, and bundle budgets pass. Physical iPhone/Samsung runs remain the release sign-off, not emulation claims. |
| P0-05 | [x] ~~**Completed 2026-07-25**~~ | Every active route loads one shared `web-vitals` entry for CLS/INP/LCP. `webVitals.js` sends only an exact GA4 allowlist (`schema_version`, metric name/value/delta/rating/id, manifest route, `en/zh`, coarse device tier); it never spreads PerformanceEntry/attribution, URL query, viewport, UA, user input, or raw hardware values. Events use the existing delayed `gtag` transport, queue in memory for at most 10 s, then drop. Field targets are LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.10 at p75, segmented only by route/locale/device tier. `site-manifest.mjs` generates the performance/Lighthouse route projections and fails if an active HTML entry is missing or duplicated. Lighthouse 12.6.1 runs all 8 routes 3× under mobile simulation: route LCP/TBT/Speed Index/CLS/script bytes are hard 5%-regression gates, total bytes and category score are warning trends, and reports persist in CI. Sectors additionally reduced its decorative ticker from 1,012 to ≤120 buttons, delays ticker motion until the first LCP candidate/fallback, removed nonessential bar-growth motion, fixed ticker contrast, and avoids no-op bilingual DOM rewrites. Lighthouse intermittently returns `NO_LCP` for this dynamic route, so Sectors hard-gates FCP/Speed Index/CLS/script bytes while production field p75 remains the LCP decision source. Final gate: 78 Vitest files / 1,119 tests; Playwright 81 passed + 18 intentional skips; typecheck, 12 schemas, style baseline, production build, bundle budgets, and Lighthouse assertions pass. Post-deploy: register GA4 custom dimensions/metrics for the allowlisted fields and do not judge p75 until the sample is sufficient. |
| P0-06 | [x] ~~**Completed 2026-07-25**~~ | `webglLifecycle.js` now owns a hard eight-context lease cap, session-scoped loss counts, listener/AbortSignal lifetime, first-loss restoration, second-loss static-poster fallback, and an accessible bilingual re-enable control. Home raw Saturn GL rebuilds shaders/program/buffer/uniform locations after restoration; Three.js surfaces reset renderer state; Boot armor/fleet additionally rebuild their PMREM environment maps. Home Saturn, Alphard, hologram, fighter, capital ship and top-down combat; opt-in Sectors starfield; and all three Boot branches use the contract. `disposeThreeScene()` identity-deduplicates and releases geometries, materials, nested texture/uniform resources, render lists, renderer, and context; composer/render-surface disposal and Sectors data-buffer replacement are explicit. Current scenes have no asynchronous GLTF/texture fetch, while the lifecycle AbortSignal is the required cancellation token for future loaders. Four unit tests cover restore/fallback, cap, abort/listener cleanup and de-duplicated disposal; Chromium additionally invokes the real `WEBGL_lose_context` extension and verifies restore → repeated-loss poster → accessible recovery control. Final gate: 79 Vitest files / 1,123 tests; Playwright 82 passed + 20 intentional skips; typecheck, 12 schemas, route manifest, style baseline, production build, and bundle budgets pass. |
| P0-07 | [x] ~~**Completed 2026-07-25**~~ | Stats confidence bars are SVG buttons with names, focus treatment and Enter/Space activation; the MSI/World Cup log tables expose the same records as keyboard-operable rows, bootstrap/threshold changes use polite status regions, and every generated histogram/curve/calibration SVG has a meaningful text name. Sectors’ 2D force graph now exposes a live node-count/current-selection summary, a visible parallel DOM button list, Canvas arrow-key/Enter/Home control and focus state; the opt-in 3D starfield has the same summary/button fallback in addition to its filter/D-pad controls, while the existing full matrix remains the complete non-visual dataset. Arena marks its ambient Canvas decorative and gives the equity SVG a text equivalent containing every model/benchmark’s final value; TA levels remain duplicated in semantic cards and positions in tables. Horoscope radar/wheel/aspect SVG names now contain their actual scores/planet positions/relationships; Ziwei and Bazi-matrix connector overlays are hidden as decorative while the real buttons expose complete names and pressed state. Shared page-turn handlers now ignore focused interactive/`tabindex` targets, preventing chart arrow keys from navigating routes. Three new browser contracts verify Stats keyboard marks/rows, Sectors Canvas + node-list equivalence, and Arena chart summaries; three pure SVG tests verify Horoscope data names. Final gate: 79 Vitest files / 1,126 tests; Playwright 85 passed + 26 intentional skips; typecheck, 12 schemas, route manifest, style baseline, production build, and bundle budgets pass. |
| P0-08 | [x] ~~**Completed 2026-08-06**~~ | Games and League now remain as settled source/data and Git history only; their Vite build entries are disabled and permanent base/EN/ZH redirects converge on Stats, eliminating duplicate deployed UI and bundles. Stats retains both complete prediction records. Boot remains `noindex,nofollow`, absent from nav and sitemap, and included only as an explicit prototype build. |
| P0-09 | [x] ~~**Completed 2026-07-25**~~ | `fetchJson(key, {signal, freshness, timeoutMs, headers, forceRefresh})` now resolves a closed resource registry, validates every payload before delivery, de-duplicates concurrent requests, gives each consumer independent AbortSignal cancellation, applies an 8 s bounded network timeout, and returns typed `JsonDataError` states with status/retry/schema detail. Fresh data is served from memory/Cache Storage; stale data is returned immediately while one background revalidation refreshes it. Static fixed-URL JSON uses normal HTTP caching instead of blanket `no-store`; Arena quote/history retain endpoint-appropriate freshness. Arena, Boot, Games, League, Horoscope, Sectors, Signal, Stats, and Serial index/book consumers are migrated; the paused Serial playlist is deliberately untouched. Validators are split per resource and loaded concurrently with their JSON request, retaining route-level lazy delivery without a serial validation RTT. A 0.2 kB bridge exposes the module contract to legacy inline IIFEs and is inlined only in production HTML to avoid a render-blocking request. Quote/history proxies now bound allowlist/upstream calls, validate upstream shapes, emit normalized non-cacheable errors plus `X-Request-Id`, preserve 403 gating, and retain 12 s/1 h edge caching on success. Eight unit contracts cover de-duplication, schema failure, independent abort, SWR, HTTP status, correlation/error shape and timeout; Chromium proves Signal’s two renderers make one request. Final gate: 81 Vitest files / 1,134 tests; Playwright 114 collected = 86 passed + 28 intentional skips; typecheck, 12 schemas, route manifest, style baseline, production build, bundle budgets and diff hygiene pass. |
| P0-10 | [x] ~~**Completed 2026-07-25**~~ | All 12 route documents now declare `viewport-fit=cover` and load one shared responsive primitive sheet; all 11 Vite-built routes also mount `viewportRuntime.js`, with `site:check` enforcing both contracts. Global tokens expose four safe-area insets, `100svh`/`100dvh` fallbacks, measured visual-viewport height/offset/center, keyboard occlusion, and a 44 px touch target. VisualViewport resize/scroll plus layout resize/orientation events are coalesced to one rAF; the runtime sets `data-keyboard-open`, updates scroll padding, and tears down every listener. Home/Boot full-screen surfaces, Arena briefing/toast, Sectors starfield/node list/fallback, Course toast, and Serial FAB/toast consume the dynamic viewport or keyboard/safe-area offsets. Coarse-pointer/≤440 px HTML controls and navigation targets receive the 44×44 floor; the legacy Home Command button and Serial toolbar controls were brought into compliance without increasing the `!important` baseline. Production builds inline only the small responsive primitives, avoiding an extra stylesheet request while retaining a maintainable source file; shared page-turn CSS remains external because inlining it delayed route-specific CSS discovery on Horoscope. Sectors reserves the measured final header height at each mobile wrapping breakpoint, reducing its repeatable Lighthouse CLS from 0.221 to 0.019. A browser gate loads every active, redirect, prototype and 404 route at 320×720, verifies viewport/safe-area/runtime variables, asserts ≤1 px page overflow, and audits every visible non-SVG HTML control. Two unit tests cover keyboard-inset math and listener/rAF disposal. Deterministic final gates pass: 82 Vitest files / 1,138 tests, typecheck, 12 schemas, route manifest, style baseline, production build, bundle budgets and diff hygiene. The latest complete Playwright matrix remains 150 collected = 98 passed + 52 intentional project-scope skips; post-change single-worker verification passed 35 functional assertions and hit two macOS/Chromium context-teardown stalls. Completed Lighthouse 24-report and affected-route samples established the new budgets, but the final independent rerun is pending because the current host subsequently returned persistent cross-route `NO_FCP` runtime errors before assertions. Physical iPhone/Samsung safe-area, keyboard and 120 Hz behavior remains release sign-off. |

### P1 delivery status

| ID | Status | Completed evidence / next gate |
| --- | --- | --- |
| P1-01 | [x] **Completed 2026-08-07** | The build emits 15 fixed-locale route documents plus 96 localized novel documents with fixed `lang`, self-canonical, reciprocal `hreflang`, localized metadata and locale-aware structured data. Native language links preserve route, query and hash; desktop, iPhone and Galaxy navigation contracts pass. |
| P1-02 | [x] **Completed 2026-08-07** | Home's critical entry is 4.91 kB raw / 2.18 kB gzip. `homeExperience` (165.76 kB), market deck, voyage terminal and Alphard Forge are separate deferred chunks; `vendor-three` is not preloaded by the document. The black-hole iframe is intent/viewport deferred, reduced-motion/save-data users keep the static scene, and `<noscript>` retains the Top 10 holdings. |
| P1-03 | [x] **Completed 2026-08-07** | `proceduralLod.js` owns high/medium/silhouette selection from projected CSS-pixel diameter with 15% hysteresis and coordinator quality ceilings. Home command/fighter surface buckets, Sectors decorative point/connector draw ranges, and Boot fleet hulls consume the contract. Boot builds full/wire prototypes once, clones shared geometry/materials across the formation, and reduces silhouette tier to one continuous hull draw; resource-identity diagnostics plus five pure LOD tests and two fleet gates enforce reuse. |
| P1-04—P1-10 | [x] **Completed** | Horoscope feature chunks + latest-only worker, modular Stats + seeded bootstrap worker, exclusive/workerized/progressive Sectors, six-state abortable Arena, stable pre-rendered Serial chapters + versioned reader store, bilingual lint, and manifest-generated route Schema.org/OG output are implemented and covered by current build/test gates. |
| P1-11 | [x] **Completed 2026-08-07** | Home brand lockup and primary-navigation links are canonical component families. The second migration removed 17 legacy rules / 56 declarations / 13 priority flags, lowered the stylesheet ratchet to 2,837, added nav tokens and compact/medium/wide container bands, and expanded `css:check` to reject either family's return to legacy or `!important`. Desktop/iPhone/Galaxy Home browser gates and deterministic captures pass. |
| P1-12 | [x] **Completed 2026-08-07** | All 25 public JSON documents—including static calendars/audio, immutable Season 1 archives, and index-discovered novels—have schema validators; `data:check` fails on any unregistered future JSON. Mutable publishers now share a journaled transaction: validate/derive → same-directory durable stage + rename → full build smoke → target-only Git commit with an identifying trailer. Dirty targets fail closed; build/commit failures restore original bytes; a dead owned lock/journal is recovered; a post-commit crash is finalized from the Git trailer. Eight fault/integration tests include a real temporary Git repository proving unrelated staged work is preserved. |

## 2. Route and branch map

### `/` — Home / deep-space captain log

**Branches:** default 3D combat; `?combatview=2d`; legacy/SC panel modes; tactical/director cameras; optional `?combat=topdown`, `?ship=odin|wedge`, nebula/tactical-line feature flags; terminal, market, holdings, and stardrive subsections.

**P0**

- Register background worker, black-hole GL, Alphard Forge, combat, radar, and hologram renderers with the shared lifecycle coordinator. A renderer must implement `mount()`, `setQuality(tier)`, `pause(reason)`, `resume()`, `resize(viewport)`, and `destroy()`.
- Replace scattered DPR caps with a pixel budget: `dpr = clamp(sqrt(pixelBudget / (cssW*cssH)), minDpr, deviceDpr)`. Suggested starting budgets, to be tuned by trace: 2.2 M pixels mobile and 3.6 M desktop per active full-screen renderer, with only one high-cost renderer at a time.
- Stop the master frame loop on `document.hidden`; clamp resumed `dt` to 32 ms so physics/camera state cannot jump after tab restoration.
- Recreate raw WebGL resources on context restoration. After two losses in a session, set `data-renderer="poster"` and show an accessible “Enable interactive scene” control.
- Fix locale persistence through P0-02. The initial `<html lang>`, home copy, nav, and 3D captions must read the same locale source.

**P1**

- Split the 3,552-line controller into feature entry points. Static hero/holdings is the critical path; `vendor-three` is fetched only when a 3D stage approaches the viewport or the user enters combat.
- Add procedural LODs for capital ships/fighters and reuse geometry/material instances. Convert transient lasers, missiles, explosions, and trail segments to bounded pools; no `new Material()` inside sustained fire.
- Replace the 78 ms barrage interval with the existing clock/main-frame scheduler.
- Keep real DOM headings, holdings, disclaimers, and links above every canvas for crawlability and no-WebGL use.

**P2**

- Use shader quality defines (`LOW/MED/HIGH`) for particle count, bloom taps, shadow resolution, volumetric steps, and chromatic aberration. Do not compile new variants during combat.
- Preserve 120 Hz camera/input responsiveness while allowing expensive visual simulation to update at 60 Hz with interpolation.

### `/arena.html` — TA, recommendations, Autopilot, digest

**Branches:** briefing acknowledged/unacknowledged; `?embed`; recommendation available/stale/error; TA pre/post tabs; ticker search; unlocked/locked/rejected admin session; quote available with daily-history fallback; three model ledgers; digest toast/drawer.

**P0**

- Model branches as a reducer/state chart rather than mutually mutating IIFEs. Render from state; effects own abort tokens. Selecting a new symbol cancels old history/quote calls and ignores late responses.
- Use `aria-activedescendant` for ticker suggestions, arrow-key navigation, Enter selection, Escape dismissal, and a visible result count. Restore focus after closing briefing/digest dialogs and trap focus while modal.
- Keep secrets in `sessionStorage`, never copy them into URLs/logging/analytics, and clear them after a 403 rejection.
- Make equity charts keyboard-readable: series toggle buttons, left/right point navigation, textual latest value and delta, and a table fallback.

**P1**

- Cache EOD candles by `{symbol,lastCompletedNYSESession,dataVersion}` and live quotes with a short TTL. Reuse in-flight requests across recommendation cards and TA selection.
- Virtualize only the 506-symbol suggestion result, not the recommendation cards. Search against normalized symbol/name tokens using a prebuilt index.
- Separate “model simulation”, “market data”, and “editorial digest” provenance. Every timestamp states timezone and freshness; stale data remains visible with an explicit badge.
- For SEO, render a static explanation of methodology and risk discipline; do not expose personalized “buy/sell” claims or make dynamic ticker states canonical.

### `/sectors.html` — AI sectors, vendor matrix, star graph

**Branches:** card/story view; interactive Canvas 2D graph; optional `?fx=starfield3d`; model/vendor detail; data available/empty/error; post-memory track.

**P0**

- Do not run Canvas 2D graph and Three.js starfield simultaneously. A route-level renderer lease grants the GPU budget to one view and pauses/disposes the other after a short back-navigation cache.
- Replace full-window mouse listeners with pointer events scoped to the active stage; pointer capture handles pan; `touch-action` is declared per surface.
- Provide a DOM node list synchronized with graph selection so keyboard/screen-reader users can inspect vendors, relationships, confidence, and source notes.
- Remove hotlinked presentation-critical imagery from the runtime dependency chain. Store optimized licensed/official assets locally with source/license metadata; show dimensioned placeholders to prevent CLS.

**P1**

- Move force simulation steps to a worker using compact typed arrays. The main thread sends graph revisions and receives positions at ≤30 Hz; rendering interpolates at display rate.
- Preserve Canvas for the dense graph and DOM for detail/cards. Use SVG only for exported/static relationship diagrams; do not rebuild the full animated graph in DOM.
- Normalize entity IDs in datasets. Relations reference IDs rather than vendor/ticker strings; validation rejects dangling IDs.
- Generate `CollectionPage` + `ItemList` structured data from the static vendor/article summary, not from decorative graph coordinates.

**Delivered 2026-07-25 — scoped slice; P1-06 stays open until workerization and controller splitting are complete**

- [x] ~~Replace the crooked horizontal story-card rail with a stable two-column editorial grid, one column on mobile, consistent media ratios, local product/launch imagery, and explicit local brand marks.~~
- [x] ~~Move the current ecosystem storyboard into `public/sectors-ecosystem.json` v3 with stable entity IDs, 19 nodes, 19 typed edges, source URLs, products, country codes, reveal thresholds, and five scroll chapters.~~
- [x] ~~Start from an empty dark field and progressively reveal frontier labs → capital/open weights → cloud/compute → memory/foundry as scroll advances; hold the complete map for inspection after the story.~~
- [x] ~~Replace abstract dots with logo plates and flag badges; provide text/brand-mark fallbacks, bilingual product detail, directional relationship lines, a parallel DOM node list, and Canvas keyboard selection.~~
- [x] ~~Remove graph zoom buttons plus wheel/pinch zoom listeners. Preserve page pinch zoom, touch vertical scrolling, tap selection, and desktop-only pan/node repositioning.~~
- [x] ~~Run physics at a fixed 60 Hz and render through the shared 120 fps target budget with adaptive DPR, hidden/offscreen pause, reduced-motion final-state rendering, deterministic mobile topology, and complete teardown.~~
- [x] ~~Correct unverified launch claims instead of publishing them: the dataset records Claude Opus 4.8 as the latest verified Opus release and explicitly states that no official Opus 5 launch was verified on the audit date.~~

### `/signal.html` — Fed signal dossier

**Branches:** four chapter anchors; hawk/dove compass; pillar filters; expandable incidents; asset watch; data/offline state; ambient audio on/off.

**P0**

- Fetch `signal-events.json` once through the shared data client and fan out validated state. The current page has multiple consumers that independently fetch the same document.
- Convert incident headers to real buttons inside articles; maintain `aria-expanded`, keyboard operation, focus visibility, and deep links such as `#incident-<id>`.
- Pause canvas/audio timers when offscreen, hidden, or reduced-motion/data preferences apply. Audio always requires user activation and exposes a persistent mute state.

**P1**

- Split the 52.61 kB generated HTML into a static editorial shell plus data-driven chapters at build time. Keep the key conclusion and source methodology in rendered HTML.
- Add `CollectionPage`/`ItemList` schema and `dateModified` from validated data. Use neutral “scenario/desk view” language consistently in EN/ZH.
- Animate only state transitions: needle moves to a changed signal, new incident highlight, expanded body. Remove ambient motion that does not convey state on constrained tiers.

### `/stats.html` — prediction archive and dashboards

**Branches:** MSI and World Cup datasets; bars, Wilson curve, reliability plot, bootstrap histogram; reasoning drawers; recompute/error states.

**P0**

- Extract duplicated MSI/WC chart code into `renderCompetitionDashboard({data,labels,ids})`. Keep statistical functions pure and add golden fixtures for both competitions.
- Add `<figure><figcaption>` structure, visible chart conclusions, an underlying sortable table, and keyboard-selectable series/points. Never encode vendor/result solely by color.
- Move the 2,000-sample bootstrap into a worker. Stream progress every 5–10%, accept a seed, and terminate/cancel on rerun or page hide.

**P1**

- Use SVG for low-mark charts and axes; switch to Canvas only above a documented point threshold (starting rule: >2,000 visible marks or continuous pan/zoom). Export uses the same scale functions.
- Centralize scales, tick formatting, tooltip positioning, and chart palette tokens. Tooltip placement clamps to `visualViewport`, not `window.innerWidth`.
- Add `Dataset` structured data describing competitions, metric definitions, temporal coverage, license/provenance, and download URL if a stable data export exists.

### `/horoscope.html` — Bazi, astrology, synastry, quizzes

**Branches:** birth input/manual location; personal chart/day reading; L1/L2/L3 astrology; ZWDS deep detail; synastry and saved relationship book; Davison/detail accordions; share `?p=`; persona/logic/EQ quizzes; reset.

**P0**

- Define a versioned `HoroscopeState` and feature selectors. Persist only explicitly approved profile/result fields; keep professional ephemeris and intermediate matrices in memory.
- Treat the share query as untrusted input: length cap, schema/version check, invalid-link recovery, and no automatic persistence until the user confirms.
- Every generated result section receives a heading, status announcement, focus target, and “Back to inputs” control. Accordions use buttons and stable IDs.
- Split/cancel compute so a second submit cannot race the first; use a worker for deep synthesis when measured main-thread work exceeds 50 ms.

**P1**

- Dynamic-import synastry, quizzes, share-card, and `astronomy-engine` only when each branch opens. Base birth form and first result remain the initial bundle.
- Replace broad template-string DOM replacement with small render functions and event delegation. Sanitize any field originating in URL or JSON before HTML insertion.
- Make chart matrices usable at 200% zoom and 320 CSS px: permit internal scrolling, sticky row/column labels, and a linear accessible reading order.
- Use `WebApplication` structured data; avoid presenting entertainment output as medical, financial, or factual personalized advice.

### `/serial.html` — bookshelf and reader

**Branches:** three books; chapter selection; normal/waterfall layouts; green/night themes; font size; bookmark/progress; auto page; optional playlist; mobile keyboard/toolbar states.

**P0**

- Introduce `readerStore` with `{version,bookId,chapterId,offset,theme,fontSize,layout,bookmarks,audioTrack}` and a storage adapter. Migrate current scattered keys once and preserve existing readers' progress.
- Use `history.pushState` or real chapter URLs on chapter changes; back/forward restores chapter and reading offset without losing toolbar state.
- Replace continuous scroll writes with an rAF-throttled sampler and idle/debounced persistence. Flush on `pagehide`, not only before unload.
- Respect safe-area bottom insets and the on-screen keyboard; the toolbar must never cover the active paragraph or audio controls.

**P1**

- Pre-render `/zh/novels/<book>/<chapter>/` pages with `Book`, `CreativeWorkSeries`, and chapter-level `Article/Chapter` metadata, next/previous links, and canonical URLs. Hydrate reader enhancements on top.
- Fetch the index first, then the selected book; prefetch only adjacent chapters on idle and low-cost network conditions. Do not preload the 438.99 kB book.
- Virtualize waterfall mode by chapter block/window, preserving find-in-page and screen-reader continuity with sentinel-based mounting.
- Retain Chinese-only creative content if intentional, but bilingualize reader chrome, errors, metadata, and navigation so the global locale promise is honest.

### `/course.html` — AI collaboration playbook

**Branches:** chapter anchors 00–06, weekly section, appendix, glossary popover, reading progress.

**P0**

- Keep all meaningful content in HTML, but generate it from structured chapter data so the 181.89 kB source is maintainable and locale parity is testable.
- Add a skip link, landmark/heading audit, keyboard-operable chapter nav, focus-visible glossary terms, and `aria-current` for the active chapter.

**P1**

- Split chapter source into `content/course/<chapter>.json|md`; a build plugin emits one complete document for SEO and optional per-chapter pages. Client JS only handles progress and glossary.
- Use `content-visibility:auto` plus accurate `contain-intrinsic-size` for offscreen chapters after verifying find-in-page and accessibility behavior.
- Generate `Course`, `CourseInstance` only if a real instance exists, `ItemList`, and breadcrumb schema. Do not claim certification, provider affiliation, or outcomes not supported by the content.

### Retired and experimental routes

#### `/games.html` and `/league.html`

- Treat as archived products, not live hidden branches. Make redirects permanent, remove build/nav/sitemap/metadata duplication, and preserve final data in Stats.
- If seasonal reuse is likely, extract a `prediction-experience` package with sport/esport adapters; do not keep two entire public pages deployed as templates.

#### `/boot.html`

- Maintain `noindex,nofollow`, no analytics requirement, and explicit “prototype” labeling.
- Put `?combatcam=tactical|director` and `?p2demo=armor|fleet` behind an on-page developer switcher so test branches are discoverable without memorized URLs.
- Give every renderer the same lifecycle/quality contract before any merge into Home. Freeze the prototype if no production decision is made by the RFC date.

#### `/api/quote` and `/api/history`

- Preserve symbol allowlists and server-side keys. Add bounded upstream timeouts, normalized error codes, `Cache-Control` appropriate to quote/history freshness, and request correlation IDs without user/session secrets.
- Rate limiting must be enforceable across instances; an in-memory limiter is only a best-effort burst guard. If abuse becomes material, adopt a managed edge/KV limiter through a separate security RFC.

#### `/404.html` and the shared navigation shell

- Generate the 404 page from the same route/locale manifest, return the actual HTTP 404 status, exclude it from sitemap/canonical indexing, and offer Home plus the three primary task routes rather than a dead-end visual.
- Keep native anchor `href`s in primary navigation so browsing works before JS. JS may enhance transitions but must not own reachability.
- Linear page-turn controls were removed site-wide: they duplicated primary navigation, consumed reading margins, and made unmodified arrow keys navigate unexpectedly.
- The portaled Labs menu needs a real button trigger, roving/familiar arrow-key behavior, `aria-controls`, focus return, viewport collision handling, and teardown-safe global listeners.

## 3. Algorithm, logic, and state architecture

### 3.1 Site manifest

```js
{
  id: 'arena',
  path: '/arena.html',
  status: 'active',                 // active | redirect | prototype
  build: true,
  nav: { group: null, order: 20 },
  locales: {
    en: { title, description, ogTitle, ogDescription },
    zh: { title, description, ogTitle, ogDescription }
  },
  schema: ['WebPage', 'Dataset'],
  themeColor: '#05070e',
  capabilities: ['live-data', 'svg-viz'],
  redirectTo: null
}
```

Build checks:

1. Every active route has both locale metadata records and one H1.
2. Every nav route is built and in the sitemap.
3. Redirect/prototype routes are absent from sitemap and locale generation.
4. Canonical, OG URL, JSON-LD URL, and emitted path agree.
5. Route branch query parameters are documented and excluded from canonical indexing unless explicitly promoted.

### 3.2 Page state pattern

Use a small reducer per complex page, not a global SPA store:

```js
const state = {
  status: 'idle',
  locale: 'en',
  data: null,
  selection: null,
  requestId: 0,
  error: null
};
```

- Pure reducer: `(state, event) => nextState`.
- Effect layer: fetch/worker/storage; owns `AbortController`.
- Renderer: idempotent projection from state to existing DOM.
- URL adapter: parses/serializes only stable shareable state.
- Store adapter: versioned schema, migration, quota/error handling.
- Late async result is accepted only when `requestId` matches.

### 3.3 Data pipeline

- Assign stable IDs to all entities and relationships.
- Store raw events/records; derive win rate, aggregates, and chart series in code.
- Validate at authoring, CI, and runtime boundary. Runtime failure renders last-known-good data with a stale badge.
- Publish atomically and attach `{schemaVersion,dataVersion,generatedAt,sourceUpdatedAt}`.
- Replace blanket `no-store` with:
  - immutable versioned assets: `public, max-age=31536000, immutable`;
  - daily/weekly JSON: short `max-age`, longer `stale-while-revalidate`;
  - live quote API: seconds-level edge caching where provider terms permit;
  - private/admin responses: `private, no-store`.

## 4. Data visualization architecture

### Rendering decision table

| Case | Renderer | Rule |
| --- | --- | --- |
| ≤2,000 visible marks; semantic relationships matter | SVG + DOM | Stats curves, Arena equity, small ladders |
| Dense graph/continuous pan/zoom | Canvas 2D + DOM mirror | Sectors interactive graph |
| Spatial scene/depth/shaders | WebGL/Three.js + DOM content layer | Home combat, Sectors starfield, Boot |
| Static editorial relationship | Pre-rendered SVG | Social/SEO/export fallback |

### Shared chart contract

- `model`: immutable normalized series, labels, units, provenance.
- `scales`: pure data↔pixel functions shared by render/hit-test/export.
- `view`: SVG/canvas implementation.
- `interaction`: pointer, keyboard, touch crosshair; no business logic.
- `semantic`: heading, conclusion, table, live value announcement.
- `lifecycle`: resize observer, visibility pause, destroy/abort.

Performance rules:

- Cache paths/geometry until data or size changes.
- Do not read layout after writing it in the same frame.
- Coalesce pointer events and render at most once per rAF.
- Use `ResizeObserver`; avoid full-window resize work per component.
- For Canvas, render in CSS-pixel coordinates after one DPR transform.
- For large data, downsample by viewport buckets while retaining extrema; never downsample the underlying accessible table/export.

## 5. 3D modeling, assets, shaders, and effects

### 5.1 Asset decision

- Keep procedural geometry for stylized ships, HUD meshes, repeated primitives, and assets whose dimensions are algorithmically tested.
- Use GLB only for authored hero models whose topology/UV/material complexity is no longer maintainable in code.
- One asset must not exist in both procedural and GLB form without an explicit migration owner.

### 5.2 Authored GLB pipeline

`source .blend` → naming/scale/origin validation → glTF Transform dedupe/prune/weld → Meshopt geometry compression → KTX2/BasisU textures → LOD packaging → manifest + visual regression thumbnails.

Starting budgets, adjusted only by trace:

| Budget | Desktop high | Mobile high | Low tier |
| --- | --- | --- | --- |
| Active scene triangles | ≤350k | ≤120k | ≤60k |
| Hero LOD0 | ≤120k | ≤60k | not loaded |
| LOD ratios | 100% / 40% / 10% / impostor | 50% / 20% / impostor | impostor |
| Draw calls | ≤120 | ≤70 | ≤40 |
| Hero texture edge | 4096 only when visibly justified | 2048 | 1024 |
| Initial compressed 3D payload | ≤3 MB | ≤1.5 MB | poster only |
| Estimated active GPU assets | ≤220 MB | ≤140 MB | ≤80 MB |

- Pack ORM channels; prefer 8-bit textures; use normal maps instead of micro-geometry.
- Use KTX2 capability negotiation; retain a tested PNG/JPEG fallback only for unsupported cases.
- Choose LOD by projected screen size with hysteresis, not raw camera distance.
- Precompile/warm required shader variants before interaction; never compile on first weapon hit.

### 5.3 Shaders and VFX

- Central uniforms: time, resolution, DPR, quality, reduced motion, exposure.
- Shader tier controls loop counts and samples with compile-time defines.
- Pool transient geometry and materials. Track `renderer.info.memory` and draw calls in development.
- Bloom is selective and desktop/high-tier by default; mobile uses emissive materials/cheap sprites unless the frame trace passes.
- Reduce transparent overdraw: depth-sorted bounded effects, tight quads, no full-screen blending layers without a measured need.
- A reduced-motion path freezes ambient particles/camera drift but preserves necessary state feedback.

### 5.4 Frame-rate policy

- Measure nominal refresh using median rAF intervals; never assume 60 Hz.
- At 120 Hz the total frame budget is 8.33 ms; target app main-thread work ≤4.5 ms and leave compositor/browser headroom.
- At 60 Hz the budget is 16.67 ms; target app work ≤9 ms.
- Quality drops after sustained p95 overruns, and rises only after a longer stable window to prevent oscillation.
- Simulation may run fixed 60 Hz while rendering/input interpolate at 120 Hz. Physics uses accumulated fixed steps with a maximum of two catch-up steps.
- Long-task, dropped-frame, WebGL-loss, and quality-tier changes are development telemetry and optional privacy-safe production aggregates.

## 6. UI, UX, accessibility, and bilingual copy

### 6.1 Interaction system

- Minimum target: 44×44 CSS px; 8 px separation for adjacent destructive/primary actions.
- Every custom control has hover, active, focus-visible, disabled, loading, success, and error states where applicable.
- Dialogs trap focus, label themselves, close on Escape, and restore the trigger.
- Pointer gestures always have keyboard/button alternatives. Never make swipe/drag the only route to content.
- At 200% zoom, text reflows without two-dimensional page scrolling. Complex matrices may scroll internally with labeled regions.
- Contrast gates: 4.5:1 normal text, 3:1 large text and meaningful UI graphics; test both page themes and overlays.
- `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`, and `prefers-reduced-data` receive explicit fallbacks.

### 6.2 Copy model

```json
{
  "key": "arena.data.stale",
  "en": "Showing the last verified session · Updated {time} ET",
  "zh": "正在显示最近一次已验证交易日 · 更新于美东时间 {time}",
  "tone": "neutral",
  "maxChars": { "en": 72, "zh": 34 },
  "tokens": ["time"]
}
```

Rules:

- Translate intent and information hierarchy, not word order.
- EN uses sentence case for functional UI; all-caps is reserved for in-world labels.
- ZH uses full-width punctuation in prose, concise action labels, and explicit timezone/unit placement.
- One glossary controls technical terms: drawdown/回撤, confidence/置信度, stale/数据已过时, desk view/个人案头观点, entertainment only/仅供娱乐.
- Legal/risk meaning must be equivalent, not merely present in one locale.
- Data-generated text follows nested `{en,zh}`; legacy suffix fields are migrated at validation boundaries.
- Automated checks compare placeholder tokens, markup slots, URLs, and missing keys. Human review signs off headline rhythm, sensitive claims, and literary text.

## 7. SEO and technical discoverability

### 7.1 Static locale architecture

- Generate locale paths at build time while keeping the Vite MPA.
- Each locale document has fixed `lang`, localized title/description/H1, self-canonical, `hreflang="en"`, `hreflang="zh-CN"`, and `x-default`.
- The language switch is a normal link to the equivalent locale URL; JS may enhance it but is not required.
- Query experiments (`combatview`, `fx`, `embed`, `p2demo`) canonicalize to the base route and are not added to sitemap.
- Horoscope share links and future chapter URLs get their own policy: share payload pages remain `noindex` unless a safe server/build-rendered public document exists.

### 7.2 Route schema map

| Route | Schema.org graph |
| --- | --- |
| Home | `WebSite`, `ProfilePage`/`Person` only with verified public fields |
| Arena | `WebApplication` + methodology `Article`; `Dataset` for stable simulation records |
| Sectors | `CollectionPage`, `ItemList`, provenance-bearing `Dataset` where downloadable |
| Signal | `CollectionPage`, `ItemList`, `dateModified`; avoid false `NewsArticle` authorship/date claims |
| Stats | `Dataset`, `DataCatalog` only if multiple stable datasets are published |
| Horoscope | `WebApplication`, entertainment description |
| Serial | `Book`, `CreativeWorkSeries`, chapter pages, author identity as published |
| Course | `Course`, `ItemList`, `BreadcrumbList`; `CourseInstance` only for a real offering |

### 7.3 Discoverability gates

- CI parses emitted HTML, not source templates.
- Assert unique title/description, one canonical, valid JSON-LD, one H1, lang/hreflang parity, crawlable nav links, no broken internal links, and sitemap/manifest equality.
- Generate route-specific OG images at 1200×630 and localized alt text.
- Add `lastmod` only from a trustworthy content/data timestamp.
- Retired pages return permanent redirects; prototypes return noindex and are absent from internal nav.

## 8. Flagship mobile optimization

Official hardware anchors used for the test plan:

- iPhone 16 Pro Max: 6.9-inch OLED, 2868×1320 physical pixels, Dynamic Island, adaptive ProMotion up to 120 Hz. Apple: <https://support.apple.com/en-gb/121032>
- Galaxy S26 Ultra: 6.9-inch QHD+ 3120×1440 Dynamic AMOLED 2X, adaptive 1–120 Hz. Samsung: <https://news.samsung.com/uk/samsung-unveils-galaxy-s26-series-the-most-intuitive-galaxy-ai-phone-yet>
- Apple safe-area guidance: <https://developer.apple.com/design/human-interface-guidelines/layout>

Do not UA-sniff either device. Tune from capabilities and verify on real hardware/browser combinations.

### iPhone 16 Pro Max / Safari

- Standard portrait test target: approximately 440×956 CSS px at DPR 3, plus landscape and Display Zoom. Read actual `visualViewport`; do not hardcode these dimensions.
- Add `viewport-fit=cover` to every full-bleed route. Define `--safe-top/right/bottom/left: env(safe-area-inset-*)` and apply them to nav, modals, combat controls, reader toolbar, and edge gestures.
- Use `min-height:100svh` for stable initial shells and `100dvh` for active overlays. Avoid `100vh` for keyboard-sensitive forms.
- Listen to `visualViewport.resize/scroll` only while an input/dialog is active; rAF-coalesce updates. Horoscope fields, Arena unlock, and Serial controls remain visible above the keyboard.
- Keep essential tap controls below/away from the Dynamic Island safe region; full-bleed canvas may paint behind it, content may not.
- Test Safari back/forward cache: restore paused renderers, timers, and scroll state on `pageshow` with `event.persisted`.

### Samsung Galaxy S26 Ultra / Chrome and Samsung Internet

- Test FHD+/QHD+ modes, font scaling, display scaling, portrait/landscape, Chrome, and Samsung Internet. CSS viewport/DPR can differ by settings; use `visualViewport` and pixel-budget DPR.
- Respect camera cutout/rounded-corner safe insets and bottom browser/gesture UI with the same safe-area tokens.
- Support both coarse touch and S Pen hover: hover may enrich graph/tooltips, but tap/keyboard always performs selection. Use Pointer Events and pressure only as optional enhancement.
- Avoid edge-only drag handles that conflict with Android back gestures; inset graph/reader drag affordances at least 16 CSS px from side edges.
- Recalculate canvas backing stores after resolution/display-mode changes without destroying logical state.

### 120 Hz acceptance

On both devices, test three tiers:

1. **Content scroll:** p95 frame interval ≤10 ms in 120 Hz mode, no long task >100 ms during steady scroll.
2. **Interactive visualization:** stable 60 fps minimum; 120 fps input/camera response when quality permits.
3. **Heavy 3D:** 60 fps target, 45 fps degradation threshold, automatic quality drop below threshold, no thermal runaway during a 5-minute session.

Also verify touch-to-feedback starts in the next frame, no accidental page zoom on custom surfaces, browser pinch zoom remains available for page content, and battery/thermal tests do not force repeated WebGL context loss.

## 9. Execution plan and acceptance gates

### Wave 0 — Baseline and safety net (2–4 days)

- Record mobile/desktop Lighthouse, bundle map, 30-second performance traces, WebGL renderer counts, draw calls, active triangles, and memory proxies per route/branch.
- Add Playwright desktop + iPhone 16 Pro Max-like + Galaxy S26 Ultra-like profiles; use real-device runs for final sign-off.
- Add axe, keyboard smoke, console error, and emitted-metadata checks.
- **Exit:** baselines stored; tests cover every active route and critical branch; no proposal item relies on an unmeasured “faster”.

### Wave 1 — Cross-cutting P0 foundation (1–2 weeks)

- Ship site manifest, locale-key migration, fetch client, responsive safe-area tokens, renderer coordinator, context recovery, and retired-route cleanup.
- **Exit:** one route source drives build/nav/sitemap/metadata; locale survives a full nav cycle; background tabs reach zero active animation loops; all dialogs/graphs pass basic keyboard and axe gates.

### Wave 2 — Heavy-route restructuring (2–4 weeks)

- Home split/lifecycle; Arena state pipeline; Sectors worker/renderer lease; Stats module/worker; Horoscope feature chunks; Serial reader store/history.
- **Exit:** no route regresses CWV budgets by >5%; no stale async render races in forced-network tests; workers terminate; route teardown returns renderer/listener counts to baseline.

### Wave 3 — Locale SEO and content pipeline (2–3 weeks)

- Move content into bilingual schemas; generate EN/ZH documents, localized metadata/Schema.org, chapter URLs, and route-specific OG assets.
- **Exit:** emitted HTML passes canonical/hreflang/schema/link checks; JS-disabled pages expose core content and navigation; locale parity lint is green.

### Wave 4 — 3D asset/LOD and 120 Hz refinement (1–3 weeks)

- Add procedural LODs, pooling, shader tiers, optional GLB toolchain, and real-device quality tuning.
- **Exit:** triangle/draw-call/payload/GPU-memory budgets pass; 5-minute iPhone/Samsung sessions meet the 60 fps heavy-scene target or visibly select a documented lower tier without crashes.

### Wave 5 — P2 polish (ongoing, budgeted)

- Refine copy, exports, social assets, motion tokens, and prototype decision.
- **Exit:** P0/P1 gates remain green; each polish item has a user task or measurable communication benefit.

## 10. Definition of done

An optimization item is complete only when:

1. It names the affected route and branch.
2. Pure logic has unit coverage; browser behavior has an integration check.
3. EN and ZH states are both reviewed, including error/empty/stale copy.
4. Keyboard, screen reader semantics, 200% zoom, reduced motion, and touch are verified in proportion to the feature.
5. Bundle/CWV/frame/memory budgets are measured before and after.
6. Async work aborts and renderers/workers/listeners/timers dispose on navigation or hide.
7. Emitted HTML metadata and structured data validate.
8. iPhone 16 Pro Max Safari and Galaxy S26 Ultra Chrome/Samsung Internet receive real-device sign-off for mobile/3D changes.
9. `design.md` narrative identity and `tech.md` architecture decisions are updated only when the implementation creates a new durable rule.

## 11. Explicit non-goals

- No React/Next/Astro/Tailwind migration solely for fashion or component syntax.
- No simultaneous GSAP + Framer + bespoke animation runtimes. The existing scheduler remains default; add a dependency only against a measured, cross-route need.
- No converting SEO-relevant text into canvas/WebGL.
- No WebGPU production switch before WebGL baselines, fallbacks, and real-device evidence exist.
- No high-detail GLB asset merely to replace a cheaper, testable procedural model.
- No “120 fps” claim based on a desktop simulator; flagship acceptance is on real devices.

> **2026-07-25 archival note**: the "Red vs Blue" Sectors US-China AI Competition storyboard (formerly Part 3, RB-P0-01 through RB-P0-07) shipped and was archived into `design.md` (narrative shell, palette, five-act storyboard, radar/table/boards/scoreboard interaction language) and `tech.md` (data contracts, force-graph bloc polarity, module list, test counts, sandbox-Playwright pitfall). The open RB-P1/P2 backlog items moved to `tech.md` §10.2. This section is deleted per that archival, following the same pattern `tech.md` §10 already used for the old `roadmap.md`/`Urgent.md` migration.
