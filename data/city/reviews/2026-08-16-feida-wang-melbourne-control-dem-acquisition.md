# Melbourne Survey Control + DEM acquisition and processing decision

- Decision date: 2026-08-16 (Australia/Melbourne)
- Signer: Feida Wang
- Project roles for this decision: data owner and licence reviewer
- Decision: approved for acquisition and bounded engineering processing
- Production approval: not granted

## Scope

This decision records the user's explicit instruction to obtain and process the following two official Victorian datasets and to continue the dependent Melbourne Cityview engineering work:

1. `melbourne-vicmap-survey-control` — Vicmap Position survey control marks, clipped to the existing Flinders–Federation engineering precinct.
2. `melbourne-vicmap-dem10m` — Vicmap Elevation DEM 10m, obtained through the official DataShare delivery path and reduced to the same bounded precinct for engineering QA.

The decision relies on the official dataset records, DataVic copyright guidance, DataShare terms, DEECA spatial-data licensing guidance and CC BY 4.0 legal code archived by `data/city/melbourne-control-dem-licence-evidence-2026-08-16.json`. For this project decision, immutable raw inventory retention, precinct clipping, coordinate transformation, terrain sampling, residual analysis and attributed engineering derivatives are approved subject to the controlling record, download-time terms and any third-party exclusions.

## Conditions

- Each source response and delivered file receives its exact retrieval URL or order evidence, retrieval timestamp, byte count and SHA-256 before processing.
- Survey controls used for the release gate must be status `OK`, horizontally adjusted in GDA2020 and vertically adjusted in AHD; rejected or lower-confidence marks remain preserved in raw inventory but cannot silently enter the trusted control set.
- The DEM's horizontal CRS and vertical datum are read from the delivered archive and GeoTIFF metadata. The portal title, output selector or a historical assumption is not sufficient evidence.
- DEM reprojection and resampling are recorded as derived operations. Source cell values and the immutable delivered artifact remain separately hashable.
- Raw GIS and order responses remain outside `public/`, production assets and Git history.
- This approval does not authorize public runtime loading, publication of personal order details, a production CityPackage or public release.
- Engineering and product-release approvals remain independent and must be named, dated and evidence-backed after spatial, terrain, performance and attribution QA.

This is the project owner's acquisition and processing decision captured from the user's explicit instruction. It is not represented as independent external legal advice.
