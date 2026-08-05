export const BRIEFING_ACTION = Object.freeze({
  ENTER: 'enter',
  DISMISS: 'dismiss',
});

export function shouldAcknowledgeBriefing(action) {
  return action === BRIEFING_ACTION.ENTER;
}
