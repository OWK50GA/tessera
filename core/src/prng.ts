// Tessera — deterministic PRNG (mulberry32) and shuffle utilities.
// Nothing in this package uses Math.random().

/**
 * mulberry32 — a fast, seedable 32-bit PRNG.
 * Returns a closure that produces values in [0, 1) on each call,
 * matching the Math.random() contract so it is a drop-in replacement.
 *
 * @param seed  32-bit unsigned integer seed.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Fisher-Yates shuffle using a caller-supplied RNG.
 * Returns a new array; the original is not mutated.
 *
 * @param arr  Source array.
 * @param rng  Seeded RNG returning values in [0, 1).
 */
export function seededShuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    // noUncheckedIndexedAccess: indices are provably in range here
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/**
 * Derive the tile-pool seed from a puzzle seed.
 * Using a fixed offset keeps it deterministic while ensuring the pool order
 * differs from the solution order.
 */
export function poolSeed(puzzleSeed: number): number {
  return (puzzleSeed + 0x80000000) >>> 0;
}
