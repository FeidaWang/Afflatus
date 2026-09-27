// One controller and one scroll timeline for all public templates.
const header = document.querySelector('[data-afflatus-header]');
if (header && !header.dataset.enhanced) {
  const portfolio = document.body.classList.contains('portfolio-story');
  const compact = matchMedia('(max-width: 979px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const menu = header.querySelector('.af-header-menu');
  const nav = header.querySelector('.af-header-nav');
  const groups = [...header.querySelectorAll('.af-header-group > button')];
  const panel = button => document.getElementById(button.getAttribute('aria-controls'));
  let openGroup = null;
  let closeTimer;
  let frame = 0;
  let lastProgress = -1;
  let lastScrollY = scrollY;
  let expanding = false;
  let upwardDistance = 0;
  let upwardStartedAt = 0;
  let keyboard = false;
  const smooth = (a, b, p) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };
  function drawBrand() {
    frame = 0;
    const y = scrollY;
    const delta = y - lastScrollY;
    if (portfolio) {
      const now = performance.now();
      if (y <= 8) {
        header.dataset.scrollVisibility = 'visible';
        upwardDistance = 0;
        upwardStartedAt = 0;
      } else if (delta > 2 && y > 72) {
        if (header.dataset.scrollVisibility !== 'hidden') closeAll();
        header.dataset.scrollVisibility = 'hidden';
        upwardDistance = 0;
        upwardStartedAt = 0;
      } else if (delta < -2) {
        if (!upwardStartedAt || now - upwardStartedAt > 240) {
          upwardStartedAt = now;
          upwardDistance = 0;
        }
        upwardDistance += -delta;
        if (upwardDistance >= 28) header.dataset.scrollVisibility = 'visible';
      }
    }
    if (delta !== 0) expanding = delta < 0;
    lastScrollY = y;
    // DESIGN defaults; exact reference timeline remains unmeasured.
    const raw = Math.max(0, Math.min(1, (y - 8) / 88));
    const p = reduced.matches ? Number(y >= 96) : expanding ? smooth(.75, .95, raw) : raw;
    if (p === lastProgress) return;
    lastProgress = p;
    header.style.setProperty('--af-collapse', p);
    // Reveal the full word only once the link is wide enough to contain its S.
    const compactOpacity = smooth(.1, .18, p);
    header.style.setProperty('--af-suffix-opacity', 1 - compactOpacity);
    header.style.setProperty('--af-compact-opacity', compactOpacity);
  }
  function scheduleBrand() { if (!frame) frame = requestAnimationFrame(drawBrand); }
  function setOpen(button, open) {
    button.setAttribute('aria-expanded', String(open));
    panel(button).hidden = !open;
    if (button !== menu) {
      button.parentElement.dataset.open = String(open);
      if (open) openGroup = button;
      else if (openGroup === button) openGroup = null;
    }
  }
  function closeGroups() {
    clearTimeout(closeTimer);
    if (openGroup) setOpen(openGroup, false);
  }
  function open(button) { closeGroups(); setOpen(button, true); }
  function closeAll() {
    closeGroups();
    if (compact.matches) setOpen(menu, false);
  }
  function resize() {
    const active = document.activeElement;
    closeAll();
    nav.hidden = compact.matches;
    menu.setAttribute('aria-expanded', 'false');
    if (compact.matches && nav.contains(active)) menu.focus();
    else if (!compact.matches && active === menu) header.querySelector('[data-header-path="/"]').focus();
    scheduleBrand();
  }
  for (const button of groups) {
    const group = button.parentElement;
    let suppressed = false;
    setOpen(button, false);
    group.addEventListener('pointerenter', event => {
      clearTimeout(closeTimer);
      if (!compact.matches && fine.matches && event.pointerType !== 'touch' && !suppressed) open(button);
    });
    group.addEventListener('pointerleave', () => {
      suppressed = false;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (openGroup === button && !(keyboard && group.contains(document.activeElement))) closeGroups();
      }, 120);
    });
    button.addEventListener('click', () => {
      const wasOpen = openGroup === button;
      closeGroups();
      suppressed = wasOpen;
      if (!wasOpen) open(button);
    });
    group.addEventListener('focusin', () => {
      clearTimeout(closeTimer);
      group.dataset.focus = String(keyboard);
    });
    group.addEventListener('focusout', event => {
      if (!group.contains(event.relatedTarget)) {
        group.dataset.focus = 'false';
        if (openGroup === button) closeGroups();
      }
    });
  }
  menu.addEventListener('click', () => {
    const next = menu.getAttribute('aria-expanded') !== 'true';
    closeGroups();
    setOpen(menu, next);
  });
  header.addEventListener('click', event => { if (event.target.closest('a')) closeAll(); });
  document.addEventListener('keydown', event => {
    keyboard = true;
    if (event.key !== 'Escape') return;
    if (openGroup) {
      event.preventDefault();
      const trigger = openGroup;
      closeGroups();
      trigger.focus();
    } else if (compact.matches && menu.getAttribute('aria-expanded') === 'true') {
      event.preventDefault(); closeAll(); menu.focus();
    }
  });
  header.addEventListener('focusout', event => { if (!header.contains(event.relatedTarget)) closeAll(); });
  document.addEventListener('pointerdown', event => {
    keyboard = false;
    groups.forEach(button => { button.parentElement.dataset.focus = 'false'; });
    if (!header.contains(event.target)) closeAll();
  });
  compact.addEventListener('change', resize);
  reduced.addEventListener('change', scheduleBrand);
  addEventListener('scroll', scheduleBrand, { passive: true });
  addEventListener('resize', scheduleBrand, { passive: true });
  addEventListener('pageshow', drawBrand);
  drawBrand();
  resize();
  header.dataset.enhanced = 'true';
}
