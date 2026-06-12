import { safeText } from '../utils/dom.js';

export function createSoftClockRenderer(el) {
  let lastClockText = '';
  return function renderSoftClock(text) {
    if (!el) return;
    if (el.dataset.clockText === text) return;
    const previous = lastClockText || text;
    el.dataset.clockText = text;
    el.innerHTML = [...text].map((ch, i) => {
      const changed = previous[i] !== ch && /\d/.test(ch);
      return `<span class="clock-unit${changed ? ' changed' : ''}">${safeText(ch)}</span>`;
    }).join('');
    lastClockText = text;
  };
}
