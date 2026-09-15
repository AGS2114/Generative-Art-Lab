import { createNoise2D, createNoise3D } from "simplex-noise";

/**
 * Thin re-export of simplex-noise with a couple of convenience
 * factories, so every sketch imports noise from one place.
 */
export { createNoise2D, createNoise3D };

/** A ready-to-use noise2D(x, y) function with its own fixed seed. */
export function makeNoise2D(seed?: () => number) {
  return createNoise2D(seed);
}

/** A ready-to-use noise3D(x, y, z) function with its own fixed seed. */
export function makeNoise3D(seed?: () => number) {
  return createNoise3D(seed);
}

/** Simple seeded PRNG (mulberry32) - handy for reproducible/shareable seeds. */
export function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
