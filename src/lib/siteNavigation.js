import { NAV_ROUTES } from '../config/navRoutes.generated.js';
import { resolveRouteHref } from './routePaths.js';
export const navigationHref = (path, locale) => resolveRouteHref(path, locale, NAV_ROUTES);
// The one en/zh label per destination, shared by header, footer and homepage.
export const navigationLabel = (path) => {
  const route = NAV_ROUTES.find(route => route.path === path);
  if (!route) throw new Error(`Unknown navigation route: ${path}`);
  return { en: route.en, zh: route.zh };
};
