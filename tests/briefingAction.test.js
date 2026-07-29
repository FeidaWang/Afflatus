import { describe, expect, it } from 'vitest';
import { BRIEFING_ACTION, shouldAcknowledgeBriefing } from '../src/lib/briefingAction.js';

describe('arena briefing action semantics', () => {
  it('acknowledges only an explicit enter action', () => {
    expect(shouldAcknowledgeBriefing(BRIEFING_ACTION.ENTER)).toBe(true);
    expect(shouldAcknowledgeBriefing(BRIEFING_ACTION.READ_LATER)).toBe(false);
    expect(shouldAcknowledgeBriefing(BRIEFING_ACTION.DISMISS)).toBe(false);
  });
});
