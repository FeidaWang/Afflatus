import { NAV_ROUTES } from '../config/navRoutes.generated.js';
import { resolveRouteHref } from './routePaths.js';
export const navigationHref = (path, locale) => resolveRouteHref(path, locale, NAV_ROUTES);
