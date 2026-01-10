/**
 * Mulberry32 - fast, deterministic PRNG
 * Creates a seeded random number generator that produces values in [0, 1)
 */
export function createRng(seed: number): () => number {
  let state = seed;
  return function () {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a random integer in [min, max] inclusive
 */
export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Generate a random float in [min, max)
 */
export function randFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

/**
 * Pick a random element from an array
 */
export function randPick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Generate a normally distributed random number using Box-Muller transform
 */
export function randNormal(
  rng: () => number,
  mean: number = 0,
  stdDev: number = 1
): number {
  const u1 = rng();
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}
