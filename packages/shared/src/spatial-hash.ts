// Blobverse — Spatial Hash Grid (collision optimization)

import { SPATIAL_HASH_CELL_SIZE } from './constants.js'

export interface SpatialEntity {
  id: string
  x: number
  y: number
  radius: number
}

export class SpatialHashGrid<T extends SpatialEntity> {
  private cellSize: number
  private cells: Map<string, Set<T>>

  constructor(cellSize: number = SPATIAL_HASH_CELL_SIZE) {
    if (cellSize <= 0) {
      throw new Error('Cell size must be positive')
    }
    this.cellSize = cellSize
    this.cells = new Map()
  }

  private getCellKeys(entity: T): string[] {
    const keys: string[] = []
    const minX = Math.floor((entity.x - entity.radius) / this.cellSize)
    const maxX = Math.floor((entity.x + entity.radius) / this.cellSize)
    const minY = Math.floor((entity.y - entity.radius) / this.cellSize)
    const maxY = Math.floor((entity.y + entity.radius) / this.cellSize)

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        keys.push(`${cx},${cy}`)
      }
    }
    return keys
  }

  insert(entity: T): void {
    const keys = this.getCellKeys(entity)
    for (const key of keys) {
      if (!this.cells.has(key)) {
        this.cells.set(key, new Set())
      }
      this.cells.get(key)!.add(entity)
    }
  }

  remove(entity: T): void {
    const keys = this.getCellKeys(entity)
    for (const key of keys) {
      const cell = this.cells.get(key)
      if (cell) {
        cell.delete(entity)
        if (cell.size === 0) {
          this.cells.delete(key)
        }
      }
    }
  }

  update(entity: T, oldX: number, oldY: number, oldRadius: number): void {
    // Create temporary entity for old position
    const oldEntity = { ...entity, x: oldX, y: oldY, radius: oldRadius }
    const oldKeys = this.getCellKeys(oldEntity as T)
    const newKeys = this.getCellKeys(entity)

    // Remove from cells no longer occupied
    for (const key of oldKeys) {
      if (!newKeys.includes(key)) {
        const cell = this.cells.get(key)
        if (cell) {
          cell.delete(entity)
          if (cell.size === 0) {
            this.cells.delete(key)
          }
        }
      }
    }

    // Add to new cells
    for (const key of newKeys) {
      if (!oldKeys.includes(key)) {
        if (!this.cells.has(key)) {
          this.cells.set(key, new Set())
        }
        this.cells.get(key)!.add(entity)
      }
    }
  }

  query(x: number, y: number, radius: number): T[] {
    const results = new Set<T>()
    const minX = Math.floor((x - radius) / this.cellSize)
    const maxX = Math.floor((x + radius) / this.cellSize)
    const minY = Math.floor((y - radius) / this.cellSize)
    const maxY = Math.floor((y + radius) / this.cellSize)

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const key = `${cx},${cy}`
        const cell = this.cells.get(key)
        if (cell) {
          for (const entity of cell) {
            results.add(entity)
          }
        }
      }
    }

    return Array.from(results)
  }

  queryNearby(entity: T): T[] {
    const results = this.query(entity.x, entity.y, entity.radius)
    // Exclude self
    return results.filter(e => e.id !== entity.id)
  }

  clear(): void {
    this.cells.clear()
  }

  get size(): number {
    let count = 0
    const seen = new Set<T>()
    for (const cell of this.cells.values()) {
      for (const entity of cell) {
        if (!seen.has(entity)) {
          seen.add(entity)
          count++
        }
      }
    }
    return count
  }

  get cellCount(): number {
    return this.cells.size
  }
}
