/**
 * M03 primary navigation model.
 *
 * This is deliberately separate from the route manifest: the manifest owns
 * every published route, while this small model owns the five concepts a new
 * visitor needs to understand first. Existing pages remain reachable through
 * their category landing route and retain their direct legacy URLs.
 */
export const PRIMARY_NAVIGATION = Object.freeze([
  {
    id: 'systems',
    path: '/capital/',
    en: 'Systems',
    zh: '系统',
    routeIds: ['main', 'portfolio', 'capital', 'capital-record'],
  },
  {
    id: 'intelligence',
    path: '/intelligence/',
    en: 'Intelligence',
    zh: '情报',
    routeIds: ['signal', 'intelligence', 'solar-atlas'],
    legacyGroups: ['markets'],
  },
  {
    id: 'field-notes',
    path: '/field-notes/',
    en: 'Field Notes',
    zh: '现场笔记',
    routeIds: ['course', 'serial', 'field-notes'],
    legacyGroups: ['writing'],
  },
  {
    id: 'experiments',
    path: '/experiments/',
    en: 'Experiments',
    zh: '实验',
    routeIds: ['arena', 'sectors', 'stats', 'horoscope', 'cityview', 'experiments', 'flight-experiment'],
    legacyGroups: ['lab'],
  },
  {
    id: 'about',
    path: '/#about',
    en: 'About',
    zh: '关于',
    routeIds: [],
  },
]);

export const COMMAND_ENTRY = Object.freeze({
  path: '/command/',
  en: 'Enter Command',
  zh: '进入指挥舱',
});

/* M03 verification inventory. `route` means the source URL remains a live
   compatibility entry; `redirect` means Vercel owns the permanent hand-off. */
export const LEGACY_ROUTE_COMPATIBILITY = Object.freeze([
  { source: '/index.html', type: 'route', target: '/' },
  { source: '/portfolio.html', type: 'route', target: '/portfolio.html' },
  { source: '/arena.html', type: 'route', target: '/arena.html' },
  { source: '/sectors.html', type: 'route', target: '/sectors.html' },
  { source: '/signal.html', type: 'route', target: '/signal.html' },
  { source: '/stats.html', type: 'route', target: '/stats.html' },
  { source: '/horoscope.html', type: 'route', target: '/horoscope.html' },
  { source: '/serial.html', type: 'route', target: '/serial.html' },
  { source: '/course.html', type: 'route', target: '/course.html' },
  { source: '/cityview.html', type: 'route', target: '/cityview.html' },
  { source: '/league.html', type: 'redirect', target: '/stats.html' },
  { source: '/games.html', type: 'redirect', target: '/stats.html' },
  { source: '/novels', type: 'redirect', target: '/serial.html' },
  { source: '/zh/novels', type: 'redirect', target: '/zh/serial.html' },
  { source: '/en/serial.html', type: 'redirect', target: '/zh/serial.html' },
  { source: '/markets', type: 'redirect', target: '/intelligence/' },
  { source: '/markets/', type: 'redirect', target: '/intelligence/' },
  { source: '/lab', type: 'redirect', target: '/experiments/' },
  { source: '/lab/', type: 'redirect', target: '/experiments/' },
  { source: '/labs', type: 'redirect', target: '/experiments/' },
  { source: '/labs/', type: 'redirect', target: '/experiments/' },
  { source: '/writing', type: 'redirect', target: '/field-notes/' },
  { source: '/writing/', type: 'redirect', target: '/field-notes/' },
]);

export function primaryNavigationForRoute(routeId) {
  return PRIMARY_NAVIGATION.find((item) => item.routeIds.includes(routeId)) || null;
}
