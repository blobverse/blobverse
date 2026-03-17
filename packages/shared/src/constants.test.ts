import { describe, it, expect } from 'vitest'
import * as constants from './constants'

describe('Constants sanity checks', () => {
  describe('World constants', () => {
    it('WORLD_WIDTH should be positive', () => {
      expect(constants.WORLD_WIDTH).toBeGreaterThan(0)
    })

    it('WORLD_HEIGHT should be positive', () => {
      expect(constants.WORLD_HEIGHT).toBeGreaterThan(0)
    })
  })

  describe('Tick constants', () => {
    it('SERVER_TPS should be positive', () => {
      expect(constants.SERVER_TPS).toBeGreaterThan(0)
    })

    it('TICK_INTERVAL_MS should match 1000/SERVER_TPS', () => {
      expect(constants.TICK_INTERVAL_MS).toBe(1000 / constants.SERVER_TPS)
    })

    it('TICK_INTERVAL_MS should be reasonable (10-100ms)', () => {
      expect(constants.TICK_INTERVAL_MS).toBeGreaterThanOrEqual(10)
      expect(constants.TICK_INTERVAL_MS).toBeLessThanOrEqual(100)
    })
  })

  describe('Movement constants', () => {
    it('BASE_SPEED should be positive', () => {
      expect(constants.BASE_SPEED).toBeGreaterThan(0)
    })

    it('SPEED_DECAY_EXPONENT should be between 0 and 1', () => {
      expect(constants.SPEED_DECAY_EXPONENT).toBeGreaterThan(0)
      expect(constants.SPEED_DECAY_EXPONENT).toBeLessThan(1)
    })

    it('MOVEMENT_SMOOTHING should be between 0 and 1', () => {
      expect(constants.MOVEMENT_SMOOTHING).toBeGreaterThan(0)
      expect(constants.MOVEMENT_SMOOTHING).toBeLessThanOrEqual(1)
    })

    it('MIN_MOVE_THRESHOLD should be positive', () => {
      expect(constants.MIN_MOVE_THRESHOLD).toBeGreaterThan(0)
    })
  })

  describe('Radius constants', () => {
    it('RADIUS_FACTOR should be positive', () => {
      expect(constants.RADIUS_FACTOR).toBeGreaterThan(0)
    })
  })

  describe('Eating constants', () => {
    it('EATING_MASS_RATIO should be greater than 1', () => {
      expect(constants.EATING_MASS_RATIO).toBeGreaterThan(1)
    })

    it('EATING_MASS_RATIO should be reasonable (1-2)', () => {
      expect(constants.EATING_MASS_RATIO).toBeLessThanOrEqual(2)
    })

    it('MASS_ABSORPTION_RATIO should be between 0 and 1', () => {
      expect(constants.MASS_ABSORPTION_RATIO).toBeGreaterThan(0)
      expect(constants.MASS_ABSORPTION_RATIO).toBeLessThanOrEqual(1)
    })

    it('OVERLAP_RATIO should be between 0 and 1', () => {
      expect(constants.OVERLAP_RATIO).toBeGreaterThan(0)
      expect(constants.OVERLAP_RATIO).toBeLessThanOrEqual(1)
    })
  })

  describe('Splitting constants', () => {
    it('MIN_SPLIT_MASS should be greater than INITIAL_MASS', () => {
      expect(constants.MIN_SPLIT_MASS).toBeGreaterThan(constants.INITIAL_MASS)
    })

    it('SPLIT_COOLDOWN_TICKS should be positive', () => {
      expect(constants.SPLIT_COOLDOWN_TICKS).toBeGreaterThan(0)
    })

    it('SPLIT_LAUNCH_SPEED should be positive', () => {
      expect(constants.SPLIT_LAUNCH_SPEED).toBeGreaterThan(0)
    })

    it('MERGE_DELAY_TICKS should be positive', () => {
      expect(constants.MERGE_DELAY_TICKS).toBeGreaterThan(0)
    })
  })

  describe('Mass ejection constants', () => {
    it('MIN_EJECT_MASS should be greater than EJECT_MASS_AMOUNT', () => {
      expect(constants.MIN_EJECT_MASS).toBeGreaterThan(constants.EJECT_MASS_AMOUNT)
    })

    it('EJECT_MASS_AMOUNT should be positive', () => {
      expect(constants.EJECT_MASS_AMOUNT).toBeGreaterThan(0)
    })

    it('EJECT_SPEED should be positive', () => {
      expect(constants.EJECT_SPEED).toBeGreaterThan(0)
    })

    it('EJECT_DECAY_TICKS should be positive', () => {
      expect(constants.EJECT_DECAY_TICKS).toBeGreaterThan(0)
    })
  })

  describe('Spawn constants', () => {
    it('INITIAL_MASS should be positive', () => {
      expect(constants.INITIAL_MASS).toBeGreaterThan(0)
    })

    it('PELLET_MASS_MIN should be positive', () => {
      expect(constants.PELLET_MASS_MIN).toBeGreaterThan(0)
    })

    it('PELLET_MASS_MAX should be >= PELLET_MASS_MIN', () => {
      expect(constants.PELLET_MASS_MAX).toBeGreaterThanOrEqual(constants.PELLET_MASS_MIN)
    })
  })

  describe('Round timing constants', () => {
    it('COUNTDOWN_DURATION should be positive', () => {
      expect(constants.COUNTDOWN_DURATION).toBeGreaterThan(0)
    })

    it('TRANSITION_DURATION should be positive', () => {
      expect(constants.TRANSITION_DURATION).toBeGreaterThan(0)
    })

    it('ELIMINATION_ANIMATION_DURATION should be positive', () => {
      expect(constants.ELIMINATION_ANIMATION_DURATION).toBeGreaterThan(0)
    })
  })

  describe('Lobby constants', () => {
    it('MIN_PLAYERS_TO_START should be >= 2', () => {
      expect(constants.MIN_PLAYERS_TO_START).toBeGreaterThanOrEqual(2)
    })

    it('MAX_PLAYERS_PER_ROOM should be > MIN_PLAYERS_TO_START', () => {
      expect(constants.MAX_PLAYERS_PER_ROOM).toBeGreaterThan(constants.MIN_PLAYERS_TO_START)
    })

    it('AI_FILL_RATIO should be between 0 and 1', () => {
      expect(constants.AI_FILL_RATIO).toBeGreaterThanOrEqual(0)
      expect(constants.AI_FILL_RATIO).toBeLessThanOrEqual(1)
    })

    it('LOBBY_WAIT_SECONDS should be positive', () => {
      expect(constants.LOBBY_WAIT_SECONDS).toBeGreaterThan(0)
    })
  })

  describe('Spatial hash constants', () => {
    it('SPATIAL_HASH_CELL_SIZE should be positive', () => {
      expect(constants.SPATIAL_HASH_CELL_SIZE).toBeGreaterThan(0)
    })

    it('SPATIAL_HASH_CELL_SIZE should be reasonable for world size', () => {
      // Should have at least 10 cells per dimension
      expect(constants.SPATIAL_HASH_CELL_SIZE).toBeLessThanOrEqual(
        Math.min(constants.WORLD_WIDTH, constants.WORLD_HEIGHT) / 10
      )
    })
  })
})
