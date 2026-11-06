#!/usr/bin/env node
/* ============================================================
   Builds the versioned election maps from official boundary files.
   Run by hand when a source changes; the site never fetches a source.

     node scripts/build-election-geography.mjs --raw <dir outside the repo>

   Raw downloads stay in --raw. The repository only gets the simplified,
   projected SVG paths, the manifest and the official electorate names.
   mapshaper runs through npx at a pinned version and is not a dependency.
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const VERSION = '2026-11-04';
const MAPSHAPER = 'mapshaper@0.7.101';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/assets/elections/maps', VERSION);
const NAMES_FILE = join(ROOT, 'src/config/electionElectorates.generated.js');
const RAW = resolve(process.argv[process.argv.indexOf('--raw') + 1] || '');
if (!process.argv.includes('--raw') || RAW.startsWith(ROOT)) throw new Error('Pass --raw <dir outside the repository>');
const WORK = join(RAW, 'work');
const USER_AGENT = 'afflatus-election-geography';

const STATES = Object.freeze({
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', 10: 'DE', 12: 'FL', 13: 'GA',
  15: 'HI', 16: 'ID', 17: 'IL', 18: 'IN', 19: 'IA', 20: 'KS', 21: 'KY', 22: 'LA', 23: 'ME', 24: 'MD',
  25: 'MA', 26: 'MI', 27: 'MN', 28: 'MS', 29: 'MO', 30: 'MT', 31: 'NE', 32: 'NV', 33: 'NH', 34: 'NJ',
  35: 'NM', 36: 'NY', 37: 'NC', 38: 'ND', 39: 'OH', 40: 'OK', 41: 'OR', 42: 'PA', 44: 'RI', 45: 'SC',
  46: 'SD', 47: 'TN', 48: 'TX', 49: 'UT', 50: 'VT', 51: 'VA', 53: 'WA', 54: 'WV', 55: 'WI', 56: 'WY',
});
const FIPS = Object.keys(STATES).map((code) => code.padStart(2, '0')).sort();
const postal = (fips) => STATES[fips] || STATES[Number(fips)];

// The Census page names these as redrawn for 2026. The build fails if the land areas disagree.
const CENSUS_REDRAWN = ['AL', 'CA', 'FL', 'LA', 'NC', 'OH', 'TN', 'TX', 'UT'];
const CD_URL = (fips) => `https://www2.census.gov/geo/tiger/TIGER2026/CD/tl_2026_${fips}_cd120.zip`;
// Census: the 2026 Missouri shapefile still holds the blocked map; the plan in effect is the 2022 and 2024 one.
const MO_URL = 'https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_29_cd119.zip';
const STATE_URL = 'https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_5m.zip';
const TIGERWEB = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer';
const VIC_WFS = (layer) => `https://opendata.maps.vic.gov.au/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=urn:ogc:def:crs:OGC:1.3:CRS84&typeNames=open-data-platform:${layer}`;
const NSW_QUERY = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Administrative_Boundaries_Theme/FeatureServer/4/query?where=1%3D1&outFields=districtname,startdate,enddate,lastupdate&outSR=4326&orderByFields=districtname&f=geojson';

const fetchLog = [];

async function download(url, file) {
  const path = join(RAW, file);
  const logPath = `${path}.fetch.json`;
  if (existsSync(path) && existsSync(logPath)) {
    fetchLog.push(JSON.parse(readFileSync(logPath, 'utf8')));
    return path;
  }
  mkdirSync(dirname(path), { recursive: true });
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(path, bytes);
  const entry = {
    url,
    fetchedAt: new Date().toISOString(),
    lastModified: response.headers.get('last-modified'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  writeFileSync(logPath, JSON.stringify(entry));
  fetchLog.push(entry);
  return path;
}

function unzipInto(zip) {
  const dir = `${zip}.d`;
  if (!existsSync(dir)) {
    mkdirSync(dir);
    execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
  }
  return join(dir, readdirSync(dir).find((name) => name.endsWith('.shp')));
}

const mapshaper = (args) => execFileSync('npx', ['-y', MAPSHAPER, ...args], { cwd: RAW, stdio: ['ignore', 'ignore', 'inherit'] });

/* ---------- Projection ---------- */

const RAD = Math.PI / 180;

/** Albers equal-area conic, in units of one sphere radius. Longitudes wrap, so the Aleutians stay together. */
function albers(lon0, lat0, parallel1, parallel2) {
  const [s1, s2] = [Math.sin(parallel1 * RAD), Math.sin(parallel2 * RAD)];
  const n = (s1 + s2) / 2;
  const c = Math.cos(parallel1 * RAD) ** 2 + 2 * n * s1;
  const rho0 = Math.sqrt(c - 2 * n * Math.sin(lat0 * RAD)) / n;
  return (lon, lat) => {
    const delta = ((lon - lon0 + 540) % 360) - 180;
    const rho = Math.sqrt(c - 2 * n * Math.sin(lat * RAD)) / n;
    const theta = n * delta * RAD;
    return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
  };
}

const placed = (project, scale, x, y) => (lon, lat) => {
  const [px, py] = project(lon, lat);
  return [x + px * scale, y - py * scale];
};

// The usual US composite. Alaska and Hawaii are labelled insets at their own scale, not true positions.
const US_SCALE = 10700;
const usProjection = (state) => {
  if (state === 'AK') return placed(albers(-156, 58.5, 55, 65), US_SCALE * 0.35, 4800 - 0.307 * US_SCALE, 2500 + 0.201 * US_SCALE);
  if (state === 'HI') return placed(albers(-160, 19.9, 8, 18), US_SCALE, 4800 - 0.205 * US_SCALE, 2500 + 0.212 * US_SCALE);
  return placed(albers(-96.6, 38.7, 29.5, 45.5), US_SCALE, 4800, 2500);
};

/* ---------- Geometry to SVG paths ---------- */

const polygonsOf = (geometry) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);

function ringPath(ring) {
  const points = [];
  for (const point of ring) {
    const last = points.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(point);
  }
  if (points.length < 3) return '';
  const pair = (a, b) => `${a}${b < 0 ? '' : ' '}${b}`;
  let path = `M${pair(...points[0])}l`;
  points.slice(1).forEach((point, index) => {
    const [dx, dy] = [point[0] - points[index][0], point[1] - points[index][1]];
    path += `${index && dx >= 0 ? ' ' : ''}${pair(dx, dy)}`;
  });
  return `${path}z`;
}

function ringArea(ring) {
  let area = 0;
  for (let i = 1; i < ring.length; i += 1) area += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
  return area / 2;
}

function ringCentroid(ring) {
  const area = ringArea(ring);
  if (!area) return ring[0];
  let [x, y] = [0, 0];
  for (let i = 1; i < ring.length; i += 1) {
    const cross = ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
    x += (ring[i - 1][0] + ring[i][0]) * cross;
    y += (ring[i - 1][1] + ring[i][1]) * cross;
  }
  return [Math.round(x / (6 * area)), Math.round(y / (6 * area))];
}

function projectFeature(id, geometry, project) {
  const rings = polygonsOf(geometry).flatMap((polygon) => polygon).map((ring) => ring.map(([lon, lat]) => project(lon, lat).map(Math.round)));
  const d = rings.map(ringPath).join('');
  const xs = rings.flatMap((ring) => ring.map((point) => point[0]));
  const ys = rings.flatMap((ring) => ring.map((point) => point[1]));
  const outers = polygonsOf(geometry).map((polygon) => polygon[0].map(([lon, lat]) => project(lon, lat).map(Math.round)));
  const biggest = outers.reduce((best, ring) => (Math.abs(ringArea(ring)) > Math.abs(ringArea(best)) ? ring : best));
  return { id, d, b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], c: ringCentroid(biggest) };
}

const bounds = (features) => [
  Math.min(...features.map((f) => f.b[0])), Math.min(...features.map((f) => f.b[1])),
  Math.max(...features.map((f) => f.b[2])), Math.max(...features.map((f) => f.b[3])),
];

const readGeo = (file) => JSON.parse(readFileSync(file, 'utf8')).features.filter((feature) => feature.geometry);

/** Fits lon/lat features to a fixed width with an Albers conic centred on them. */
function fittedProjection(features, width = 10000) {
  const lons = []; const lats = [];
  for (const feature of features) {
    for (const polygon of polygonsOf(feature.geometry)) for (const [lon, lat] of polygon[0]) { lons.push(lon); lats.push(lat); }
  }
  const [west, east, south, north] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const base = albers((west + east) / 2, (south + north) / 2, south + (north - south) / 6, north - (north - south) / 6);
  const corners = [[west, south], [west, north], [east, south], [east, north]].map(([lon, lat]) => base(lon, lat));
  const span = Math.max(...corners.map((p) => p[0])) - Math.min(...corners.map((p) => p[0]));
  return placed(base, width / span, width / 2, 0);
}

function writeMap(id, map) {
  const box = bounds(map.features);
  const pad = Math.round((box[2] - box[0]) * 0.012);
  const viewBox = [box[0] - pad, box[1] - pad, box[2] - box[0] + 2 * pad, box[3] - box[1] + 2 * pad];
  const text = JSON.stringify({ id, version: VERSION, viewBox, ...map });
  writeFileSync(join(OUT, `${id}.json`), text);
  return {
    file: `${id}.json`,
    features: map.features.length,
    bytes: Buffer.byteLength(text),
    gzipBytes: gzipSync(text, { level: 9 }).length,
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

/* ---------- United States ---------- */

async function auditCensusFiles() {
  const query = (layer) => `${TIGERWEB}/${layer}/query?where=1%3D1&outFields=STATE,BASENAME,AREALAND,GEOID&returnGeometry=false&f=json`;
  const read = async (layer) => {
    const file = await download(query(layer), `us-audit/layer-${layer}.json`);
    return JSON.parse(readFileSync(file, 'utf8')).features.map((feature) => feature.attributes);
  };
  const [current, previous] = await Promise.all([read(0), read(4)]);
  const land = (rows) => {
    const table = new Map();
    for (const row of rows) {
      const state = postal(row.STATE);
      if (state) table.set(`${state}:${row.GEOID}`, Number(row.AREALAND));
    }
    return table;
  };
  const [now, before] = [land(current), land(previous)];
  const redrawn = new Set();
  const corrected = new Set();
  const redrawnDistricts = {};
  for (const [key, area] of now) {
    const old = before.get(key);
    if (old === area) continue;
    const state = key.split(':')[0];
    // Paired swaps of under 0.1% of a district are boundary corrections, not new plans (IL and SC in 2026).
    if (old === undefined || Math.abs(area - old) > Math.max(old, 1) * 0.001) {
      redrawn.add(state);
      (redrawnDistricts[state] ||= []).push(key.split(':')[1]);
    } else {
      corrected.add(state);
    }
  }
  return { redrawn: [...redrawn].sort(), corrected: [...corrected].filter((state) => !redrawn.has(state)).sort(), redrawnDistricts };
}

async function buildUnitedStates() {
  mkdirSync(join(WORK, 'us'), { recursive: true });
  const stateShp = unzipInto(await download(STATE_URL, 'us-state/cb_2025_us_state_5m.zip'));
  for (const fips of FIPS) {
    const state = postal(fips);
    const url = fips === '29' ? MO_URL : CD_URL(fips);
    const zip = await download(url, `us-cd/${fips}/${url.split('/').at(-1)}`);
    const shp = unzipInto(zip);
    const out = join(WORK, 'us', `${state}.json`);
    if (existsSync(out)) continue;
    const field = fips === '29' ? 'CD119FP' : 'CD120FP';
    const outline = join(WORK, 'us', `${state}-outline.geojson`);
    mapshaper(['-i', stateShp, '-filter', `STATEFP === '${fips}'`, '-o', outline, 'format=geojson']);
    mapshaper([
      '-i', shp,
      // 98 is a non-voting delegate, ZZ a water-only remainder. Neither is a House seat.
      '-filter', `${field} !== 'ZZ' && ${field} !== '98'`,
      '-clip', outline, 'remove-slivers',
      '-each', `seat = '${state}-' + (${field} === '00' ? 'AL' : ${field}), state = '${state}'`,
      '-filter-fields', 'seat,state',
      '-o', out, 'format=geojson',
    ]);
  }

  const allStates = FIPS.map((fips) => join(WORK, 'us', `${postal(fips)}.json`));
  const house = join(WORK, 'us-house.json');
  const outlines = join(WORK, 'us-outlines.json');
  mapshaper(['-i', ...allStates, 'combine-files', '-merge-layers', 'force', '-snap', 'precision=0.00001', '-simplify', 'interval=1700', 'keep-shapes', '-clean', '-o', house, 'format=geojson']);
  mapshaper(['-i', house, '-dissolve', 'state', '-o', outlines, 'format=geojson']);

  const senate = join(WORK, 'us-senate.json');
  const stateList = FIPS.map((code) => `'${code}'`).join(',');
  mapshaper(['-i', stateShp, '-filter', `[${stateList}].includes(STATEFP)`, '-simplify', 'interval=3000', 'keep-shapes', '-each', 'state = STUSPS', '-filter-fields', 'state', '-o', senate, 'format=geojson']);

  const insets = (features) => ['AK', 'HI'].map((state) => {
    const box = bounds(features.filter((feature) => (feature.state || feature.id).startsWith(state)));
    return { state, b: box };
  });
  const toFeature = (key) => (feature) => {
    const state = feature.properties.state;
    return { ...projectFeature(feature.properties[key], feature.geometry, usProjection(state)), state };
  };
  const houseFeatures = readGeo(house).map(toFeature('seat')).sort((a, b) => (a.id < b.id ? -1 : 1));
  const senateFeatures = readGeo(senate).map(toFeature('state')).sort((a, b) => (a.id < b.id ? -1 : 1));
  const overlay = readGeo(outlines).map((feature) => projectFeature(feature.properties.state, feature.geometry, usProjection(feature.properties.state)).d).join('');
  const strip = ({ state: _state, ...feature }) => feature;
  return {
    'us-house': writeMap('us-house', { features: houseFeatures.map(strip), overlay, insets: insets(houseFeatures) }),
    'us-senate': writeMap('us-senate', { features: senateFeatures.map(strip), insets: insets(senateFeatures) }),
  };
}

/* ---------- Australia ---------- */

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stripSuffix = (label, suffix) => label.replace(new RegExp(` ${suffix}$`), '');

// The NSW service publishes upper case only.
const titleCase = (name) => name.toLowerCase().replace(/(^|\s)([a-z])/g, (_, gap, letter) => `${gap}${letter.toUpperCase()}`);

async function buildVictoria() {
  const assemblyRaw = await download(VIC_WFS('state_assembly_2022'), 'vic/state_assembly_2022.geojson');
  const councilRaw = await download(VIC_WFS('state_council_2022'), 'vic/state_council_2022.geojson');
  const assembly = join(WORK, 'vic-assembly.json');
  const council = join(WORK, 'vic-council.json');
  const outlines = join(WORK, 'vic-regions.json');
  mapshaper(['-i', assemblyRaw, '-simplify', 'interval=300', 'keep-shapes', '-filter-fields', 'district_label,region_label', '-o', assembly, 'format=geojson']);
  mapshaper(['-i', councilRaw, '-simplify', 'interval=500', 'keep-shapes', '-filter-fields', 'region_label', '-o', council, 'format=geojson']);
  mapshaper(['-i', assembly, '-dissolve', 'region_label', '-o', outlines, 'format=geojson']);

  const districtRows = readGeo(assembly);
  const regionRows = readGeo(council);
  const project = fittedProjection(regionRows);
  const districts = districtRows.map((row) => {
    const name = stripSuffix(row.properties.district_label, 'District');
    const region = stripSuffix(row.properties.region_label, 'Region');
    return { id: slug(name), name, regionId: slug(region), geometry: row.geometry };
  }).sort((a, b) => (a.name < b.name ? -1 : 1));
  const regions = regionRows.map((row) => {
    const name = stripSuffix(row.properties.region_label, 'Region');
    return { id: slug(name), name, geometry: row.geometry };
  }).sort((a, b) => (a.name < b.name ? -1 : 1));
  const overlay = readGeo(outlines).map((row) => projectFeature('', row.geometry, project).d).join('');
  return {
    names: {
      VIC_DISTRICTS: districts.map(({ id, name, regionId }) => ({ id, name, regionId })),
      VIC_REGIONS: regions.map(({ id, name }) => ({ id, name })),
    },
    maps: {
      'vic-assembly': writeMap('vic-assembly', { features: districts.map((row) => projectFeature(row.id, row.geometry, project)), overlay }),
      'vic-council': writeMap('vic-council', { features: regions.map((row) => projectFeature(row.id, row.geometry, project)) }),
    },
  };
}

async function buildNewSouthWales() {
  const raw = await download(NSW_QUERY, 'nsw/state_electoral_district.geojson');
  const assembly = join(WORK, 'nsw-assembly.json');
  mapshaper([
    '-i', raw,
    // Lord Howe Island sits about 600 km offshore in Port Macquarie and would shrink the whole map.
    '-explode', '-filter', 'this.bounds[0] < 155',
    '-dissolve', 'districtname',
    '-simplify', 'interval=350', 'keep-shapes',
    '-o', assembly, 'format=geojson',
  ]);
  const rows = readGeo(assembly);
  const project = fittedProjection(rows);
  const districts = rows.map((row) => {
    const name = titleCase(row.properties.districtname);
    return { id: slug(name), name, geometry: row.geometry };
  }).sort((a, b) => (a.name < b.name ? -1 : 1));
  // A viewport for the search control, not a boundary.
  const corners = [[150.45, -34.25], [151.45, -33.4]].map(([lon, lat]) => project(lon, lat).map(Math.round));
  const sydney = [corners[0][0], corners[1][1], corners[1][0], corners[0][1]];
  return {
    names: { NSW_DISTRICTS: districts.map(({ id, name }) => ({ id, name })) },
    maps: { 'nsw-assembly': writeMap('nsw-assembly', { features: districts.map((row) => projectFeature(row.id, row.geometry, project)), areas: { sydney } }) },
  };
}

/* ---------- Manifest ---------- */

const ATTRIBUTION = Object.freeze({
  census: 'U.S. Census Bureau, TIGER/Line and Cartographic Boundary files',
  vic: '© State Government of Victoria (Victorian Electoral Commission), Vicmap Admin, CC BY 4.0',
  nsw: '© State of New South Wales (Spatial Services), NSW Administrative Boundaries, CC BY',
});

function sources(audit) {
  const census = fetchLog.filter((entry) => entry.url.includes('/TIGER2026/CD/'));
  return [
    {
      id: 'census-cd120-2026',
      label: 'TIGER/Line 2026, 120th Congressional Districts, 49 states',
      directory: 'https://www2.census.gov/geo/tiger/TIGER2026/CD/',
      licence: 'CC0 1.0 per the data.gov record; credit the Census Bureau. Statistical boundaries, not legal land descriptions.',
      attribution: ATTRIBUTION.census,
      boundaryVersion: '120th Congress, TIGER 2026 files dated 2026-10-06',
      electionValidity: 'Census: "in effect for the 2026 election cycle"; information confirmed by states by 2026-05-31.',
      evidence: [
        'https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html',
        'https://catalog.data.gov/dataset/series-information-for-120th-congressional-district-state-based-tiger-line-shapefiles-curr',
      ],
      files: census,
    },
    {
      id: 'census-mo-cd119',
      label: 'TIGER/Line 2025, Missouri, 119th Congressional Districts',
      licence: 'CC0 1.0 per the data.gov record; credit the Census Bureau.',
      attribution: ATTRIBUTION.census,
      boundaryVersion: '119th Congress plan, used in 2022 and 2024',
      electionValidity: 'Census: the 2026 Missouri shapefile is not yet regenerated; the plan in effect for 2026 is the 2022 and 2024 plan after the Supreme Court declined to allow the new map.',
      evidence: ['https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html'],
      files: fetchLog.filter((entry) => entry.url === MO_URL),
    },
    {
      id: 'census-states-5m',
      label: 'Cartographic Boundary 2025, States, 1:5,000,000',
      licence: 'CC0 1.0 per the data.gov record; credit the Census Bureau.',
      attribution: ATTRIBUTION.census,
      boundaryVersion: '2025 vintage',
      electionValidity: 'State outlines. Used for Senate polygons and to clip districts to the shoreline for display.',
      files: fetchLog.filter((entry) => entry.url === STATE_URL),
    },
    {
      id: 'census-area-audit',
      label: 'TIGERweb Legislative layers 0 (120th) and 4 (119th), land area attributes',
      licence: 'Same as above. Attributes only, not published.',
      boundaryVersion: 'Queried at build time',
      electionValidity: `States with a district land area more than 0.1% different between the two layers: ${audit.redrawn.join(', ')}. The build fails unless this equals the nine states Census names as redrawn, plus Missouri, whose stale 2026 file is replaced here. Under 0.1%, treated as boundary corrections: ${audit.corrected.join(', ')}. Alabama differs in GEOIDs ${audit.redrawnDistricts.AL.join(', ')}, the districts that held the August 2026 special primaries.`,
      files: fetchLog.filter((entry) => entry.url.startsWith(TIGERWEB)),
    },
    {
      id: 'vicmap-admin-2022',
      label: 'Vicmap Admin, State Assembly and State Council polygons 2022',
      licence: 'CC BY 4.0',
      attribution: ATTRIBUTION.vic,
      boundaryVersion: '2020-21 State Redivision, layer names state_assembly_2022 and state_council_2022',
      electionValidity: 'Electoral Boundaries Commission: the boundaries took effect 1 Nov 2022, and a review is required once two State elections have passed since the last redivision. VEC: 88 districts and 8 regions for 2026, with no boundary change announced. That these lines apply in 2026 is inferred from those statements; no VEC page states it in one sentence.',
      evidence: [
        'https://discover.data.vic.gov.au/dataset/vicmap-admin-state-assembly-polygon-2022',
        'https://ebc.vic.gov.au/About/AboutRedivisions.html',
        'https://www.vec.vic.gov.au/voting/2026-state-election',
      ],
      files: fetchLog.filter((entry) => entry.url.startsWith('https://opendata.maps.vic.gov.au')),
    },
    {
      id: 'nsw-spatial-sed',
      label: 'NSW Administrative Boundaries, State Electoral District (FeatureServer layer 4)',
      licence: 'CC BY per the NSW Foundation Spatial Data Framework record on data.nsw.gov.au; data.gov.au shows CC BY 3.0 AU for the same record. The live service has no licence field of its own.',
      attribution: ATTRIBUTION.nsw,
      boundaryVersion: 'Current service, 93 districts. Names match the 2021 redistribution, including Badgerys Creek, Kellyville, Leppington, Wahroonga and Winston Hills.',
      electionValidity: 'NSW Electoral Commission: the 2021 redistribution applies to the 2023 and 2027 State elections. Lord Howe Island, part of Port Macquarie, is left off the map.',
      evidence: [
        'https://data.nsw.gov.au/data/dataset/1e560b0e-5e0b-4ddb-a3a3-76d199d347f4',
        'https://elections.nsw.gov.au/elections/how-voting-works/electoral-boundaries',
        'https://elections.nsw.gov.au/voters/electoral-districts-redistribution/2021-redistribution',
      ],
      files: fetchLog.filter((entry) => entry.url === NSW_QUERY),
    },
  ];
}

const GAPS = Object.freeze([
  { event: 'au-2028', office: 'house', reason: 'AEC publishes no current national dataset until the Queensland redistribution completes, and the boundaries for the next election are not settled.' },
  { event: 'au-2028', office: 'senate', reason: 'Senators represent whole states and territories. No map is built before the House boundaries are settled.' },
  { event: 'nsw-2027', office: 'council', reason: 'The Legislative Council is elected state-wide, so there are no district boundaries to draw.' },
  { event: 'us-2028', office: 'president', reason: 'Not built in this stage.' },
]);

function writeNames(names) {
  const body = Object.entries(names).map(([key, rows]) => `export const ${key} = Object.freeze(${JSON.stringify(rows, null, 2)});`).join('\n\n');
  writeFileSync(NAMES_FILE, `// Generated by scripts/build-election-geography.mjs from official boundary files. Do not edit.\n\n${body}\n`);
}

async function main() {
  mkdirSync(WORK, { recursive: true });
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const audit = await auditCensusFiles();
  const expected = [...CENSUS_REDRAWN, 'MO'].sort();
  if (audit.redrawn.join() !== expected.join()) throw new Error(`Census layers redrawn in ${audit.redrawn}, expected ${expected}`);

  const usMaps = await buildUnitedStates();
  const victoria = await buildVictoria();
  const nsw = await buildNewSouthWales();
  writeNames({ ...victoria.names, ...nsw.names });

  const maps = { ...usMaps, ...victoria.maps, ...nsw.maps };
  writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify({
    version: VERSION,
    generatedBy: `scripts/build-election-geography.mjs with ${MAPSHAPER}`,
    display: 'Simplified and projected for display. Not for legal or boundary-precise use.',
    sources: sources(audit),
    maps,
    gaps: GAPS,
  }, null, 2)}\n`);
  console.table(Object.fromEntries(Object.entries(maps).map(([id, map]) => [id, { features: map.features, kB: Math.round(map.bytes / 1024), gzipKB: Math.round(map.gzipBytes / 1024) }])));
}

await main();
