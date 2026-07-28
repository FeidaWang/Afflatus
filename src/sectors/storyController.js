import { initScrollReveal } from '../lib/scrollRevealView.js';

export function initSectorsStoryController() {
  const events = ['pointerdown', 'keydown', 'scroll'];
  let queued = false;
  let revealHandle = null;

  const onIntent = () => {
    if (queued) return;
    queued = true;
    events.forEach((event) => removeEventListener(event, onIntent, true));
    setTimeout(() => {
      revealHandle = initScrollReveal();
    }, 0);
  };

  events.forEach((event) => addEventListener(event, onIntent, {
    capture: true,
    passive: true,
    once: true,
  }));

  return () => {
    events.forEach((event) => removeEventListener(event, onIntent, true));
    revealHandle?.destroy?.();
  };
}
