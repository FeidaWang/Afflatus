/* ============================================================
   Chamber-inspired seat views: deterministic geometry and an SVG string.
   No DOM, no dependencies, no provider coupling. Every constant below is a
   design parameter, not a measurement of a real room, and a mark stands for
   an electoral seat, not a desk. US chambers are fans around a rostrum;
   Australian chambers are horseshoes with straight benches and a curve.
   A seat's place follows catalogue order, so it says nothing about party or
   side of the chamber, and a colour change never moves it.
   ============================================================ */
const { PI, asin, cos, sin, hypot } = Math;

// `cuts` are aisle positions: angle across the fan, then half-width in viewBox units.
const fan = (total, config) => ({ kind: 'fan', total, viewBox: [0, 0, 800, 470], centreY: 56, chair: { x: 345, y: 18, width: 110, height: 28 }, chairLabel: 'rostrum', ...config });
// `pitch` is the distance between neighbouring marks and between rows, so a chamber reads as an even mesh.
const horseshoe = (total, height, config) => ({ kind: 'horseshoe', total, viewBox: [0, 0, 640, height], top: 26, chair: { x: 266, y: 14, width: 108, height: 26 }, ...config });

const CHAMBERS = Object.freeze({
  'us-2026/house': fan(435, { rows: 12, inner: 142, outer: 376, spread: 0.1, aisle: 13, cuts: [[0.62, 6], [1.1, 6]], radius: 7.6 }),
  'us-2026/senate': fan(100, { rows: 5, inner: 168, outer: 366, spread: 0.13, aisle: 16, cuts: [[0.82, 9]], desk: { width: 26, height: 15 } }),
  'au-2028/house': horseshoe(150, 600, { rows: 4, inner: 181, pitch: 33, benchSeats: 8, gangway: 9, radius: 12, chairLabel: 'speaker' }),
  'au-2028/senate': horseshoe(76, 520, { rows: 3, inner: 168, pitch: 42, benchSeats: 5, gangway: 11, radius: 14.5, chairLabel: 'president' }),
  'vic-2026/assembly': horseshoe(88, 580, { rows: 3, inner: 189, pitch: 42, benchSeats: 6, gangway: 11, radius: 14.5, chairLabel: 'speaker' }),
  'vic-2026/council': horseshoe(40, 420, { rows: 2, inner: 176, pitch: 44, benchSeats: 3, gangway: 11, radius: 15, chairLabel: 'president' }),
  'nsw-2027/assembly': horseshoe(93, 580, { rows: 3, inner: 200, pitch: 40, benchSeats: 6, gangway: 10, radius: 14, chairLabel: 'speaker' }),
  'nsw-2027/council': horseshoe(42, 420, { rows: 2, inner: 176, pitch: 44, benchSeats: 3, gangway: 11, radius: 14.5, chairLabel: 'president' }),
});

const round = (value) => Number(value.toFixed(2));

/** Largest-remainder integer allocation, deterministic on ties. */
function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((weight) => (total * weight) / sum);
  const counts = shares.map(Math.floor);
  const order = shares.map((share, index) => ({ index, fraction: share - counts[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const remainder = total - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i += 1) counts[order[i].index] += 1;
  return counts;
}

// Left and right mirror exactly. An odd total can't mirror, so its one extra mark goes just right of centre.
function allocateMirrored(total, weights) {
  const middle = Math.floor(weights.length / 2);
  const odd = weights.length % 2 === 1;
  const half = weights.slice(0, middle + (odd ? 1 : 0)).map((weight, index) => (odd && index === middle ? weight / 2 : weight));
  const pairs = allocate(Math.floor(total / 2), half);
  const counts = weights.map((_, index) => {
    if (odd && index === middle) return pairs[middle] * 2;
    return pairs[Math.min(index, weights.length - 1 - index)];
  });
  counts[middle] += total % 2;
  return counts;
}

const sum = (values) => values.reduce((a, b) => a + b, 0);

// An angle 0..PI sweeps left to right below the rostrum, so aisles keep a constant width at every radius.
function fanRows(config) {
  const cx = config.viewBox[2] / 2;
  const cuts = [...config.cuts, [PI / 2, config.aisle], ...config.cuts.map(([at, half]) => [PI - at, half]).reverse()];
  const rows = Array.from({ length: config.rows }, (_, row) => {
    const radius = config.inner + (row * (config.outer - config.inner)) / (config.rows - 1);
    const edges = [config.spread, ...cuts.flatMap(([at, half]) => {
      const offset = asin(half / radius);
      return [at - offset, at + offset];
    }), PI - config.spread];
    const sections = [];
    for (let i = 0; i < edges.length; i += 2) sections.push([edges[i], edges[i + 1]]);
    return sections.map(([from, to]) => ({
      length: radius * (to - from),
      at: (share) => {
        const angle = from + share * (to - from);
        return { x: cx - radius * cos(angle), y: config.centreY + radius * sin(angle), rotation: 90 - (angle * 180) / PI };
      },
    }));
  });
  // Every row but the outermost holds an even count, so each can mirror.
  const perRow = allocate(Math.floor(config.total / 2), rows.map((row) => sum(row.map((section) => section.length)))).map((count) => count * 2);
  perRow[perRow.length - 1] += config.total % 2;
  return rows.map((row, index) => {
    const counts = allocateMirrored(perRow[index], row.map((section) => section.length));
    return row.map((section, i) => ({ ...section, count: counts[i] }));
  });
}

// One U per row: left bench downward, curve, right bench upward, with a gangway at each join.
// Benches hold the same count in every row, so they line up; the curve takes the rest.
function horseshoeRows(config) {
  const cx = config.viewBox[2] / 2;
  const benchLength = config.benchSeats * config.pitch;
  const benchEnd = config.top + benchLength;
  const curveY = benchEnd + config.gangway;
  const halves = Array.from({ length: config.rows }, (_, row) => config.inner + row * config.pitch);
  const curves = allocate(config.total - 2 * config.rows * config.benchSeats, halves);
  return halves.map((half, row) => {
    const inset = config.gangway / half;
    return [
      { count: config.benchSeats, at: (share) => ({ x: cx - half, y: config.top + share * benchLength, rotation: 0 }) },
      {
        count: curves[row],
        at: (share) => {
          const angle = inset + share * (PI - 2 * inset);
          return { x: cx - half * cos(angle), y: curveY + half * sin(angle), rotation: 90 - (angle * 180) / PI };
        },
      },
      { count: config.benchSeats, at: (share) => ({ x: cx + half, y: benchEnd - share * benchLength, rotation: 0 }) },
    ];
  });
}

/**
 * Display slots for one office, or null when it has no chamber view.
 * Slots run left to right across the room, so neighbouring ids stay neighbours.
 */
export function createChamberLayout(eventId, officeId) {
  const config = CHAMBERS[`${eventId}/${officeId}`];
  if (!config) return null;
  const rows = config.kind === 'fan' ? fanRows(config) : horseshoeRows(config);
  const radius = config.desk ? hypot(config.desk.width, config.desk.height) / 2 : config.radius;
  const slots = rows.flatMap((sections, row) => sections.flatMap((section, index) => Array.from({ length: section.count }, (_, i) => {
    const share = (i + 0.5) / section.count;
    const point = section.at(share);
    return { row, section: index, sweep: index + share, x: round(point.x), y: round(point.y), rotation: round(point.rotation), radius };
  }))).sort((a, b) => a.sweep - b.sweep || a.row - b.row);
  return { ...config, slots };
}

/** Binds one seatId to one slot. Input order is ignored, so the mapping cannot drift. */
export function bindSeatCatalogue(eventId, officeId, catalogue) {
  const layout = createChamberLayout(eventId, officeId);
  if (catalogue.length !== layout.total) throw new RangeError(`${eventId}/${officeId} needs exactly ${layout.total} seats`);
  const ids = new Set(catalogue.map((seat) => seat.seatId));
  if (ids.size !== catalogue.length) throw new Error(`Duplicate seatId in ${eventId}/${officeId}`);
  const ordered = [...catalogue].sort((a, b) => (a.seatId < b.seatId ? -1 : 1));
  return { ...layout, slots: layout.slots.map((slot, index) => ({ ...slot, seat: ordered[index] })) };
}

const PARTY_STATUSES = new Set(['leading', 'called', 'final']);

/**
 * The status a mark may show. Anything without evidence stays neutral: a party
 * status needs a known party, and "final" also needs a record or it is only a call.
 */
export function seatMark(seat, state, parties = []) {
  if (!seat.onBallot) return { status: 'off' };
  if (state?.status === 'unavailable') return { status: 'unavailable' };
  const party = parties.find((item) => item.id === state?.party);
  if (!party || !PARTY_STATUSES.has(state?.status)) return { status: 'neutral' };
  const stale = state.stale ? { stale: true } : {};
  if (state.status === 'final' && !state.record) return { status: 'called', party, ...stale };
  return { status: state.status, party, ...stale };
}

export function tallySeats(catalogue, states = {}, parties = []) {
  const tally = { total: catalogue.length, neutral: 0, off: 0, leading: 0, called: 0, final: 0, unavailable: 0 };
  for (const seat of catalogue) tally[seatMark(seat, states[seat.seatId], parties).status] += 1;
  return tally;
}

function markElement(layout, slot, mark, ariaLabel) {
  const { seat } = slot;
  const hatch = mark.status === 'leading' ? `;--seat-fill:url(#el-hatch-${mark.party.id})` : '';
  const style = mark.party ? ` style="--seat:${mark.party.color}${hatch}"` : '';
  const record = mark.status === 'final' ? ' data-record' : '';
  const shared = `class="el-seat is-${mark.status}${mark.stale ? ' is-stale' : ''}" data-seat="${seat.seatId}" tabindex="-1" role="button" aria-pressed="false" aria-label="${ariaLabel}"${record}${style}`;
  if (!layout.desk) return `<circle ${shared} cx="${slot.x}" cy="${slot.y}" r="${slot.radius}"/>`;
  const { width, height } = layout.desk;
  return `<rect ${shared} x="${round(slot.x - width / 2)}" y="${round(slot.y - height / 2)}" width="${width}" height="${height}" transform="rotate(${slot.rotation} ${slot.x} ${slot.y})"/>`;
}

function roomElements(layout, chairLabel) {
  const { chair, viewBox } = layout;
  const cx = viewBox[2] / 2;
  const label = `<text class="el-room-label" x="${cx}" y="${chair.y + chair.height / 2}" text-anchor="middle" dominant-baseline="central">${chairLabel}</text>`;
  const seatless = `<rect class="el-room-chair" x="${chair.x}" y="${chair.y}" width="${chair.width}" height="${chair.height}"/>${label}`;
  if (layout.kind === 'fan') {
    const well = layout.inner - 34;
    const start = [cx - well * cos(layout.spread), layout.centreY + well * sin(layout.spread)];
    const end = [cx + well * cos(layout.spread), start[1]];
    return `${seatless}<path class="el-room-detail" d="M${round(start[0])} ${round(start[1])}A${well} ${well} 0 0 0 ${round(end[0])} ${round(end[1])}"/>`;
  }
  return `${seatless}<rect class="el-room-detail" x="${cx - 24}" y="${chair.y + chair.height + 24}" width="48" height="${round(layout.benchSeats * layout.pitch * 0.6)}"/>`;
}

// A hatch sized to the mark, so a lead reads the same in every chamber.
function hatchPatterns(layout, marks) {
  const parties = new Map(marks.filter((mark) => mark.status === 'leading').map((mark) => [mark.party.id, mark.party]));
  if (!parties.size) return '';
  const size = round(layout.slots[0].radius * 0.8);
  return `<defs>${[...parties.values()].map((party) => (
    `<pattern id="el-hatch-${party.id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${size}" stroke="${party.color}" stroke-width="${round(size / 2)}"/></pattern>`
  )).join('')}</defs>`;
}

// A party letter on each coloured mark. The 435-seat fan's marks are too small to carry one.
const TAG_MIN_RADIUS = 12;

function partyTags(layout, marks, tag) {
  if (!tag || layout.slots[0].radius < TAG_MIN_RADIUS) return '';
  const size = round(layout.desk ? layout.desk.height * 0.8 : layout.slots[0].radius * 1.05);
  const tags = layout.slots.map((slot, index) => {
    const mark = marks[index];
    return mark.party ? `<text class="is-${mark.status}" x="${slot.x}" y="${slot.y}" dy=".36em">${tag(mark.party)}</text>` : '';
  }).join('');
  return `<g class="el-seat-tags" aria-hidden="true" font-size="${size}" text-anchor="middle">${tags}</g>`;
}

/** The chart as a string. `states` maps seatId to verified state; the page passes none. `tag(party)` gives the letter for a party mark. */
export function chamberSvg(bound, { states = {}, parties = [], label, ariaLabel, chairLabel, tag = null }) {
  const marks = bound.slots.map((slot) => seatMark(slot.seat, states[slot.seat.seatId], parties));
  const elements = bound.slots.map((slot, index) => markElement(bound, slot, marks[index], label(slot.seat, marks[index].status)));
  return `<svg class="el-chamber-svg" viewBox="${bound.viewBox.join(' ')}" role="group" aria-label="${ariaLabel}" data-roving data-chamber="${bound.kind}">${hatchPatterns(bound, marks)}<g aria-hidden="true">${roomElements(bound, chairLabel)}</g>${elements.join('')}${partyTags(bound, marks, tag)}</svg>`;
}
