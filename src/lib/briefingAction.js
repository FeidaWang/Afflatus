export const BRIEFING_ACTION = Object.freeze({
  ENTER: 'enter',
  READ_LATER: 'read-later',
  DISMISS: 'dismiss',
});

export function shouldAcknowledgeBriefing(action) {
  return action === BRIEFING_ACTION.ENTER;
}
