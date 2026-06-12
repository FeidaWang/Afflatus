export function createRadarDeck(canvas, { maxDpr = 2 } = {}) {
  const ctx = canvas.getContext('2d');
  const state = {
    phase: 0,
    glowUntil: 0,
    blips: [],
    contacts: new Map(),
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(maxDpr, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.max(1, Math.floor(rect.height * scale));
    return scale;
  }

  return { canvas, ctx, state, resize };
}
