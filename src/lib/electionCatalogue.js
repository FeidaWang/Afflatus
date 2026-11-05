/* ============================================================
   Seat catalogues: one stable seatId per display slot, independent of any
   provider. US House ids derive from the current apportionment. Victorian and
   NSW Assembly names come from the official boundary files. Other Australian
   electorates stay placeholders until an official list is verified, because
   names written from memory would be fabrication. No results live here.
   ============================================================ */
import { NSW_DISTRICTS, VIC_DISTRICTS, VIC_REGIONS } from '../config/electionElectorates.generated.js';


const US_HOUSE_APPORTIONMENT = Object.freeze({
  AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14,
  HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8,
  MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12,
  NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7,
  SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1,
});

// Class II regular contests, plus the Florida and Ohio specials.
const US_SENATE_2026_REGULAR = new Set(['AL', 'AK', 'AR', 'CO', 'DE', 'GA', 'ID', 'IL', 'IA', 'KS', 'KY', 'LA', 'ME', 'MA', 'MI', 'MN', 'MS', 'MT', 'NE', 'NH', 'NJ', 'NM', 'NC', 'OK', 'OR', 'RI', 'SC', 'SD', 'TN', 'TX', 'VA', 'WV', 'WY']);
const US_SENATE_2026_SPECIAL = new Set(['FL', 'OH']);

const pad = (value, width = 2) => String(value).padStart(width, '0');

function usHouse() {
  return Object.entries(US_HOUSE_APPORTIONMENT).flatMap(([state, seats]) => (
    Array.from({ length: seats }, (_, index) => {
      const seatId = seats === 1 ? `${state}-AL` : `${state}-${pad(index + 1)}`;
      return { seatId, label: { en: seatId, zh: seatId }, group: state, onBallot: true, placeholder: false };
    })
  ));
}

// The term each 2026 Senate contest fills. A special fills the rest of a Class III term.
const US_SENATE_2026_CONTESTS = Object.freeze({
  regular: { senateClass: 2, term: '2027-2033' },
  special: { senateClass: 3, term: 'to-2029-01-03' },
});

// S1 and S2 are display ids, not Senate classes. S1 is the seat on the 2026 ballot where one exists.
function usSenate2026() {
  return Object.keys(US_HOUSE_APPORTIONMENT).flatMap((state) => {
    const contest = US_SENATE_2026_REGULAR.has(state) ? 'regular' : US_SENATE_2026_SPECIAL.has(state) ? 'special' : null;
    return [1, 2].map((number) => {
      const seatId = `${state}-S${number}`;
      const onBallot = number === 1 && contest !== null;
      return {
        seatId,
        label: { en: `${state} Senate ${number}`, zh: `${state} 参议院 ${number}` },
        group: state,
        feature: state,
        onBallot,
        contest: onBallot ? contest : null,
        senateClass: onBallot ? US_SENATE_2026_CONTESTS[contest].senateClass : null,
        term: onBallot ? US_SENATE_2026_CONTESTS[contest].term : null,
        placeholder: false,
      };
    });
  });
}

function placeholders(total) {
  const width = String(total).length;
  return Array.from({ length: total }, (_, index) => {
    const number = pad(index + 1, Math.max(width, 2));
    return { seatId: `seat-${number}`, label: { en: `Seat ${number}`, zh: `席位 ${number}` }, group: null, onBallot: true, placeholder: true };
  });
}

const regionName = (regionId) => VIC_REGIONS.find((region) => region.id === regionId).name;

const vicAssembly = () => VIC_DISTRICTS.map(({ id, name, regionId }) => (
  { seatId: id, label: { en: name, zh: name }, group: regionName(regionId), area: regionId, onBallot: true, placeholder: false }
));

// A region elects five members together. The numbers only count them; no seat 1 exists in law.
const vicCouncil = () => VIC_REGIONS.flatMap(({ id, name }) => Array.from({ length: 5 }, (_, index) => ({
  seatId: `${id}-${index + 1}`,
  label: { en: `${name} ${index + 1} of 5`, zh: `${name} 5 席之 ${index + 1}` },
  group: name,
  area: id,
  feature: id,
  onBallot: true,
  placeholder: false,
})));

const nswAssembly = () => NSW_DISTRICTS.map(({ id, name }) => (
  { seatId: id, label: { en: name, zh: name }, group: null, onBallot: true, placeholder: false }
));

const BUILDERS = Object.freeze({
  'us-2026/house': usHouse,
  'us-2026/senate': usSenate2026,
  'vic-2026/assembly': vicAssembly,
  'vic-2026/council': vicCouncil,
  'nsw-2027/assembly': nswAssembly,
  'nsw-2027/council': () => placeholders(42),
  'au-2028/house': () => placeholders(150),
  'au-2028/senate': () => placeholders(76),
});

const cache = new Map();

/** The ordered seat catalogue for one event and office. Empty when an office has no seat view yet. */
export function seatCatalogue(eventId, officeId) {
  const key = `${eventId}/${officeId}`;
  if (!cache.has(key)) cache.set(key, Object.freeze((BUILDERS[key] || (() => []))()));
  return cache.get(key);
}

/** Stable sort for the race table. Equal keys keep catalogue order. */
export function sortSeats(seats, key, direction, statusOf) {
  const value = {
    seat: (seat) => seats.indexOf(seat),
    group: (seat) => seat.group || '',
    status: (seat) => statusOf(seat),
  }[key];
  const sign = direction === 'desc' ? -1 : 1;
  return [...seats].sort((a, b) => {
    const [left, right] = [value(a), value(b)];
    if (left === right) return seats.indexOf(a) - seats.indexOf(b);
    return (left < right ? -1 : 1) * sign;
  });
}
