export const BRIEFING_ACTION = Object.freeze({
  COMPLETE: 'complete',
});

export function shouldAcknowledgeBriefing(action) {
  return action === BRIEFING_ACTION.COMPLETE;
}
