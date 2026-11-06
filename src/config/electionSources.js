/* ============================================================
   Written source decisions. A source reaches the public page only when
   `enabled` and `publicRedistributionAllowed` are both true. Neither is true for
   any real source today, and ELECTION_FEED_BASE is null, so production fetches
   nothing. Evidence and dates: docs/elections/M5.md.
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
    enabled: false,
    synthetic: false,
    publicRedistributionAllowed: false,
    storeRaw: false,
    pollSeconds: null,
    liveNotBefore: null,
    expectedEventName: null,
    allowedHosts: [],
    feeds: [],
    blockedBy: 'Caching and redistribution are not addressed, no race carries its own time, and only North Carolina has been cross-checked, once. See docs/elections/M1.md.',
  },
]);

export const sourceById = (id) => ELECTION_SOURCES.find((source) => source.id === id) || null;
