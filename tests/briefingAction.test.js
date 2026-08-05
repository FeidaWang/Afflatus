import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRIEFING_ACTION, shouldAcknowledgeBriefing } from '../src/lib/briefingAction.js';

const arenaTech = readFileSync('src/pages/arenaTech.js', 'utf8');

describe('arena briefing action semantics', () => {
  it('acknowledges only an explicit enter action', () => {
    expect(shouldAcknowledgeBriefing(BRIEFING_ACTION.ENTER)).toBe(true);
    expect(shouldAcknowledgeBriefing(BRIEFING_ACTION.DISMISS)).toBe(false);
  });

  it('does not expose a redundant read-later action', () => {
    expect(BRIEFING_ACTION).not.toHaveProperty('READ_LATER');
  });

  it('keeps the technical-analysis empty state neutral when archived cards are read-only', () => {
    expect(arenaTech).toContain('Search a ticker above to load its latest available daily candles.');
    expect(arenaTech).toContain('在上方搜索代码，以加载最近可用的日K数据。');
    expect(arenaTech).not.toContain('Pick a recommended trade above');
  });
});
