import { describe, expect, it } from 'vitest';
import { BRIEFING_ACTION, shouldAcknowledgeBriefing } from '../src/lib/briefingAction.js';

describe('arena briefing action semantics', () => {
  it('acknowledges only an explicit enter action', () => {
    expect(shouldAcknowledgeBriefing(BRIEFING_ACTION.ENTER)).toBe(true);
    expect(shouldAcknowledgeBriefing(BRIEFING_ACTION.DISMISS)).toBe(false);
  });

  it('does not expose a redundant read-later action', () => {
    expect(BRIEFING_ACTION).not.toHaveProperty('READ_LATER');
  });
});
