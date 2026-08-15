const { routes: configuredRoutes } = require('./src/config/lighthouseRoutes.generated.json');
const baseline = require('./lighthouse-baseline.json');

const requestedRouteIds = new Set(
  String(process.env.LIGHTHOUSE_ROUTE_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const routes = requestedRouteIds.size
  ? configuredRoutes.filter((route) => requestedRouteIds.has(route.id))
  : configuredRoutes;
const unknownRouteIds = [...requestedRouteIds].filter(
  (id) => !configuredRoutes.some((route) => route.id === id),
);
if (unknownRouteIds.length) {
  throw new Error(`Unknown Lighthouse route id(s): ${unknownRouteIds.join(', ')}`);
}

const regressionAllowance = baseline.regressionAllowance;
const byId = new Map(baseline.routes.map((route) => [route.id, route]));
const median = { aggregationMethod: 'median' };

function maxBudget(value, minimum = 0, precision = 1) {
  return Math.max(
    minimum,
    Math.ceil(value * (1 + regressionAllowance) * precision) / precision,
  );
}

function minScore(value) {
  return Math.max(0, Math.floor((value - 0.03) * 100) / 100);
}

function matchingUrlPattern(path) {
  if (path === '/') return '^https?://[^/]+/$';
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^https?://[^/]+${escaped}$`;
}

function assertionsFor(route) {
  const assertions = {
    'categories:performance': route.performanceScore == null
      ? 'off'
      : ['warn', { minScore: minScore(route.performanceScore), ...median }],
    'cumulative-layout-shift': [
      'error',
      {
        maxNumericValue: maxBudget(route.clsBudgetBase ?? route.cls, 0.01, 1000),
        ...median,
      },
    ],
    'speed-index': [
      'error',
      { maxNumericValue: maxBudget(route.speedIndexMs), ...median },
    ],
    'resource-summary:script:size': [
      'error',
      { maxNumericValue: maxBudget(route.scriptBytes), ...median },
    ],
    'resource-summary:total:size': [
      'warn',
      { maxNumericValue: maxBudget(route.totalBytes), ...median },
    ],
  };

  if (route.lcpMs == null) {
    assertions['first-contentful-paint'] = [
      'error',
      { maxNumericValue: maxBudget(route.fcpMs), ...median },
    ];
    assertions['largest-contentful-paint'] = [
      'warn',
      { maxNumericValue: baseline.fieldBudgets.LCP, ...median },
    ];
  } else {
    assertions['largest-contentful-paint'] = [
      'error',
      { maxNumericValue: maxBudget(route.lcpMs), ...median },
    ];
    assertions['total-blocking-time'] = [
      'error',
      { maxNumericValue: maxBudget(route.tbtMs, 50), ...median },
    ];
  }

  return assertions;
}

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 3,
      url: routes.map((route) => `http://localhost${route.path}`),
      settings: {
        onlyCategories: ['performance'],
        blockedUrlPatterns: [
          '*googletagmanager.com*',
          '*google-analytics.com*',
        ],
        chromeFlags: '--headless --no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      includePassedAssertions: false,
      assertMatrix: routes.map((route) => {
        const routeBaseline = byId.get(route.id);
        if (!routeBaseline) throw new Error(`Missing Lighthouse baseline for ${route.id}`);
        return {
          matchingUrlPattern: matchingUrlPattern(route.path),
          assertions: assertionsFor(routeBaseline),
        };
      }),
    },
  },
};
