// Blobverse — Physics (pure functions, shared client/server)

import { RADIUS_FACTOR, EATING_MASS_RATIO, OVERLAP_RATIO } from './constants';

export function calculateRadius(mass: number): number {
  return Math.sqrt(mass) * RADIUS_FACTOR;
}

export function calculateMass(radius: number): number {
  return (radius / RADIUS_FACTOR) ** 2;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export function checkEating(
  aMass: number, aX: number, aY: number, aRadius: number,
  bMass: number, bX: number, bY: number, bRadius: number
): 'a_eats_b' | 'b_eats_a' | 'none' {
  const dist = distance(aX, aY, bX, bY);
  const overlapRequired = Math.min(aRadius, bRadius) * OVERLAP_RATIO;

  if (dist > Math.max(aRadius, bRadius) - overlapRequired) {
    return 'none';
  }

  if (aMass > bMass * EATING_MASS_RATIO) return 'a_eats_b';
  if (bMass > aMass * EATING_MASS_RATIO) return 'b_eats_a';

  return 'none';
}
