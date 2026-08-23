export const AFFLATUS_SCENE_SIGNAL_EVENT = 'afflatus:scene-signal';

export function createSceneSignal(signal, detail = {}) {
  return Object.freeze({
    signal,
    phase: 'intent',
    ...detail,
  });
}
export function emitSceneSignal(target, signal, detail = {}) {
  if (!target?.dispatchEvent || typeof CustomEvent !== 'function') return null;

  const event = new CustomEvent(AFFLATUS_SCENE_SIGNAL_EVENT, {
    bubbles: true,
    cancelable: false,
    detail: createSceneSignal(signal, detail),
  });
  target.dispatchEvent(event);
  return event;
}
