import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';

export function createRadarDeck(canvas, { maxDpr = 2 } = {}) {
  const renderCoordinator = getRenderBudgetCoordinator();
  let renderPolicy = renderCoordinator.getPolicy({ cost: 'low', targetFps: 60 });
  let active = false;
  const ctx = canvas.getContext('2d');
  const state = {
    phase: 0,
    glowUntil: 0,
    blips: [],
    contacts: new Map(),
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = renderPolicy.computeDpr(rect.width, rect.height, { minDpr: 0.75, maxDpr });
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.max(1, Math.floor(rect.height * scale));
    return scale;
  }

  const renderSurface = renderCoordinator.register({
    id: 'home:radar-deck',
    element: canvas,
    cost: 'low',
    targetFps: 60,
    onResume() { active = true; },
    onPause() { active = false; },
    onResize: resize,
    onQualityChange(nextPolicy) { renderPolicy = nextPolicy; },
  });

  return {
    canvas,
    ctx,
    state,
    resize,
    get active() { return active; },
    destroy() { renderSurface.unregister(); },
  };
}
