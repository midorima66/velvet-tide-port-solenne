// A small seeded random number generator (mulberry32): the same seed always builds the same
// city and stages the same screenshot scene, which is what makes the covers repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random integer in [min, max] inclusive, drawn from a createRandom stream. */
export function randInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** A random element of a non-empty array. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
