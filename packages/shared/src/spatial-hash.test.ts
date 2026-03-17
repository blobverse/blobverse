import { describe, it, expect, beforeEach } from 'vitest'
import { SpatialHashGrid, SpatialEntity } from './spatial-hash'

interface TestEntity extends SpatialEntity {
  name?: string
}

describe('SpatialHashGrid', () => {
  let grid: SpatialHashGrid<TestEntity>

  beforeEach(() => {
    grid = new SpatialHashGrid<TestEntity>(100)
  })

  describe('constructor', () => {
    it('should create grid with default cell size', () => {
      const defaultGrid = new SpatialHashGrid<TestEntity>()
      expect(defaultGrid).toBeDefined()
    })

    it('should create grid with custom cell size', () => {
      const customGrid = new SpatialHashGrid<TestEntity>(50)
      expect(customGrid).toBeDefined()
    })

    it('should throw on non-positive cell size', () => {
      expect(() => new SpatialHashGrid<TestEntity>(0)).toThrow('Cell size must be positive')
      expect(() => new SpatialHashGrid<TestEntity>(-10)).toThrow('Cell size must be positive')
    })
  })

  describe('insert', () => {
    it('should insert entity into grid', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)
      expect(grid.size).toBe(1)
    })

    it('should insert entity spanning multiple cells', () => {
      // Large entity that spans 4 cells (cell size = 100)
      const entity: TestEntity = { id: '1', x: 100, y: 100, radius: 60 }
      grid.insert(entity)
      expect(grid.size).toBe(1)
      expect(grid.cellCount).toBeGreaterThan(1)
    })

    it('should insert multiple entities', () => {
      const e1: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      const e2: TestEntity = { id: '2', x: 150, y: 150, radius: 10 }
      grid.insert(e1)
      grid.insert(e2)
      expect(grid.size).toBe(2)
    })

    it('should handle entities at negative coordinates', () => {
      const entity: TestEntity = { id: '1', x: -50, y: -50, radius: 10 }
      grid.insert(entity)
      expect(grid.size).toBe(1)
    })

    it('should handle entity at origin', () => {
      const entity: TestEntity = { id: '1', x: 0, y: 0, radius: 10 }
      grid.insert(entity)
      expect(grid.size).toBe(1)
    })
  })

  describe('remove', () => {
    it('should remove entity from grid', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)
      expect(grid.size).toBe(1)
      grid.remove(entity)
      expect(grid.size).toBe(0)
    })

    it('should remove entity spanning multiple cells', () => {
      const entity: TestEntity = { id: '1', x: 100, y: 100, radius: 60 }
      grid.insert(entity)
      grid.remove(entity)
      expect(grid.size).toBe(0)
      expect(grid.cellCount).toBe(0)
    })

    it('should handle removing non-existent entity gracefully', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      expect(() => grid.remove(entity)).not.toThrow()
    })

    it('should only remove specified entity', () => {
      const e1: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      const e2: TestEntity = { id: '2', x: 50, y: 50, radius: 10 }
      grid.insert(e1)
      grid.insert(e2)
      grid.remove(e1)
      expect(grid.size).toBe(1)
    })
  })

  describe('update', () => {
    it('should update entity position', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)

      // Move entity
      const oldX = entity.x
      const oldY = entity.y
      const oldRadius = entity.radius
      entity.x = 250
      entity.y = 250
      grid.update(entity, oldX, oldY, oldRadius)

      // Should find at new position
      const resultsNew = grid.query(250, 250, 20)
      expect(resultsNew).toContain(entity)

      // Should not find at old position
      const resultsOld = grid.query(50, 50, 20)
      expect(resultsOld).not.toContain(entity)
    })

    it('should handle entity staying in same cell', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)

      const oldX = entity.x
      const oldY = entity.y
      const oldRadius = entity.radius
      entity.x = 55
      entity.y = 55
      grid.update(entity, oldX, oldY, oldRadius)

      expect(grid.size).toBe(1)
      const results = grid.query(55, 55, 20)
      expect(results).toContain(entity)
    })

    it('should handle radius change', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)
      const initialCellCount = grid.cellCount

      const oldX = entity.x
      const oldY = entity.y
      const oldRadius = entity.radius
      entity.radius = 60 // Now spans multiple cells
      grid.update(entity, oldX, oldY, oldRadius)

      expect(grid.cellCount).toBeGreaterThan(initialCellCount)
    })
  })

  describe('query', () => {
    it('should return empty array for empty grid', () => {
      const results = grid.query(50, 50, 100)
      expect(results).toEqual([])
    })

    it('should find entity in query range', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)

      const results = grid.query(50, 50, 20)
      expect(results).toContain(entity)
    })

    it('should not find entity outside query range', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)

      const results = grid.query(500, 500, 20)
      expect(results).not.toContain(entity)
    })

    it('should find multiple entities', () => {
      const e1: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      const e2: TestEntity = { id: '2', x: 60, y: 60, radius: 10 }
      grid.insert(e1)
      grid.insert(e2)

      const results = grid.query(55, 55, 50)
      expect(results).toContain(e1)
      expect(results).toContain(e2)
    })

    it('should not return duplicates for entities spanning cells', () => {
      const entity: TestEntity = { id: '1', x: 100, y: 100, radius: 60 }
      grid.insert(entity)

      const results = grid.query(100, 100, 100)
      const ids = results.map(e => e.id)
      expect(ids.filter(id => id === '1')).toHaveLength(1)
    })

    it('should handle query at cell boundary', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)

      // Query from adjacent cell
      const results = grid.query(99, 100, 20)
      expect(results).toContain(entity)
    })

    it('should handle zero radius query', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)

      const results = grid.query(50, 50, 0)
      expect(results).toContain(entity)
    })
  })

  describe('queryNearby', () => {
    it('should exclude self from results', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)

      const results = grid.queryNearby(entity)
      expect(results).not.toContain(entity)
    })

    it('should find nearby entities', () => {
      const e1: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      const e2: TestEntity = { id: '2', x: 55, y: 55, radius: 10 }
      grid.insert(e1)
      grid.insert(e2)

      const results = grid.queryNearby(e1)
      expect(results).toContain(e2)
      expect(results).not.toContain(e1)
    })

    it('should return empty array when alone', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      grid.insert(entity)

      const results = grid.queryNearby(entity)
      expect(results).toEqual([])
    })
  })

  describe('clear', () => {
    it('should remove all entities', () => {
      const e1: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
      const e2: TestEntity = { id: '2', x: 150, y: 150, radius: 10 }
      grid.insert(e1)
      grid.insert(e2)

      grid.clear()

      expect(grid.size).toBe(0)
      expect(grid.cellCount).toBe(0)
    })

    it('should handle clearing empty grid', () => {
      expect(() => grid.clear()).not.toThrow()
      expect(grid.size).toBe(0)
    })
  })

  describe('size', () => {
    it('should return 0 for empty grid', () => {
      expect(grid.size).toBe(0)
    })

    it('should return correct count', () => {
      grid.insert({ id: '1', x: 50, y: 50, radius: 10 })
      grid.insert({ id: '2', x: 150, y: 150, radius: 10 })
      grid.insert({ id: '3', x: 250, y: 250, radius: 10 })
      expect(grid.size).toBe(3)
    })

    it('should not count same entity multiple times', () => {
      // Large entity spanning multiple cells
      const entity: TestEntity = { id: '1', x: 100, y: 100, radius: 60 }
      grid.insert(entity)
      expect(grid.size).toBe(1)
    })
  })

  describe('cellCount', () => {
    it('should return 0 for empty grid', () => {
      expect(grid.cellCount).toBe(0)
    })

    it('should return correct cell count', () => {
      // Small entity in one cell
      grid.insert({ id: '1', x: 50, y: 50, radius: 10 })
      expect(grid.cellCount).toBe(1)

      // Another entity in different cell
      grid.insert({ id: '2', x: 150, y: 150, radius: 10 })
      expect(grid.cellCount).toBe(2)
    })

    it('should count cells for entity spanning boundaries', () => {
      // Entity at cell boundary (cell size = 100)
      const entity: TestEntity = { id: '1', x: 100, y: 100, radius: 60 }
      grid.insert(entity)
      // Should span 4 cells (2x2)
      expect(grid.cellCount).toBe(4)
    })
  })

  describe('edge cases', () => {
    it('should handle very large coordinates', () => {
      const entity: TestEntity = { id: '1', x: 1000000, y: 1000000, radius: 10 }
      grid.insert(entity)
      expect(grid.size).toBe(1)

      const results = grid.query(1000000, 1000000, 20)
      expect(results).toContain(entity)
    })

    it('should handle very small radius', () => {
      const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 0.001 }
      grid.insert(entity)
      expect(grid.size).toBe(1)
    })

    it('should handle very large radius', () => {
      const entity: TestEntity = { id: '1', x: 500, y: 500, radius: 1000 }
      grid.insert(entity)
      expect(grid.size).toBe(1)
      // Should span many cells
      expect(grid.cellCount).toBeGreaterThan(100)
    })
  })
})

describe('SpatialHashGrid update branch coverage', () => {
  let grid: SpatialHashGrid<TestEntity>

  beforeEach(() => {
    grid = new SpatialHashGrid<TestEntity>(100)
  })

  it('should clean up empty cells when entity moves away and was only occupant', () => {
    // Insert single entity
    const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
    grid.insert(entity)
    expect(grid.cellCount).toBe(1)

    // Move entity to different cell
    const oldX = entity.x
    const oldY = entity.y
    const oldRadius = entity.radius
    entity.x = 250
    entity.y = 250
    grid.update(entity, oldX, oldY, oldRadius)

    // Old cell should be cleaned up (size was 0)
    expect(grid.cellCount).toBe(1)
    
    // Verify entity is findable at new location only
    expect(grid.query(250, 250, 20)).toContain(entity)
    expect(grid.query(50, 50, 20)).not.toContain(entity)
  })

  it('should not clean up cells when other entities remain after update', () => {
    // Insert two entities in same cell
    const e1: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
    const e2: TestEntity = { id: '2', x: 60, y: 60, radius: 10 }
    grid.insert(e1)
    grid.insert(e2)
    expect(grid.cellCount).toBe(1)

    // Move e1 to different cell
    const oldX = e1.x
    const oldY = e1.y
    const oldRadius = e1.radius
    e1.x = 250
    e1.y = 250
    grid.update(e1, oldX, oldY, oldRadius)

    // Both cells should exist (old cell still has e2)
    expect(grid.cellCount).toBe(2)
    expect(grid.query(60, 60, 20)).toContain(e2)
    expect(grid.query(250, 250, 20)).toContain(e1)
  })

  it('should add entity to new cell that did not exist before', () => {
    // Start with entity
    const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
    grid.insert(entity)
    expect(grid.cellCount).toBe(1)

    // Move to a brand new cell that has never been created
    const oldX = entity.x
    const oldY = entity.y
    const oldRadius = entity.radius
    entity.x = 550
    entity.y = 550
    grid.update(entity, oldX, oldY, oldRadius)

    // New cell should be created
    expect(grid.query(550, 550, 20)).toContain(entity)
  })

  it('should add entity to existing cell with other entities', () => {
    // Create two entities in different cells
    const e1: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
    const e2: TestEntity = { id: '2', x: 150, y: 150, radius: 10 }
    grid.insert(e1)
    grid.insert(e2)
    expect(grid.cellCount).toBe(2)

    // Move e1 to e2's cell
    const oldX = e1.x
    const oldY = e1.y
    const oldRadius = e1.radius
    e1.x = 155
    e1.y = 155
    grid.update(e1, oldX, oldY, oldRadius)

    // Should now have 1 cell with both entities
    expect(grid.cellCount).toBe(1)
    const results = grid.query(155, 155, 20)
    expect(results).toContain(e1)
    expect(results).toContain(e2)
  })
})

describe('SpatialHashGrid edge case: update with missing cells', () => {
  let grid: SpatialHashGrid<TestEntity>

  beforeEach(() => {
    grid = new SpatialHashGrid<TestEntity>(100)
  })

  it('should handle update when old cell no longer exists (entity was externally removed)', () => {
    // Insert entity
    const entity: TestEntity = { id: '1', x: 50, y: 50, radius: 10 }
    grid.insert(entity)

    // Remove the entity first
    grid.remove(entity)
    expect(grid.size).toBe(0)

    // Now try to update it (simulating a race condition or stale data)
    // This should not throw, even though the old cell doesn't exist
    const oldX = entity.x
    const oldY = entity.y
    const oldRadius = entity.radius
    entity.x = 250
    entity.y = 250
    
    expect(() => grid.update(entity, oldX, oldY, oldRadius)).not.toThrow()
    
    // Entity should be in the new position
    expect(grid.query(250, 250, 20)).toContain(entity)
  })
})
