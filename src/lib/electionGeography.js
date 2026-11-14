/* ============================================================
   Which verified boundaries each office may draw, and how a map feature binds
   to seats. A feature is real geography at one level: a district holds one
   seat, while a state or region may hold several. Offices listed in GAPS have
   no verified boundaries and never get a shape. Provenance lives in
   public/assets/elections/maps/<version>/manifest.json.
   ============================================================ */
import { seatMark } from './chamberLayout.js';
import { seatCatalogue } from './electionCatalogue.js';

export const GEOGRAPHY_VERSION = '2026-11-04';

const NO_BASELINE = { en: 'Not computed: no verified baseline is loaded.', zh: '未计算：尚未加载经核验的基准。' };

const MAPS = Object.freeze({
  'us-2026/house': {
    map: 'us-house',
    level: 'district',
    areaLabel: { en: 'State', zh: '州' },
    short: { en: 'District boundaries · 120th Congress · 2026 cycle', zh: '选区边界 · 第 120 届国会 · 2026 选举' },
    credit: { en: 'U.S. Census Bureau · TIGER/Line 2026', zh: '美国人口普查局 · TIGER/Line 2026' },
    source: { en: 'U.S. Census Bureau TIGER/Line 2026, 120th Congress, in effect for the 2026 cycle. Missouri uses its 2022–24 plan, per the Census Bureau. Simplified for display.', zh: '美国人口普查局 TIGER/Line 2026，第 120 届国会，适用于 2026 选举。密苏里按该局说明沿用 2022–24 年方案。已为显示简化。' },
    swing: { en: 'Not computed: nine states were redrawn for 2026 and no verified crosswalk is loaded.', zh: '未计算：九个州在 2026 年重划了选区，且没有经核验的换算表。' },
    insets: true,
  },
  'us-2026/senate': {
    map: 'us-senate',
    level: 'state',
    areaLabel: { en: 'State', zh: '州' },
    short: { en: 'State outlines · Census 2025', zh: '州界 · 普查局 2025' },
    credit: { en: 'U.S. Census Bureau · Cartographic Boundary 2025', zh: '美国人口普查局 · 2025 制图边界' },
    source: { en: 'U.S. Census Bureau Cartographic Boundary 2025, states. Filled states have a 2026 contest; outlined states do not. A state shows its contest, never both seats as one result.', zh: '美国人口普查局 2025 制图边界（州）。实心的州有 2026 年比赛，空心的州没有。每州只显示当届比赛，不把两席合成一个结果。' },
    swing: NO_BASELINE,
    insets: true,
  },
  'vic-2026/assembly': {
    map: 'vic-assembly',
    level: 'district',
    areaLabel: { en: 'Region', zh: '大区' },
    short: { en: 'District boundaries · 2021 redivision', zh: '选区边界 · 2021 年重划' },
    credit: { en: 'Vicmap Admin · © State Government of Victoria, CC BY 4.0', zh: 'Vicmap Admin · © State Government of Victoria，CC BY 4.0' },
    source: { en: 'Vicmap Admin, State Assembly 2022, from the 2021 redivision. © State Government of Victoria, CC BY 4.0. Names as published. Simplified for display.', zh: 'Vicmap Admin 州下院 2022，来自 2021 年重划。© State Government of Victoria，CC BY 4.0。名称按官方数据。已为显示简化。' },
    swing: { en: '2022 baseline loaded; swing awaits 2026 count.', zh: '已加载 2022 年官方基准；摆幅待 2026 开票后计算。' },
  },
  'vic-2026/council': {
    map: 'vic-council',
    level: 'region',
    areaLabel: { en: 'Region', zh: '大区' },
    short: { en: 'Region boundaries · 2021 redivision', zh: '大区边界 · 2021 年重划' },
    credit: { en: 'Vicmap Admin · © State Government of Victoria, CC BY 4.0', zh: 'Vicmap Admin · © State Government of Victoria，CC BY 4.0' },
    source: { en: 'Vicmap Admin, State Council 2022, from the 2021 redivision. © State Government of Victoria, CC BY 4.0. Each region elects five members, so a region never shows one winner.', zh: 'Vicmap Admin 州上院 2022，来自 2021 年重划。© State Government of Victoria，CC BY 4.0。每个大区选出五席，因此大区不会显示单一赢家。' },
    swing: { en: '2022 baseline loaded; swing awaits 2026 count.', zh: '已加载 2022 年官方基准；摆幅待 2026 开票后计算。' },
  },
  'nsw-2027/assembly': {
    map: 'nsw-assembly',
    level: 'district',
    areaLabel: { en: 'Area', zh: '范围' },
    short: { en: 'District boundaries · NSW Spatial Services', zh: '选区边界 · 新州 Spatial Services' },
    credit: { en: 'NSW Administrative Boundaries · © State of New South Wales, CC BY', zh: '新州行政边界 · © State of New South Wales，CC BY' },
    source: { en: 'NSW Administrative Boundaries, State Electoral District. © State of New South Wales (Spatial Services), CC BY. Lord Howe Island, part of Port Macquarie, is not drawn. Simplified for display.', zh: '新州行政边界（州选区）。© State of New South Wales (Spatial Services)，CC BY。属于 Port Macquarie 的豪勋爵岛未画出。已为显示简化。' },
    swing: { en: '2023 baseline loaded; swing awaits 2027 count.', zh: '已加载 2023 年官方基准；摆幅待 2027 开票后计算。' },
    presets: [{ id: 'sydney', label: { en: 'Greater Sydney', zh: '大悉尼' } }],
  },
});

const GAPS = Object.freeze({
  'au-2028/house': { en: 'No map: boundaries for the next federal election are not settled, and the AEC has no current national file until the Queensland redistribution finishes. Seat names wait for the same list.', zh: '没有地图：下次联邦选举的边界尚未确定，昆州重划完成前 AEC 没有现行的全国数据。席位名称也要等这份名单。' },
  'au-2028/senate': { en: 'No map: senators represent whole states and territories, and this view has no verified seat list yet.', zh: '没有地图：参议员代表整个州或领地，这里还没有经核验的席位名单。' },
  'nsw-2027/council': { en: 'No map: the Legislative Council is elected state-wide, so it has no district boundaries.', zh: '没有地图：立法院由全州一起选出，没有选区边界。' },
});

export const geographyFor = (eventId, officeId) => MAPS[`${eventId}/${officeId}`] || null;
export const geographyGap = (eventId, officeId) => GAPS[`${eventId}/${officeId}`] || null;
export const mapUrl = (mapId) => `/assets/elections/maps/${GEOGRAPHY_VERSION}/${mapId}.json`;

const featureIdOf = (seat) => seat.feature || seat.seatId;
const areaIdOf = (seat) => seat.area || seat.group;

/** Zoom areas for an office: its states or regions, then any named viewport. */
export function geographyAreas(eventId, officeId) {
  const entry = geographyFor(eventId, officeId);
  if (!entry) return [];
  const areas = new Map();
  for (const seat of seatCatalogue(eventId, officeId)) {
    const id = areaIdOf(seat);
    if (id && !areas.has(id)) areas.set(id, { id, label: { en: seat.group, zh: seat.group } });
  }
  return [...areas.values(), ...(entry.presets || [])];
}

/** Counts for one area. Coverage only: an area never gets a winner. */
export const areaMembers = (seats, areaId) => seats.filter((seat) => areaIdOf(seat) === areaId);

export function areaSummary(seats, areaId) {
  const members = areaMembers(seats, areaId);
  return { seats: members.length, contests: members.filter((seat) => seat.onBallot).length };
}

/**
 * Joins map features to the catalogue. Unknown features are not drawn, and
 * seats without a feature come back in `missing` so the page can state the gap.
 */
export function bindFeatures(features, seats) {
  const byFeature = new Map();
  for (const seat of seats) {
    const id = featureIdOf(seat);
    if (!byFeature.has(id)) byFeature.set(id, []);
    byFeature.get(id).push(seat);
  }
  const seen = new Set();
  const duplicates = [];
  const unknown = [];
  const bound = [];
  for (const feature of features) {
    if (seen.has(feature.id)) {
      duplicates.push(feature.id);
    } else if (!byFeature.has(feature.id)) {
      unknown.push(feature.id);
    } else {
      seen.add(feature.id);
      bound.push({ feature, seats: byFeature.get(feature.id) });
    }
  }
  const missing = seats.filter((seat) => !seen.has(featureIdOf(seat)));
  return { bound, missing, duplicates, unknown };
}

/** The seat a feature selects: its contest where it has one, or its first seat. */
export const primarySeat = (members) => members.find((seat) => seat.onBallot) || members[0];

/**
 * What a feature may show. Only a feature with one contest can carry that
 * contest's status: a five-member region has no single result to colour.
 */
export function featureMark(members, states, parties) {
  const contests = members.filter((seat) => seat.onBallot);
  if (!contests.length) return { status: 'off' };
  if (contests.length > 1) return { status: 'neutral' };
  return seatMark(contests[0], states[contests[0].seatId], parties);
}

function featureElement({ feature, seats: members }, mark, label) {
  const primary = primarySeat(members);
  const hatch = mark.status === 'leading' ? `;--seat-fill:url(#el-map-hatch-${mark.party.id})` : '';
  const style = mark.party ? ` style="--seat:${mark.party.color}${hatch}"` : '';
  const record = mark.status === 'final' ? ' data-record' : '';
  return `<path class="el-feature is-${mark.status}${mark.stale ? ' is-stale' : ''}" d="${feature.d}" data-feature="${feature.id}" data-seat="${primary.seatId}" data-seats="${members.map((seat) => seat.seatId).join(' ')}" tabindex="-1" role="button" aria-pressed="false" aria-label="${label(primary, members)}"${record}${style}/>`;
}

function hatchPatterns(marks, viewBox) {
  const parties = new Map(marks.filter((mark) => mark.status === 'leading').map((mark) => [mark.party.id, mark.party]));
  if (!parties.size) return '';
  const size = Math.round(viewBox[2] / 160);
  return `<defs>${[...parties.values()].map((party) => (
    `<pattern id="el-map-hatch-${party.id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${size}" stroke="${party.color}" stroke-width="${Math.round(size / 2)}"/></pattern>`
  )).join('')}</defs>`;
}

/** The map as a string. `states` maps seatId to verified state; the page passes none. */
export function mapSvg(map, binding, { states = {}, parties = [], label, ariaLabel, insetLabel }) {
  const marks = binding.bound.map(({ seats: members }) => featureMark(members, states, parties));
  const features = binding.bound.map((item, index) => featureElement(item, marks[index], label));
  const overlay = map.overlay ? `<path class="el-map-overlay" d="${map.overlay}" aria-hidden="true"/>` : '';
  const insets = (map.insets || []).map(({ state, b }) => (
    `<text class="el-map-inset" x="${b[0]}" y="${b[1]}" dy="-.5em">${insetLabel(state)}</text>`
  )).join('');
  return `<svg class="el-map-svg" viewBox="${map.viewBox.join(' ')}" role="group" aria-label="${ariaLabel}" data-roving data-map="${map.id}">${hatchPatterns(marks, map.viewBox)}${features.join('')}${overlay}<g aria-hidden="true">${insets}<path class="el-map-selected-halo" d="" hidden/><path class="el-map-selected-ring" d="" hidden/><circle class="el-map-locator" r="0" hidden/></g></svg>`;
}

const unionBox = (boxes) => [
  Math.min(...boxes.map((box) => box[0])), Math.min(...boxes.map((box) => box[1])),
  Math.max(...boxes.map((box) => box[2])), Math.max(...boxes.map((box) => box[3])),
];

/** The bounding box of an area, or null when none of its features are drawn. */
export function areaBox(map, binding, areaId) {
  if (map.areas?.[areaId]) return map.areas[areaId];
  const boxes = binding.bound.filter(({ seats: members }) => members.some((seat) => areaIdOf(seat) === areaId)).map(({ feature }) => feature.b);
  return boxes.length ? unionBox(boxes) : null;
}

export function seatFeature(binding, seatId) {
  return binding.bound.find(({ seats: members }) => members.some((seat) => seat.seatId === seatId))?.feature || null;
}

/** A viewBox around `box` with the map's own aspect, padded, and never smaller than `minShare` of the map. */
export function zoomViewBox(box, viewBox, { pad = 0.08, minShare = 0.04 } = {}) {
  const aspect = viewBox[2] / viewBox[3];
  const width = Math.max((box[2] - box[0]) * (1 + 2 * pad), (box[3] - box[1]) * (1 + 2 * pad) * aspect, viewBox[2] * minShare);
  const height = width / aspect;
  const scale = Math.min(1, viewBox[2] / width);
  const [w, h] = [width * scale, height * scale];
  const clamp = (value, min, span, size) => Math.max(min, Math.min(value, min + span - size));
  const x = clamp((box[0] + box[2] - w) / 2, viewBox[0], viewBox[2], w);
  const y = clamp((box[1] + box[3] - h) / 2, viewBox[1], viewBox[3], h);
  return [x, y, w, h].map(Math.round);
}

const normalise = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Resolves a search to one seat. An exact label or id wins, then a unique
 * prefix. Prefixes that all land on one feature pick its contest, so "FL"
 * reaches the Florida race and "Bass" reaches Bass.
 */
export function findSeat(seats, query) {
  const wanted = normalise(query);
  if (!wanted) return null;
  const keys = (seat) => [seat.seatId, seat.label.en, seat.label.zh].map(normalise);
  const exact = seats.find((seat) => keys(seat).includes(wanted));
  if (exact) return exact;
  const matches = seats.filter((seat) => keys(seat).some((key) => key.startsWith(wanted)));
  if (!matches.length) return null;
  const feature = featureIdOf(matches[0]);
  return matches.every((seat) => featureIdOf(seat) === feature) ? primarySeat(matches) : null;
}
