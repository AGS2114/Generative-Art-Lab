import { createNoise2D, createNoise3D } from "simplex-noise";

export { createNoise2D, createNoise3D };
export function makeNoise2D(seed?: () => number) {
  return createNoise2D(seed);
}
export function makeNoise3D(seed?: () => number) {
  return createNoise3D(seed);
}
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
