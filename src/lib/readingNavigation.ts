// Enhance the existing links only. Native navigation owns hash, history and focus.
const navs = [...document.querySelectorAll<HTMLElement>('[data-reading-nav]')];
const links = navs.flatMap(nav => [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]);
const targets = [...new Set(links.map(link => document.getElementById(link.hash.slice(1))).filter((target): target is HTMLElement => !!target))];

if (targets.length && 'ResizeObserver' in window) {
  const header = document.querySelector<HTMLElement>('.site-header--follow');
  let observer: IntersectionObserver | undefined;
  let readingLine = 160;
  let trackingLine = 350;
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  let pendingAnchor = navigation?.type === 'back_forward' ? undefined : targets.find(target => `#${target.id}` === location.hash);
  let current: HTMLElement | null | undefined = null;

  function update() {
    const passed = targets.filter(target => target.getBoundingClientRect().top <= trackingLine + 2);
    const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    const firstVisible = targets.find(target => target.getBoundingClientRect().top < innerHeight * 0.65);
    const active = atEnd ? targets[targets.length - 1] : passed[passed.length - 1] || firstVisible;
    if (active === current) return;
    current = active;
    links.forEach(link => {
      const selected = !!active && link.hash === `#${active.id}`;
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
      link.classList.toggle('active', selected);
      // Move only the horizontal strip; never scroll the document or move focus.
      const nav = link.closest<HTMLElement>('[data-reading-nav]');
      if (!selected || !nav || !nav.clientWidth || nav.scrollWidth <= nav.clientWidth) return;
      if (nav.contains(document.activeElement) && document.activeElement !== link) return;
      const box = link.getBoundingClientRect();
      const bounds = nav.getBoundingClientRect();
      if (box.left < bounds.left) nav.scrollLeft -= bounds.left - box.left;
      else if (box.right > bounds.right) nav.scrollLeft += box.right - bounds.right;
    });
  }

  function measure() {
    const style = header && getComputedStyle(header);
    const top = style ? Math.max(0, parseFloat(style.top) || 0) : 0;
    const headerBottom = header ? Math.max(top + header.getBoundingClientRect().height, style?.position === 'fixed' ? header.getBoundingClientRect().bottom : 0) + 8 : 96;
    document.documentElement.style.setProperty('--reading-header', `${Math.ceil(headerBottom)}px`);
    const strip = navs.find(nav => getComputedStyle(nav).position === 'sticky' && nav.clientHeight);
    readingLine = Math.ceil(headerBottom + (strip?.getBoundingClientRect().height || 0) + 16);
    document.documentElement.style.setProperty('--reading-offset', `${readingLine}px`);
    trackingLine = Math.max(readingLine + 24, innerHeight * 0.35);
    observer?.disconnect();
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(update, { rootMargin: `-${trackingLine}px 0px -${Math.max(0, innerHeight - trackingLine - 1)}px 0px`, threshold: 0 });
      // Sections keep delivery working between headings, including reverse scroll.
      new Set(targets.flatMap(target => [target, target.closest('section') || target])).forEach(target => observer?.observe(target));
    }
    // Fonts and async content can invalidate a just-requested anchor.
    // Keep that entry aligned only until the next reader action. History
    // traversal/BFCache keeps the browser's exact saved position instead.
    pendingAnchor?.scrollIntoView({ block: 'start', behavior: 'instant' });
    current = null;
    update();
  }

  function releaseAnchor() {
    pendingAnchor = undefined;
    resize.unobserve(document.body);
  }
  function onNavigationClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
    const target = link && targets.find(target => `#${target.id}` === link.hash);
    if (!target) return;
    pendingAnchor = target;
    resize.observe(document.body);
  }
  function onPopState() {
    // History restoration precedes hashchange. Release the previous click's
    // layout correction before a ResizeObserver can overwrite the saved scroll.
    if (pendingAnchor && `#${pendingAnchor.id}` !== location.hash) releaseAnchor();
  }
  function onHashChange() {
    if (pendingAnchor && `#${pendingAnchor.id}` === location.hash) measure();
    else { releaseAnchor(); update(); }
  }
  function onPageShow(event: PageTransitionEvent) {
    if (event.persisted) releaseAnchor();
    measure();
  }

  const resize = new ResizeObserver(measure);
  if (header) resize.observe(header);
  navs.forEach(nav => resize.observe(nav));
  navs.forEach(nav => nav.addEventListener('click', onNavigationClick));
  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('resize', measure);
  if (pendingAnchor) {
    resize.observe(document.body);
  }
  for (const type of ['wheel', 'pointerdown', 'touchstart', 'keydown']) window.addEventListener(type, releaseAnchor, { capture: true, passive: true });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    observer?.disconnect();
    resize.disconnect();
    navs.forEach(nav => nav.removeEventListener('click', onNavigationClick));
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('hashchange', onHashChange);
    for (const type of ['wheel', 'pointerdown', 'touchstart', 'keydown']) window.removeEventListener(type, releaseAnchor, true);
    releaseAnchor();
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('resize', measure);
  });
  measure();
}
