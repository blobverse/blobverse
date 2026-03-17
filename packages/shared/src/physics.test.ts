import { describe, it, expect } from 'vitest'
import {
  calculateRadius,
  calculateMass,
  lerp,
  clamp,
  distance,
  checkEating
} from './physics'
import { RADIUS_FACTOR, EATING_MASS_RATIO, OVERLAP_RATIO } from './constants'

describe('calculateRadius', () => {
  it('should return 0 for mass 0', () => {
    expect(calculateRadius(0)).toBe(0)
  })

  it('should calculate radius correctly for positive mass', () => {
    // radius = sqrt(mass) * RADIUS_FACTOR
    expect(calculateRadius(1)).toBe(RADIUS_FACTOR)
    expect(calculateRadius(4)).toBe(2 * RADIUS_FACTOR)
    expect(calculateRadius(100)).toBe(10 * RADIUS_FACTOR)
  })

  it('should handle decimal mass', () => {
    expect(calculateRadius(0.25)).toBeCloseTo(0.5 * RADIUS_FACTOR)
  })

  it('should handle large mass values', () => {
    expect(calculateRadius(10000)).toBe(100 * RADIUS_FACTOR)
  })
})

describe('calculateMass', () => {
  it('should return 0 for radius 0', () => {
    expect(calculateMass(0)).toBe(0)
  })

  it('should calculate mass correctly for positive radius', () => {
    // mass = (radius / RADIUS_FACTOR)^2
    expect(calculateMass(RADIUS_FACTOR)).toBe(1)
    expect(calculateMass(2 * RADIUS_FACTOR)).toBe(4)
    expect(calculateMass(10 * RADIUS_FACTOR)).toBe(100)
  })

  it('should be inverse of calculateRadius', () => {
    const originalMass = 42
    const radius = calculateRadius(originalMass)
    const recoveredMass = calculateMass(radius)
    expect(recoveredMass).toBeCloseTo(originalMass)
  })

  it('should handle decimal radius', () => {
    const radius = 0.5 * RADIUS_FACTOR
    expect(calculateMass(radius)).toBeCloseTo(0.25)
  })
})

describe('lerp', () => {
  it('should return a when t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10)
    expect(lerp(-5, 100, 0)).toBe(-5)
  })

  it('should return b when t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20)
    expect(lerp(-5, 100, 1)).toBe(100)
  })

  it('should return midpoint when t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
    expect(lerp(-10, 10, 0.5)).toBe(0)
  })

  it('should handle negative values', () => {
    expect(lerp(-100, -50, 0.5)).toBe(-75)
  })

  it('should extrapolate when t > 1', () => {
    expect(lerp(0, 10, 2)).toBe(20)
  })

  it('should extrapolate when t < 0', () => {
    expect(lerp(0, 10, -1)).toBe(-10)
  })

  it('should handle a === b', () => {
    expect(lerp(5, 5, 0.5)).toBe(5)
  })
})

describe('clamp', () => {
  it('should return value when within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(0, -10, 10)).toBe(0)
  })

  it('should return min when value is below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(-100, -50, 50)).toBe(-50)
  })

  it('should return max when value is above max', () => {
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(100, -50, 50)).toBe(50)
  })

  it('should handle min === max', () => {
    expect(clamp(0, 5, 5)).toBe(5)
    expect(clamp(10, 5, 5)).toBe(5)
  })

  it('should handle value === min', () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })

  it('should handle value === max', () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('should handle negative bounds', () => {
    expect(clamp(-5, -10, -2)).toBe(-5)
    expect(clamp(-15, -10, -2)).toBe(-10)
    expect(clamp(0, -10, -2)).toBe(-2)
  })
})

describe('distance', () => {
  it('should return 0 for same point', () => {
    expect(distance(5, 5, 5, 5)).toBe(0)
    expect(distance(0, 0, 0, 0)).toBe(0)
  })

  it('should calculate horizontal distance', () => {
    expect(distance(0, 0, 10, 0)).toBe(10)
    expect(distance(10, 0, 0, 0)).toBe(10)
  })

  it('should calculate vertical distance', () => {
    expect(distance(0, 0, 0, 10)).toBe(10)
    expect(distance(0, 10, 0, 0)).toBe(10)
  })

  it('should calculate diagonal distance (3-4-5 triangle)', () => {
    expect(distance(0, 0, 3, 4)).toBe(5)
    expect(distance(0, 0, 6, 8)).toBe(10)
  })

  it('should handle negative coordinates', () => {
    expect(distance(-3, -4, 0, 0)).toBe(5)
    expect(distance(-5, 0, 5, 0)).toBe(10)
  })

  it('should be symmetric', () => {
    expect(distance(1, 2, 3, 4)).toBe(distance(3, 4, 1, 2))
  })

  it('should handle decimal coordinates', () => {
    expect(distance(0.5, 0.5, 1.5, 0.5)).toBe(1)
  })
})

describe('checkEating', () => {
  // Helper to create test blobs with consistent radius
  const massToRadius = (mass: number) => Math.sqrt(mass) * RADIUS_FACTOR

  describe('no eating conditions', () => {
    it('should return none when blobs are too far apart', () => {
      const aMass = 100, bMass = 50
      const aRadius = massToRadius(aMass)
      const bRadius = massToRadius(bMass)
      // Place far apart
      const result = checkEating(
        aMass, 0, 0, aRadius,
        bMass, 1000, 1000, bRadius
      )
      expect(result).toBe('none')
    })

    it('should return none when mass difference is insufficient', () => {
      const aMass = 100, bMass = 90 // 100 < 90 * 1.25 (112.5)
      const aRadius = massToRadius(aMass)
      const bRadius = massToRadius(bMass)
      // Place overlapping
      const result = checkEating(
        aMass, 0, 0, aRadius,
        bMass, 1, 1, bRadius
      )
      expect(result).toBe('none')
    })

    it('should return none when equal mass', () => {
      const mass = 100
      const radius = massToRadius(mass)
      const result = checkEating(
        mass, 0, 0, radius,
        mass, 0, 0, radius
      )
      expect(result).toBe('none')
    })

    it('should return none when barely not enough overlap', () => {
      const aMass = 200, bMass = 100
      const aRadius = massToRadius(aMass)
      const bRadius = massToRadius(bMass)
      // Calculate distance that's just beyond overlap threshold
      const overlapRequired = Math.min(aRadius, bRadius) * OVERLAP_RATIO
      const dist = Math.max(aRadius, bRadius) - overlapRequired + 0.01
      
      const result = checkEating(
        aMass, 0, 0, aRadius,
        bMass, dist, 0, bRadius
      )
      expect(result).toBe('none')
    })
  })

  describe('a eats b', () => {
    it('should return a_eats_b when a is significantly larger and overlapping', () => {
      const aMass = 200, bMass = 100 // 200 > 100 * 1.25 (125)
      const aRadius = massToRadius(aMass)
      const bRadius = massToRadius(bMass)
      // Place at same position (full overlap)
      const result = checkEating(
        aMass, 0, 0, aRadius,
        bMass, 0, 0, bRadius
      )
      expect(result).toBe('a_eats_b')
    })

    it('should return a_eats_b at exact ratio threshold', () => {
      const bMass = 100
      const aMass = bMass * EATING_MASS_RATIO + 0.01 // Just above threshold
      const aRadius = massToRadius(aMass)
      const bRadius = massToRadius(bMass)
      
      const result = checkEating(
        aMass, 0, 0, aRadius,
        bMass, 0, 0, bRadius
      )
      expect(result).toBe('a_eats_b')
    })

    it('should return a_eats_b with partial but sufficient overlap', () => {
      const aMass = 200, bMass = 100
      const aRadius = massToRadius(aMass)
      const bRadius = massToRadius(bMass)
      // Calculate distance that just meets overlap threshold
      const overlapRequired = Math.min(aRadius, bRadius) * OVERLAP_RATIO
      const dist = Math.max(aRadius, bRadius) - overlapRequired - 0.01
      
      const result = checkEating(
        aMass, 0, 0, aRadius,
        bMass, dist, 0, bRadius
      )
      expect(result).toBe('a_eats_b')
    })
  })

  describe('b eats a', () => {
    it('should return b_eats_a when b is significantly larger and overlapping', () => {
      const aMass = 100, bMass = 200 // 200 > 100 * 1.25 (125)
      const aRadius = massToRadius(aMass)
      const bRadius = massToRadius(bMass)
      
      const result = checkEating(
        aMass, 0, 0, aRadius,
        bMass, 0, 0, bRadius
      )
      expect(result).toBe('b_eats_a')
    })

    it('should return b_eats_a at exact ratio threshold', () => {
      const aMass = 100
      const bMass = aMass * EATING_MASS_RATIO + 0.01 // Just above threshold
      const aRadius = massToRadius(aMass)
      const bRadius = massToRadius(bMass)
      
      const result = checkEating(
        aMass, 0, 0, aRadius,
        bMass, 0, 0, bRadius
      )
      expect(result).toBe('b_eats_a')
    })
  })

  describe('edge cases', () => {
    it('should handle very small masses', () => {
      const aMass = 2, bMass = 1
      const aRadius = massToRadius(aMass)
      const bRadius = massToRadius(bMass)
      
      const result = checkEating(
        aMass, 0, 0, aRadius,
        bMass, 0, 0, bRadius
      )
      // 2 > 1 * 1.25 (1.25) so a_eats_b
      expect(result).toBe('a_eats_b')
    })

    it('should handle very large masses', () => {
      const aMass = 10000, bMass = 5000
      const aRadius = massToRadius(aMass)
      const bRadius = massToRadius(bMass)
      
      const result = checkEating(
        aMass, 0, 0, aRadius,
        bMass, 0, 0, bRadius
      )
      // 10000 > 5000 * 1.25 (6250) so a_eats_b
      expect(result).toBe('a_eats_b')
    })

    it('should handle zero mass (edge case)', () => {
      const result = checkEating(
        0, 0, 0, 0,
        0, 0, 0, 0
      )
      expect(result).toBe('none')
    })
  })
})
