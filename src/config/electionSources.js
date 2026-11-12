// Public VEC snapshots can only be read through the server-gated endpoint.
export const ELECTION_FEED_BASE = null; // Generic sources are off.
export const VEC_PUBLIC_FEED_BASE = '/elections-feed/';
export const VEC_POLLS_CLOSE = '2026-11-28T07:00:00Z';

export const ELECTION_SOURCES = Object.freeze([
  {
    id: 'vec-2026',
    name: 'VEC results data feed',
    eventId: 'vic-2026',
    url: 'https://www.vec.vic.gov.au/about-us/media/2026-results-data-feed',
    enabled: false,
    synthetic: false,
    publicRedistributionAllowed: false,
    storeRaw: false,
    pollSeconds: 300,
    // The Wednesday 25 November trial publishes fictitious data, so nothing earlier than polls closing is a result.
    liveNotBefore: VEC_POLLS_CLOSE,
    serverGated: true,
    // The operator pins the EMS event name and ID after inspecting VEC's zero ZIP.
    expectedEventName: null,
    feeds: [
      { key: 'assembly', office: 'assembly', category: 'LowerHouse', pattern: /^State2026mediafileverboselhv2_(\d{8})_(\d{6})\.zip$/i },
      { key: 'council', office: 'council', category: 'UpperHouse', pattern: /^State2026mediafileverboseuhv2_(\d{8})_(\d{6})\.zip$/i },
    ],
    blockedBy: 'Use the operator CLI with a verified VEC event identity.',
  },
  {
    // VEC's published sample files: fictitious results named "Test State Election 2026".
    id: 'vec-sample',
    name: 'VEC sample files (fictitious)',
    eventId: 'vic-2026',
    url: 'https://www.vec.vic.gov.au/about-us/media/2026-results-data-feed',
    enabled: false,
    synthetic: true,
    publicRedistributionAllowed: false,
    storeRaw: false,
    pollSeconds: 300,
    liveNotBefore: null,
    expectedEventName: 'Test State Election 2026',
    allowedHosts: [],
    feeds: [
      { key: 'assembly', office: 'assembly', category: 'LowerHouse', pattern: /mediafileverboselhv2_(\d{8})_(\d{6})\.zip$/ },
      { key: 'council', office: 'council', category: 'UpperHouse', pattern: /mediafileverboseuhv2_(\d{8})_(\d{6})\.zip$/ },
    ],
  },
  {
    id: 'civicapi',
    name: 'civicAPI',
    eventId: 'us-2026',
    url: 'https://www.civicapi.org/api-documentation',
    // Site owner's decision, 7 November 2026: use civicAPI as published. Its terms allow
    // commercial use with attribution and say nothing on caching, so it is read in the browser only.
    enabled: true,
    browserDirect: true,
    synthetic: false,
    publicRedistributionAllowed: true,
    storeRaw: false,
    pollSeconds: 60,
    raceIds: { house: 87524, senate: 87528 },
    liveNotBefore: null,
    expectedEventName: null,
    allowedHosts: [],
    feeds: [],
  },
]);

export const sourceById = (id) => ELECTION_SOURCES.find((source) => source.id === id) || null;
