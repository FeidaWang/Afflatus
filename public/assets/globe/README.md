# Departure globe

`earth-land.json` and `departure.svg` are derived from Natural Earth 1:110m land.
Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson
Retrieved 2026-09-22. Public domain: https://www.naturalearthdata.com/about/terms-of-use/
No country borders, population, visits, or survey weights are encoded.

Rebuild: download the source GeoJSON, then run
`node scripts/build-home-globe.mjs /path/to/ne_110m_land.geojson` from the repository root.
The script deterministically samples land and subdivides coast segments on the sphere.
The original spacecraft linework is defined in `src/showcase/globeMath.js`.
