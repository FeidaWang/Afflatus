import { describe, it, expect } from 'vitest';
import { createStarfieldGeometry, dampRotation, clampRotation, starfieldBudget } from '../src/scene/starfieldModel.js';
describe('orbital starfield model', () => {
  it('keeps deterministic finite geometry and all three layers within reduced draw ranges', () => {
    const a = createStarfieldGeometry(), b = createStarfieldGeometry();
    expect(a.positions).toEqual(b.positions);
    expect(a.positions).toHaveLength(12000);
    expect([...a.positions, ...a.colors, ...a.sizes].every(Number.isFinite)).toBe(true);
    for (const count of [1200,4000]) {
      const visible=[...a.sizes.slice(0,count)];
      expect(visible.filter(v=>v>=2.3)).toHaveLength(count/100);
    }
    expect(starfieldBudget('balanced')).toEqual({count:4000,dpr:1.5});
    expect(starfieldBudget('low')).toEqual({count:1200,dpr:1});
  });
  it('converges at the same rate across refresh rates, with bounded stall recovery', () => {
    const run=hz=>{let x=0;for(let i=0;i<hz;i++)x=dampRotation(x,.65,1/hz);return x;};
    expect(run(60)).toBeCloseTo(run(120),10);
    expect(dampRotation(0,.65,4)).toBe(dampRotation(0,.65,.05));
    expect(clampRotation(100,'yaw')).toBe(.65);
    expect(clampRotation(-100,'pitch')).toBe(-.38);
  });
});
