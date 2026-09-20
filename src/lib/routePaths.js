// Shared by the manifest, emitted navigation and both browser renderers.
export function normalizeRoutePath(pathname) {
  const raw = String(pathname || '/').split(/[?#]/, 1)[0];
  const withoutLocale = raw.replace(/^\/(?:en|zh)(?=\/|$)/, '') || '/';
  return withoutLocale.replace(/index\.html$/, '') || '/';
}

export function resolveRouteHref(routeOrPath, locale, routes) {
  const path = typeof routeOrPath === 'string' ? routeOrPath : routeOrPath?.path || '/';
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const base = normalizeRoutePath(path);
  const suffix = path.slice(path.search(/[?#]/) < 0 ? path.length : path.search(/[?#]/));
  const route = typeof routeOrPath === 'string' ? routes.find(item => normalizeRoutePath(item.path) === base) : routeOrPath;
  if (!locale) return `${base}${suffix}`;
  const requested = locale === 'zh' ? 'zh' : 'en';
  const published = route?.publishedLocales || ['en', 'zh'];
  const language = published.includes(requested) ? requested : published.includes(route?.defaultLocale) ? route.defaultLocale : published[0];
  return `${base === '/' ? `/${language}/` : `/${language}${base}`}${suffix}`;
}
