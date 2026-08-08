import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRIEFING_ACTION, shouldAcknowledgeBriefing } from '../src/lib/briefingAction.js';

const arenaTech = readFileSync('src/pages/arenaTech.js', 'utf8');
const arenaPage = readFileSync('src/pages/arena.js', 'utf8');

describe('arena briefing action semantics', () => {
  it('uses one completion action for every way out of the briefing', () => {
    expect(shouldAcknowledgeBriefing(BRIEFING_ACTION.COMPLETE)).toBe(true);
    expect(Object.keys(BRIEFING_ACTION)).toEqual(['COMPLETE']);
  });

  it('does not expose a redundant read-later action', () => {
    expect(BRIEFING_ACTION).not.toHaveProperty('READ_LATER');
    expect(arenaPage).not.toContain('id="bfClose"');
    expect(arenaPage).toContain('CLOSE BRIEFING · ENTER ARENA ▶');
    expect(arenaPage).toContain('关闭简报 · 进入竞技场 ▶');
    expect(arenaPage).toContain('Fable · 5.6 Sol Ultra research');
    expect(arenaPage).toContain('Fable · 5.6 Sol Ultra 研判');
    expect(arenaPage).toContain("open: ['Regular Session', '常规交易时段']");
    expect(arenaPage).toContain("T('US MARKET OPENS IN', '距离美股开盘')");
  });

  it('keeps the technical-analysis empty state neutral when archived cards are read-only', () => {
    expect(arenaTech).toContain('Search a ticker above to load its latest available daily candles.');
    expect(arenaTech).toContain('在上方搜索代码，以加载最近可用的日K数据。');
    expect(arenaTech).not.toContain('Pick a recommended trade above');
  });
});
