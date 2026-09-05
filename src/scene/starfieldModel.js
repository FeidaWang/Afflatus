// Deterministic, original orbital geometry. No external brand paths or data.
export const STARFIELD_LIMITS = Object.freeze({ yaw: .65, pitch: .38, dragThreshold: 6, dampingSeconds: .16 });
export const clampRotation = (value, axis) => Math.max(-STARFIELD_LIMITS[axis], Math.min(STARFIELD_LIMITS[axis], value));
export function dampRotation(current, target, dt) {
  return current + (target - current) * (1 - Math.exp(-Math.min(.05, Math.max(0, dt)) / STARFIELD_LIMITS.dampingSeconds));
}
export function starfieldBudget(tier) {
  return tier === 'low' ? { count: 1200, dpr: 1 } : { count: 4000, dpr: 1.5 };
}
export function createStarfieldGeometry(count = 4000) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  let seed = 317;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < count; i++) {
    // Interleaving keeps all three layers when drawRange lowers the budget.
    const layer = i % 100;
    const angle = random() * Math.PI * 2;
    let x, y, z;
    if (layer < 15) { // sparse far dust
      x = (random() - .5) * 7.5; y = (random() - .5) * 5; z = -1.8 - random() * 2;
      sizes[i] = .8 + random() * .7;
    } else if (layer === 99) { // only 1% bright foreground stars
      x = (random() - .5) * 6; y = (random() - .5) * 4; z = .4 + random();
      sizes[i] = 2.3 + random() * 1.2;
    } else { // orbital lanes retain the existing black-hole silhouette
      const lane = Math.floor(random() * 3);
      const radius = 1.18 + lane * .31 + (random() - .5) * .12;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius * (.34 + lane * .10) + (random() - .5) * .045;
      z = Math.sin(angle) * radius * .72;
      const tilt = -.30;
      [x, y] = [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)];
      sizes[i] = .9 + random() * 1.3;
    }
    positions.set([x, y, z], i * 3);
    const amber = random() < .075;
    const brightness = layer < 15 ? .35 : .7 + random() * .3;
    colors.set((amber ? [1, .68, .36] : [.67, .90, 1]).map(c => c * brightness), i * 3);
    phases[i] = random() * Math.PI * 2;
  }
  return { positions, colors, sizes, phases };
}
