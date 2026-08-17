# Melbourne P0 acquisition decision

- Decision date: 2026-08-15 (normalized from 15/08/2026)
- Signer: Feida Wang
- Project roles for this decision: data owner and licence reviewer
- Decision: approved for acquisition only
- Production approval: not granted

## Scope

This decision authorizes Project Afflatus to download and retain immutable raw inventory copies of these five Melbourne candidate layers for the bounded Cityview engineering spike:

1. `melbourne-buildings-2023`
2. `melbourne-vicmap-roads`
3. `melbourne-pedestrian-network`
4. `melbourne-vicmap-hydro`
5. `melbourne-urban-forest-trees`

The decision relies on the official dataset records and licence pages archived in `data/city/melbourne-p0-licence-evidence-2026-08-15.json`, including the DataVic copyright policy and CC BY 4.0 legal code. For this project decision, caching, precinct clipping, engineering derivatives, redistribution of attributed project derivatives and commercial website use are accepted subject to the controlling dataset record, attribution, indication of modifications and any third-party exclusions.

## Conditions

- Each selected artifact must receive its own retrieval URL, retrieval timestamp, byte count and SHA-256 before processing.
- Download-time metadata and terms must be saved with the inventory record.
- Source CRS and vertical datum are not inferred from portal labels; the selected artifact or API contract must supply them, and engineering QA must verify them.
- Raw GIS remains outside `public/`, production assets and Git history.
- This decision does not approve a CityPackage, imagery, real-city runtime loading or public release.
- Engineering and product release approvals remain independent and must be named, dated and evidence-backed after spatial, geometry, performance and attribution QA.

This is the project owner's acquisition and licence decision recorded from the user's explicit instruction in the Cityview implementation task. It is not represented as independent external legal advice.
