const KEYBOARD_THRESHOLD = 80;

export function computeKeyboardInset(layoutHeight, visualHeight, offsetTop = 0) {
  const layout = Number(layoutHeight);
  const visual = Number(visualHeight);
  const offset = Number(offsetTop);
  if (![layout, visual, offset].every(Number.isFinite)) return 0;
  return Math.max(0, Math.round(layout - visual - Math.max(0, offset)));
}

export function mountViewportRuntime({
  win = globalThis.window,
  root = globalThis.document?.documentElement,
} = {}) {
  if (!win || !root) return () => {};
  const visualViewport = win.visualViewport;
  let frame = 0;
  let destroyed = false;

  const update = () => {
    frame = 0;
    if (destroyed) return;
    const layoutHeight = Math.max(root.clientHeight || 0, win.innerHeight || 0);
    const height = visualViewport?.height || win.innerHeight || layoutHeight;
    const offsetTop = visualViewport?.offsetTop || 0;
    const keyboardInset = computeKeyboardInset(layoutHeight, height, offsetTop);
    root.style.setProperty('--visual-viewport-height', `${Math.round(height)}px`);
    root.style.setProperty('--visual-viewport-offset-top', `${Math.round(offsetTop)}px`);
    root.style.setProperty('--visual-viewport-center', `${Math.round(offsetTop + height / 2)}px`);
    root.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
    root.dataset.keyboardOpen = keyboardInset >= KEYBOARD_THRESHOLD ? 'true' : 'false';
  };

  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(update);
  };

  visualViewport?.addEventListener('resize', schedule, { passive: true });
  visualViewport?.addEventListener('scroll', schedule, { passive: true });
  win.addEventListener('resize', schedule, { passive: true });
  win.addEventListener('orientationchange', schedule, { passive: true });
  schedule();

  return () => {
    destroyed = true;
    if (frame) win.cancelAnimationFrame(frame);
    visualViewport?.removeEventListener('resize', schedule);
    visualViewport?.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
    win.removeEventListener('orientationchange', schedule);
    delete root.dataset.keyboardOpen;
    root.style.removeProperty('--visual-viewport-height');
    root.style.removeProperty('--visual-viewport-offset-top');
    root.style.removeProperty('--visual-viewport-center');
    root.style.removeProperty('--keyboard-inset');
  };
}
