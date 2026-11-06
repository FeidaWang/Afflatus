/* ============================================================
   Written source decisions. A source reaches the public page only when
   `enabled` and `publicRedistributionAllowed` are both true. Only civicAPI is,
   and only as `browserDirect`: the visitor's browser reads it, and this site
   never stores or re-serves it. ELECTION_FEED_BASE is still null, so nothing is
   read from a store. Evidence and dates: docs/elections/M5.md, M9.md.
   ============================================================ */
export const ELECTION_FEED_BASE = null;

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
    liveNotBefore: '2026-11-28T07:00:00Z',
    // Unknown until the zero files arrive on 10 November. While null, the collector refuses this source.
    expectedEventName: null,
    allowedHosts: [],
    feeds: [],
    blockedBy: 'Needs signed VEC terms, a token, and written confirmation that public display is allowed.',
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
