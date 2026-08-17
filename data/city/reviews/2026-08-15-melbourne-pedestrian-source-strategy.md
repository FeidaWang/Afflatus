# Melbourne pedestrian source strategy

- Decision date: 2026-08-15
- Scope: `melbourne-pedestrian-network`
- Production approval: not granted

## Primary source confirmed

The City of Melbourne v1 dataset metadata still publishes an uploaded alternative export:

- title: `Pedestrian_Network.zip`
- id: `pedestrian_network_zip`
- media type: `application/zip`
- official endpoint: `https://data.melbourne.vic.gov.au/api/datasets/1.0/pedestrian-network/alternative_exports/pedestrian_network_zip/`
- portal data processed: `2022-11-24T20:17:35Z`
- source modified: `2019-11-19`

The archive contains `Pedestrian_network.json` with 71,060 LineString features and all twelve documented source properties, plus `Property_centroid.json` with 14,266 Point features. The complete line source includes `OBJECTID`, `NETID`, `TYPE`, `MCCID`, `MCCID_A`, `MCCID_B`, `OTIME`, `CTIME`, `COST`, `Shape_Length`, `DESCRIPTION` and `TRAFFIC`.

The v2 portal record for `OBJECTID=65923` has byte-for-byte equal coordinate values to the corresponding complete-archive feature. That check supports the local `OGC:CRS84` interpretation while preserving the original two-dimensional coordinates and assigning no source elevation.

## Plan B — fail closed, no invented semantics

1. The immutable acquired ZIP and its checksum are the immediate reproducibility fallback if the upstream alternative export disappears. It remains outside `public/` and Git; only attributed, checksummed engineering derivatives may be committed. Before production approval, copy the exact bytes to access-controlled, versioned private object storage with retention enabled and verify the same SHA-256; that off-device backup has not been performed yet.
2. If a future upstream release no longer includes the complete archive, the v2 GeoJSON export may replace geometry only. Its current schema exposes `OBJECTID`, `NeworkID` and WGS84 geometry but omits route type, cost, traffic and opening fields. Missing values remain `unknown`; they must not be inferred from line shape.
3. Official `Footpaths`, `Road Corridors` and current Vicmap road layers may be evaluated as separate source layers for surface width, laneway presentation and topology. Any spatial classification produced from them is `derived`, retains every source ID and never overwrites the pedestrian source fields.
4. OpenStreetMap or another third-party network is not an automatic fallback. It requires a new ledger layer, ODbL/attribution review, provenance separation and explicit acquisition approval before download.
5. A geometry-only fallback may support visual paths but cannot claim accessible routing, arcade/laneway identity, traffic-light penalties, opening hours or live pedestrian conditions.

This strategy confirms source availability and engineering fallbacks only. It does not approve a CityPackage or public runtime use.
