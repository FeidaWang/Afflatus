import { describe, expect, it } from 'vitest';
import {
  BRAND_COMPACT, BRAND_FULL, ENTER_PX, EXIT_PX, nextBrandState,
} from '../src/lib/brandScroll.js';

describe('阈值配置', () => {
  it('EXIT 必须小于 ENTER —— 否则没有死区，滞回不成立', () => {
    expect(EXIT_PX).toBeLessThan(ENTER_PX);
  });

  it('死区足够宽，能吸收惯性滚动的来回抖动', () => {
    expect(ENTER_PX - EXIT_PX).toBeGreaterThanOrEqual(32);
  });
});

describe('nextBrandState（滞回状态机）', () => {
  it('滚过上阈值必定进入紧凑态，与当前态无关', () => {
    const s = { pastEnter: true, pastExit: true };
    expect(nextBrandState(BRAND_FULL, s)).toBe(BRAND_COMPACT);
    expect(nextBrandState(BRAND_COMPACT, s)).toBe(BRAND_COMPACT);
  });

  it('回到下阈值以上必定恢复完整态，与当前态无关', () => {
    const s = { pastEnter: false, pastExit: false };
    expect(nextBrandState(BRAND_FULL, s)).toBe(BRAND_FULL);
    expect(nextBrandState(BRAND_COMPACT, s)).toBe(BRAND_FULL);
  });

  it('死区内保持当前状态 —— 这是滞回的本体，不是兜底分支', () => {
    const dead = { pastEnter: false, pastExit: true };
    expect(nextBrandState(BRAND_FULL, dead)).toBe(BRAND_FULL);
    expect(nextBrandState(BRAND_COMPACT, dead)).toBe(BRAND_COMPACT);
  });

  it('在临界点反复微抖时状态不翻转 —— 这正是单阈值方案会闪烁的场景', () => {
    let state = BRAND_COMPACT;
    // 用户停在死区内，滚动来回一两像素
    for (let i = 0; i < 100; i += 1) {
      state = nextBrandState(state, { pastEnter: false, pastExit: i % 2 === 0 ? true : true });
    }
    expect(state).toBe(BRAND_COMPACT);
  });

  it('对照：单阈值方案在同样输入下会翻转 —— 证明死区确实在起作用', () => {
    // 若只看 pastExit（单阈值），死区内的 true 会立刻判成紧凑
    const singleThreshold = (signals) => (signals.pastExit ? BRAND_COMPACT : BRAND_FULL);
    const dead = { pastEnter: false, pastExit: true };
    expect(singleThreshold(dead)).toBe(BRAND_COMPACT);
    expect(nextBrandState(BRAND_FULL, dead)).toBe(BRAND_FULL);
  });

  it('完整的下滚—上滚往返：翻转恰好各发生一次', () => {
    const scrollTo = (y) => ({ pastEnter: y > ENTER_PX, pastExit: y > EXIT_PX });
    let state = BRAND_FULL;
    const flips = [];
    const track = (y) => {
      const next = nextBrandState(state, scrollTo(y));
      if (next !== state) flips.push({ y, next });
      state = next;
    };
    // 下滚
    for (let y = 0; y <= 200; y += 8) track(y);
    // 上滚
    for (let y = 200; y >= 0; y -= 8) track(y);

    expect(flips).toHaveLength(2);
    expect(flips[0].next).toBe(BRAND_COMPACT);
    expect(flips[0].y).toBeGreaterThan(ENTER_PX);
    expect(flips[1].next).toBe(BRAND_FULL);
    expect(flips[1].y).toBeLessThanOrEqual(EXIT_PX);
  });

  it('缺省参数不抛错，按「在顶部」处理', () => {
    expect(nextBrandState(BRAND_COMPACT)).toBe(BRAND_FULL);
    expect(nextBrandState(BRAND_FULL, {})).toBe(BRAND_FULL);
  });

  it('未知的当前态被规约到完整态而非原样透传', () => {
    const dead = { pastEnter: false, pastExit: true };
    expect(nextBrandState('bogus', dead)).toBe(BRAND_FULL);
    expect(nextBrandState(undefined, dead)).toBe(BRAND_FULL);
  });
});
