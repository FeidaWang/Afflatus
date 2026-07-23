import { describe, it, expect } from 'vitest';
import { synthesizeR1, synthesizeR2, synthesizeR3, synthesizeR4, synthesizeR5 } from '../src/lib/deepSynthesis.js';

const shape = (r) => {
  expect(['reinforced', 'crosscurrent']).toContain(r.verdict);
  expect(r.zh).toBeTruthy(); expect(r.en).toBeTruthy();
  expect(r.receipts.length).toBeGreaterThanOrEqual(2);
  for (const rc of r.receipts) { expect(rc.zh).toBeTruthy(); expect(rc.en).toBeTruthy(); }
};

describe('synthesizeR1 (身强身弱 × 命宫score)', () => {
  it('both strong -> reinforced', () => { const r = synthesizeR1({ strength: 'strong' }, 75); shape(r); expect(r.verdict).toBe('reinforced'); });
  it('both weak -> reinforced (agreement, not just "both strong")', () => { const r = synthesizeR1({ strength: 'weak' }, 20); shape(r); expect(r.verdict).toBe('reinforced'); });
  it('strong bazi + broken 命宫 -> crosscurrent', () => { const r = synthesizeR1({ strength: 'strong' }, 20); shape(r); expect(r.verdict).toBe('crosscurrent'); });
  it('weak bazi + strong 命宫 -> crosscurrent (inverse case)', () => { const r = synthesizeR1({ strength: 'weak' }, 80); shape(r); expect(r.verdict).toBe('crosscurrent'); });
  it('never renders a verdict-shaped directive string', () => {
    for (const r of [synthesizeR1({ strength: 'strong' }, 20), synthesizeR1({ strength: 'weak' }, 80)]) {
      expect(r.en).not.toMatch(/\bmust\b|prohibited|DO NOT/i);
    }
  });
});

describe('synthesizeR2 (用神 element × 命宫主星 wuXing)', () => {
  const ziPing = { favorable: [{ el: 0, zh: '木', en: 'Wood' }, { el: 4, zh: '水', en: 'Water' }] };
  it('matching element -> reinforced (amplifier)', () => { const r = synthesizeR2(ziPing, ['Wood']); shape(r); expect(r.verdict).toBe('reinforced'); });
  it('non-matching element -> crosscurrent (damper)', () => { const r = synthesizeR2(ziPing, ['Fire']); shape(r); expect(r.verdict).toBe('crosscurrent'); });
  it('empty 命宫 (借对宫) -> reinforced, no crash', () => { const r = synthesizeR2(ziPing, []); shape(r); expect(r.verdict).toBe('reinforced'); });
});

describe('synthesizeR3 (大运 element relation × 大限 score)', () => {
  it('both favorable -> reinforced', () => { const r = synthesizeR3(0, 4, 70); shape(r); expect(r.verdict).toBe('reinforced'); }); // water feeds wood
  it('both adverse -> reinforced (agreement on tight)', () => { const r = synthesizeR3(0, 3, 20); shape(r); expect(r.verdict).toBe('reinforced'); }); // metal presses wood
  it('disagreement -> crosscurrent', () => { const r = synthesizeR3(0, 3, 80); shape(r); expect(r.verdict).toBe('crosscurrent'); });
});

describe('synthesizeR4 (犯太岁 × 流年宫)', () => {
  it('both hit -> reinforced (strongest caution)', () => { const r = synthesizeR4(['chong'], 20, true); shape(r); expect(r.verdict).toBe('reinforced'); });
  it('only taisui hit -> crosscurrent (moderate)', () => { const r = synthesizeR4(['xing'], 70, false); shape(r); expect(r.verdict).toBe('crosscurrent'); });
  it('only 流年宫 hit -> crosscurrent (moderate)', () => { const r = synthesizeR4([], 25, false); shape(r); expect(r.verdict).toBe('crosscurrent'); });
  it('neither -> reinforced (流年宫 score speaks plainly)', () => { const r = synthesizeR4([], 65, false); shape(r); expect(r.verdict).toBe('reinforced'); });
  it('值太岁 alone (mild) does not count as a taisui hit', () => { const r = synthesizeR4(['zhi'], 65, false); shape(r); expect(r.verdict).toBe('reinforced'); });
});

describe('synthesizeR5 (daily relation × today\'s branch-palace score)', () => {
  it('agree favorable -> reinforced', () => { const r = synthesizeR5('feeds', 70); shape(r); expect(r.verdict).toBe('reinforced'); });
  it('agree adverse -> reinforced', () => { const r = synthesizeR5('presses', 20); shape(r); expect(r.verdict).toBe('reinforced'); });
  it('disagree -> crosscurrent', () => { const r = synthesizeR5('feeds', 20); shape(r); expect(r.verdict).toBe('crosscurrent'); });
});
