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

export function createFilmStretch(stage, frame) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let current = 0, target = 0, raf = 0, last = 0;
  const draw = now => {
    const elapsed = Math.min(64, last ? now - last : 16);
    last = now;
    current += (target - current) * (1 - Math.exp(-elapsed / 105));
    if (Math.abs(target - current) < .05) current = target;
    frame.style.setProperty('--film-inset', `${current.toFixed(2)}px`);
    raf = current === target ? 0 : requestAnimationFrame(draw);
  };
  const schedule = () => { if (!raf) { last = 0; raf = requestAnimationFrame(draw); } };
  const move = event => {
    if (reduced.matches || !fine.matches || event.pointerType === 'touch') return;
    const rect = stage.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    target = Math.abs(x * 2 - 1) * Math.min(36, rect.width * .028);
    schedule();
  };
  const reset = () => { target = 0; schedule(); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; current = target = 0; frame.style.setProperty('--film-inset', '0px'); };
  const preference = () => { if (reduced.matches || !fine.matches) stop(); };
  const visibility = () => { if (document.hidden) stop(); };
  stage.addEventListener('pointermove', move, { passive: true });
  stage.addEventListener('pointerleave', reset);
  reduced.addEventListener('change', preference); fine.addEventListener('change', preference);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    stop(); stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerleave', reset);
    reduced.removeEventListener('change', preference); fine.removeEventListener('change', preference);
    document.removeEventListener('visibilitychange', visibility);
  };
}
