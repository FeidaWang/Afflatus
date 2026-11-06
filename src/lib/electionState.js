/* ============================================================
   The one view state for the Elections page:
   { event, office, raceId, geographyView, geographyArea, displayMode, snapshotId }.
   `event: null` is the hub. URL values are validated against the rule packs,
   catalogues and verified geography. displayMode and snapshotId cannot be set
   from a URL, so a link can never claim live results or open a chosen snapshot.
   While a feed is on screen, the page tracks refresh and replay itself.
   ============================================================ */
import { eventById, officeById } from './electionRules.js';
import { seatCatalogue } from './electionCatalogue.js';
import { geographyAreas, geographyFor } from './electionGeography.js';

const FIXED = Object.freeze({ displayMode: 'preview', snapshotId: null });
const HUB = Object.freeze({ event: null, office: null, raceId: null, geographyView: 'schematic', geographyArea: null, ...FIXED });

const isRace = (eventId, officeId, raceId) => (
  seatCatalogue(eventId, officeId).some((seat) => seat.seatId === raceId)
);

export function withEvent(eventId, officeId = null, raceId = null, { view = null, area = null } = {}) {
  const event = eventById(eventId);
  if (!event) return HUB;
  const office = officeById(event, officeId) || event.offices[0];
  const hasMap = Boolean(geographyFor(event.id, office.id));
  const geographyView = hasMap && view !== 'schematic' ? 'map' : 'schematic';
  const known = geographyView === 'map' && geographyAreas(event.id, office.id).some((item) => item.id === area);
  return {
    ...HUB,
    event: event.id,
    office: office.id,
    raceId: isRace(event.id, office.id, raceId) ? raceId : null,
    geographyView,
    geographyArea: known ? area : null,
  };
}

const geography = (state) => ({ view: state.geographyView, area: state.geographyArea });

// Changing office always drops the selected race and the zoom: both belong to one office.
export const withOffice = (state, officeId) => withEvent(state.event, officeId);
export const withRace = (state, raceId) => withEvent(state.event, state.office, raceId, geography(state));
export const withGeography = (state, change) => withEvent(state.event, state.office, state.raceId, { ...geography(state), ...change });

export function parseState(search) {
  const params = new URLSearchParams(search);
  return withEvent(params.get('event'), params.get('office'), params.get('race'), {
    view: params.get('geo') === 'blocks' ? 'schematic' : null,
    area: params.get('area'),
  });
}

export function serializeState(state) {
  if (!state.event) return '';
  const params = new URLSearchParams({ event: state.event, office: state.office });
  if (state.raceId) params.set('race', state.raceId);
  if (state.geographyArea) params.set('area', state.geographyArea);
  if (state.geographyView === 'schematic' && geographyFor(state.event, state.office)) params.set('geo', 'blocks');
  return `?${params}`;
}
