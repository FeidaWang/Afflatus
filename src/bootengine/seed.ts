/* ============================================================
   SEED — U29 P1: deterministic seed generation for the AFFLATUS sim core.
   No THREE.js, no DOM — matches the cameraMath.js / flightPath.js
   discipline (plain functions, unit-testable without a scene).

   Why: the golden-set test contract for the whole engine (U29 P1) is "same
   seed → same trajectory, frame for frame". That only holds if every
   random choice in HBT/maneuvers flows through ONE seeded generator instead
   of Math.random(). This module is that single source of randomness.

   - fnv1aHash(str): a config string (e.g. "afflatus:2026-07-15:wave3") to a
     32-bit unsigned int. FNV-1a chosen over a stronger hash on purpose:
     it's ~10 lines, no dependency, and collision-proofing isn't the goal
     here — reproducibility is. Two different config strings landing on the
     same numeric seed is a cosmetic issue (a re-run looks like another
     run), not a correctness one.
   - toBase62/fromBase62: compact seed encoding for embedding in a URL or a
     saved-run label (U29 framework's "Base62 hash 存配置"), independent of
     the hash function above — any non-negative integer round-trips.
   - createRng(seed): mulberry32, a well-known small deterministic PRNG.
     Chosen over Math.random() (not seedable, not reproducible across
     runs/browsers) and over a heavier RNG (unnecessary — the maneuver
     library only needs a few floats/frame, not cryptographic quality).
   ============================================================ */

export function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 0x01000193 (FNV prime), done with shifts to stay in int32
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) | 0;
  }
  return hash >>> 0; // unsigned
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function toBase62(n: number): string {
  let v = Math.floor(Math.max(0, n));
  if (v === 0) return '0';
  let out = '';
  while (v > 0) {
    out = BASE62[v % 62] + out;
    v = Math.floor(v / 62);
  }
  return out;
}

export function fromBase62(s: string): number {
  let v = 0;
  for (const ch of s) {
    const digit = BASE62.indexOf(ch);
    if (digit < 0) continue; // ignore stray characters rather than throw
    v = v * 62 + digit;
  }
  return v;
}

// mulberry32: seed (any 32-bit int) → generator of floats in [0, 1).
// Same seed always produces the same infinite sequence — that's the whole
// point (golden-set determinism, U29 P1 acceptance criterion).
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// convenience: config string straight to a ready-to-use RNG.
export function rngFromString(input: string): () => number {
  return createRng(fnv1aHash(input));
}
