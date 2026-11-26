// Senja Air — a tiny seeded random generator so clouds, palms and villages
// are placed the same way every run (screenshots stay reproducible).

export function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function pickRng(rng, a, b) {
  return a + rng() * (b - a);
}
