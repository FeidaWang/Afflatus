import { NAV_GROUPS, NAV_ROUTES } from '../config/navRoutes.generated.js';

// Top-level entries shared by header and footer. A group sits where its first route falls in nav order.
export const navEntries = () => {
  const destinations = NAV_ROUTES.filter(route => route.path !== '/');
  return destinations
    .filter((route, index) => !route.group || destinations.findIndex(other => other.group === route.group) === index)
    .map(route => route.group
      ? { id: route.group, group: true, label: NAV_GROUPS[route.group], routes: destinations.filter(other => other.group === route.group) }
      : { id: route.id, group: false, label: { en: route.en, zh: route.zh }, routes: [route] });
};
