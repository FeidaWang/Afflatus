// Minimal ambient declarations for astro.js's exports used by .ts consumers
// (tsconfig has allowJs/checkJs off, so plain .js files carry no types by
// default). Only declares what's actually imported from a .ts file today —
// extend as more .ts modules start consuming astro.js.
export declare function signOf(lonDeg: number): number;
export declare function degInSign(lonDeg: number): number;
