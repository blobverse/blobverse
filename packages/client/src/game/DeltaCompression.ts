// DeltaCompression — Efficient state delta encoding/decoding

import { BlobSnapshot, PelletSnapshot } from '@blobverse/shared';

// =============================================================================
// Types
// =============================================================================

export interface DeltaBlob {
  id: string;
  x?: number;
  y?: number;
  radius?: number;
  color?: string;
  name?: string;
  expression?: string;
  fragments?: DeltaFragment[];
  removed?: boolean;
}

export interface DeltaFragment {
  id: string;
  x?: number;
  y?: number;
  radius?: number;
  removed?: boolean;
}

export interface DeltaPellet {
  id: string;
  x?: number;
  y?: number;
  mass?: number;
  type?: string;
  removed?: boolean;
}

export interface DeltaState {
  tick: number;
  baseTick?: number; // Tick this delta is relative to
  blobs?: DeltaBlob[];
  pellets?: DeltaPellet[];
  removedBlobs?: string[];
  removedPellets?: string[];
}

// =============================================================================
// Delta Encoder (Server-side, for reference)
// =============================================================================

export class DeltaEncoder {
  private lastState: Map<string, BlobSnapshot> = new Map();
  private lastPellets: Map<string, PelletSnapshot> = new Map();
  private lastTick = 0;
  
  // Position threshold for delta (don't send if moved less than this)
  private positionThreshold = 0.5;
  
  encode(
    tick: number,
    blobs: BlobSnapshot[],
    pellets: PelletSnapshot[]
  ): DeltaState {
    const delta: DeltaState = {
      tick,
      baseTick: this.lastTick,
    };
    
    const currentBlobs = new Map(blobs.map(b => [b.id, b]));
    const currentPellets = new Map(pellets.map(p => [p.id, p]));
    
    // Encode blob deltas
    const blobDeltas: DeltaBlob[] = [];
    
    for (const [id, blob] of currentBlobs) {
      const last = this.lastState.get(id);
      
      if (!last) {
        // New blob - send full state
        blobDeltas.push(blob);
      } else {
        // Existing blob - send only changed fields
        const delta = this.encodeBlobDelta(last, blob);
        if (delta) {
          blobDeltas.push(delta);
        }
      }
    }
    
    // Find removed blobs
    const removedBlobs: string[] = [];
    for (const id of this.lastState.keys()) {
      if (!currentBlobs.has(id)) {
        removedBlobs.push(id);
      }
    }
    
    // Encode pellet deltas
    const pelletDeltas: DeltaPellet[] = [];
    
    for (const [id, pellet] of currentPellets) {
      const last = this.lastPellets.get(id);
      
      if (!last) {
        pelletDeltas.push(pellet);
      } else {
        const delta = this.encodePelletDelta(last, pellet);
        if (delta) {
          pelletDeltas.push(delta);
        }
      }
    }
    
    // Find removed pellets
    const removedPellets: string[] = [];
    for (const id of this.lastPellets.keys()) {
      if (!currentPellets.has(id)) {
        removedPellets.push(id);
      }
    }
    
    // Only include arrays if they have content
    if (blobDeltas.length > 0) delta.blobs = blobDeltas;
    if (pelletDeltas.length > 0) delta.pellets = pelletDeltas;
    if (removedBlobs.length > 0) delta.removedBlobs = removedBlobs;
    if (removedPellets.length > 0) delta.removedPellets = removedPellets;
    
    // Update state
    this.lastState = currentBlobs;
    this.lastPellets = currentPellets;
    this.lastTick = tick;
    
    return delta;
  }
  
  private encodeBlobDelta(last: BlobSnapshot, current: BlobSnapshot): DeltaBlob | null {
    const delta: DeltaBlob = { id: current.id };
    let hasChanges = false;
    
    if (Math.abs(current.x - last.x) > this.positionThreshold) {
      delta.x = current.x;
      hasChanges = true;
    }
    
    if (Math.abs(current.y - last.y) > this.positionThreshold) {
      delta.y = current.y;
      hasChanges = true;
    }
    
    if (Math.abs(current.radius - last.radius) > 0.1) {
      delta.radius = current.radius;
      hasChanges = true;
    }
    
    if (current.expression !== last.expression) {
      delta.expression = current.expression;
      hasChanges = true;
    }
    
    // TODO: Encode fragment deltas
    
    return hasChanges ? delta : null;
  }
  
  private encodePelletDelta(last: PelletSnapshot, current: PelletSnapshot): DeltaPellet | null {
    // Pellets typically don't move much, so we use full replacement
    if (last.x !== current.x || last.y !== current.y || last.mass !== current.mass) {
      return current;
    }
    return null;
  }
  
  reset(): void {
    this.lastState.clear();
    this.lastPellets.clear();
    this.lastTick = 0;
  }
}

// =============================================================================
// Delta Decoder (Client-side)
// =============================================================================

export class DeltaDecoder {
  private state: Map<string, BlobSnapshot> = new Map();
  private pellets: Map<string, PelletSnapshot> = new Map();
  private lastTick = 0;
  
  /**
   * Apply delta to current state
   */
  apply(delta: DeltaState): {
    blobs: BlobSnapshot[];
    pellets: PelletSnapshot[];
  } {
    // Check for tick continuity
    if (delta.baseTick !== undefined && delta.baseTick !== this.lastTick) {
      console.warn(`[Delta] Tick mismatch: expected ${this.lastTick}, got base ${delta.baseTick}`);
      // Could request full state from server here
    }
    
    // Apply blob deltas
    if (delta.blobs) {
      for (const blobDelta of delta.blobs) {
        const existing = this.state.get(blobDelta.id);
        
        if (existing) {
          // Update existing
          this.applyBlobDelta(existing, blobDelta);
        } else {
          // New blob - delta should contain full state
          this.state.set(blobDelta.id, blobDelta as BlobSnapshot);
        }
      }
    }
    
    // Remove blobs
    if (delta.removedBlobs) {
      for (const id of delta.removedBlobs) {
        this.state.delete(id);
      }
    }
    
    // Apply pellet deltas
    if (delta.pellets) {
      for (const pelletDelta of delta.pellets) {
        const existing = this.pellets.get(pelletDelta.id);
        
        if (existing) {
          this.applyPelletDelta(existing, pelletDelta);
        } else {
          this.pellets.set(pelletDelta.id, pelletDelta as PelletSnapshot);
        }
      }
    }
    
    // Remove pellets
    if (delta.removedPellets) {
      for (const id of delta.removedPellets) {
        this.pellets.delete(id);
      }
    }
    
    this.lastTick = delta.tick;
    
    return {
      blobs: Array.from(this.state.values()),
      pellets: Array.from(this.pellets.values()),
    };
  }
  
  private applyBlobDelta(blob: BlobSnapshot, delta: DeltaBlob): void {
    if (delta.x !== undefined) blob.x = delta.x;
    if (delta.y !== undefined) blob.y = delta.y;
    if (delta.radius !== undefined) blob.radius = delta.radius;
    if (delta.color !== undefined) blob.color = delta.color;
    if (delta.name !== undefined) blob.name = delta.name;
    if (delta.expression !== undefined) blob.expression = delta.expression;
    if (delta.fragments !== undefined) {
      // For simplicity, replace all fragments
      blob.fragments = delta.fragments as BlobSnapshot['fragments'];
    }
  }
  
  private applyPelletDelta(pellet: PelletSnapshot, delta: DeltaPellet): void {
    if (delta.x !== undefined) pellet.x = delta.x;
    if (delta.y !== undefined) pellet.y = delta.y;
    if (delta.mass !== undefined) pellet.mass = delta.mass;
    if (delta.type !== undefined) pellet.type = delta.type;
  }
  
  /**
   * Set full state (e.g., on initial connect or after desync)
   */
  setFullState(blobs: BlobSnapshot[], pellets: PelletSnapshot[], tick: number): void {
    this.state = new Map(blobs.map(b => [b.id, b]));
    this.pellets = new Map(pellets.map(p => [p.id, p]));
    this.lastTick = tick;
  }
  
  getBlob(id: string): BlobSnapshot | undefined {
    return this.state.get(id);
  }
  
  reset(): void {
    this.state.clear();
    this.pellets.clear();
    this.lastTick = 0;
  }
}

// =============================================================================
// Compression Utilities
// =============================================================================

/**
 * Quantize a float to reduce precision (for compression)
 */
export function quantize(value: number, precision: number = 2): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate size of delta vs full state (for debugging)
 */
export function measureCompression(full: object, delta: object): {
  fullSize: number;
  deltaSize: number;
  ratio: number;
} {
  const fullStr = JSON.stringify(full);
  const deltaStr = JSON.stringify(delta);
  
  return {
    fullSize: fullStr.length,
    deltaSize: deltaStr.length,
    ratio: deltaStr.length / fullStr.length,
  };
}
