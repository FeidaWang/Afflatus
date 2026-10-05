// Keep browser/media controls at the film's intended playback speed.
export function lockFilmPlaybackRate(video) {
  const restore = () => {
    if (video.defaultPlaybackRate !== 1) video.defaultPlaybackRate = 1;
    if (video.playbackRate !== 1) video.playbackRate = 1;
  };
  video.addEventListener('ratechange', restore);
  restore();
  return () => video.removeEventListener('ratechange', restore);
}

// Visibility suspends playback; it never overwrites a viewer's explicit pause.
export function createFilmPlayback(video, { autoplay = true, onBlocked = () => {}, Observer = globalThis.IntersectionObserver } = {}) {
  const doc = video.ownerDocument;
  let wanted = autoplay, visible = true, floating = false, suspended = false, destroyed = false, request = 0;
  const sync = () => {
    const current = ++request;
    if (destroyed || !wanted || (!visible && !floating) || doc.hidden || suspended) { video.pause(); return; }
    Promise.resolve(video.play()).catch(error => {
      if (!destroyed && current === request && error.name !== 'AbortError') onBlocked();
    });
  };
  const observer = Observer ? new Observer(entries => {
    visible = entries.some(entry => entry.target === video && entry.isIntersecting);
    sync();
  }, { threshold: 0 }) : null;
  observer?.observe(video);
  const hide = () => { ++request; video.pause(); };
  doc.addEventListener('visibilitychange', sync);
  doc.defaultView?.addEventListener('pagehide', hide);
  doc.defaultView?.addEventListener('pageshow', sync);
  sync();
  return {
    play() { wanted = true; sync(); },
    pause() { wanted = false; sync(); },
    setFloating(value) { floating = value; sync(); },
    suspend(value) { suspended = value; sync(); },
    destroy() {
      destroyed = true; ++request; observer?.disconnect();
      doc.removeEventListener('visibilitychange', sync);
      doc.defaultView?.removeEventListener('pagehide', hide);
      doc.defaultView?.removeEventListener('pageshow', sync);
      video.pause();
    },
  };
}

// Move the same player rather than loading a second video in the floating window.
export function createFilmDrag(element, { position = null, onPosition = () => {}, padding = 16 } = {}) {
  const win = element.ownerDocument.defaultView;
  let point = position, drag = null, moved = Boolean(position);
  const place = next => {
    const rect = element.getBoundingClientRect();
    const maxX = Math.max(0, win.innerWidth - rect.width);
    const maxY = Math.max(0, win.innerHeight - rect.height);
    point = {
      x: Math.max(Math.min(padding, maxX), Math.min(Math.max(0, maxX - padding), next.x)),
      y: Math.max(Math.min(padding, maxY), Math.min(Math.max(0, maxY - padding), next.y)),
    };
    element.style.left = `${point.x}px`; element.style.top = `${point.y}px`;
    element.style.right = 'auto'; element.style.bottom = 'auto';
    onPosition({ ...point });
  };
  const dock = () => {
    const rect = element.getBoundingClientRect();
    place({ x: win.innerWidth - rect.width - padding, y: win.innerHeight - rect.height - padding });
  };
  const finish = event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (element.hasPointerCapture?.(drag.id)) element.releasePointerCapture(drag.id);
    drag = null; element.classList.remove('is-dragging');
  };
  const down = event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('button:not(.film-drag-handle), input, a')) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: { ...point } };
    element.setPointerCapture(event.pointerId); element.classList.add('is-dragging');
  };
  const move = event => {
    if (!drag || event.pointerId !== drag.id) return;
    moved = true;
    place({ x: drag.start.x + event.clientX - drag.x, y: drag.start.y + event.clientY - drag.y });
  };
  const keys = event => {
    if (!event.target.closest('.film-drag-handle')) return;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta) return;
    event.preventDefault(); moved = true;
    const step = event.shiftKey ? 36 : 12;
    place({ x: point.x + delta[0] * step, y: point.y + delta[1] * step });
  };
  const resize = () => {
    if (element.matches?.(':fullscreen')) return;
    if (moved) place(point); else dock();
  };
  if (point) place(point); else dock();
  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', finish);
  element.addEventListener('pointercancel', finish);
  element.addEventListener('lostpointercapture', finish);
  element.addEventListener('keydown', keys);
  win.addEventListener('resize', resize);
  const observer = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
  observer?.observe(element);
  return { destroy() {
    if (drag && element.hasPointerCapture?.(drag.id)) element.releasePointerCapture(drag.id);
    drag = null; element.classList.remove('is-dragging');
    element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', finish); element.removeEventListener('pointercancel', finish);
    element.removeEventListener('lostpointercapture', finish); element.removeEventListener('keydown', keys);
    win.removeEventListener('resize', resize);
    observer?.disconnect();
    for (const property of ['left', 'top', 'right', 'bottom']) element.style.removeProperty(property);
  } };
}

// Expand the gutters in normal document flow; never pin or stretch the film vertically.
export function createFilmScroll(shell) {
  const doc = shell.ownerDocument, win = doc.defaultView;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const rail = doc.querySelector('.premiere-intro');
  shell.setAttribute('data-scroll-ready', '');
  let raf = 0, startInset = 0, startTop = 0, endTop = 0;
  const draw = () => {
    raf = 0;
    const rect = shell.getBoundingClientRect();
    const progress = reduced.matches ? 0 : Math.max(0, Math.min(1, (startTop - rect.top) / (startTop - endTop)));
    const eased = progress * progress * (3 - 2 * progress);
    const inset = startInset * (1 - eased);
    shell.style.setProperty('--film-expansion', eased);
    shell.style.setProperty('--film-inset', `${inset}px`);
    shell.style.setProperty('--film-radius', `${12 * (1 - eased)}px`);
    // Reserve the film's largest natural height so growing it cannot push the
    // following text away from a viewer who is scrolling toward that text.
    // The same slot remains in the document during mini/native fullscreen.
    const slotWidth = reduced.matches ? shell.clientWidth - 2 * startInset : shell.clientWidth;
    shell.style.setProperty('--film-slot-height', `${slotWidth * 9 / 16}px`);
  };
  const schedule = () => { if (!raf) raf = win.requestAnimationFrame(draw); };
  const measure = () => {
    const style = win.getComputedStyle(rail);
    const startWidth = rail.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    startInset = Math.max(0, (shell.clientWidth - startWidth) / 2);
    const documentTop = shell.getBoundingClientRect().top + win.scrollY;
    endTop = (doc.querySelector('#afflatus-header')?.clientHeight || 68) + 16;
    startTop = Math.max(endTop + 1, Math.min(win.innerHeight * .45, documentTop));
    schedule();
  };
  const observer = win.ResizeObserver ? new win.ResizeObserver(measure) : null;
  observer?.observe(rail);
  win.addEventListener('scroll', schedule, { passive: true });
  win.addEventListener('resize', measure, { passive: true });
  win.addEventListener('pageshow', measure);
  reduced.addEventListener('change', measure);
  measure();
  return () => {
    win.cancelAnimationFrame(raf); observer?.disconnect();
    win.removeEventListener('scroll', schedule); win.removeEventListener('resize', measure);
    win.removeEventListener('pageshow', measure); reduced.removeEventListener('change', measure);
    // Retain the slot geometry while the player is floating; returning to the
    // page creates a fresh controller at the current scroll position.
  };
}
