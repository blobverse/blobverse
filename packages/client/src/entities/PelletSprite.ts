// Blobverse — PelletSprite
// Visual representation of food pellets

import { Graphics } from 'pixi.js';
import { calculateRadius } from '@blobverse/shared';

// Pellet color palette
const PELLET_COLORS = [
  0xFF6B9D, // Pink
  0x4ECDC4, // Teal
  0x45B7D1, // Sky blue
  0x96CEB4, // Mint
  0xFFEAA7, // Lemon
  0xDDA0DD, // Plum
  0xFF8C42, // Orange
  0x98D8C8, // Seafoam
];

const GOLDEN_COLOR = 0xFFD700;
const GOLDEN_GLOW = 0xFFA500;

export class PelletSprite extends Graphics {
  readonly id: string;
  private _mass: number;
  private _isGolden: boolean;
  private _radius: number;

  // Animation state
  private pulsePhase: number = 0;
  private baseScale: number = 1;

  constructor(id: string, x: number, y: number, mass: number, isGolden: boolean = false) {
    super();

    this.id = id;
    this._mass = mass;
    this._isGolden = isGolden;
    this._radius = this.calculatePelletRadius(mass);

    this.position.set(x, y);
    this.pulsePhase = Math.random() * Math.PI * 2; // Random start phase

    this.draw();
  }

  /**
   * Pellet radius is smaller than blob radius for same mass
   */
  private calculatePelletRadius(mass: number): number {
    // Pellets are visually smaller - use 3.0 factor instead of 4.5
    return Math.sqrt(mass) * 3.0;
  }

  get mass(): number { return this._mass; }
  get isGolden(): boolean { return this._isGolden; }
  get radius(): number { return this._radius; }

  /**
   * Draw the pellet
   */
  private draw(): void {
    this.clear();

    const r = this._radius;

    if (this._isGolden) {
      // Golden pellet: outer glow
      this.circle(0, 0, r + 3);
      this.fill({ color: GOLDEN_GLOW, alpha: 0.4 });

      // Inner body
      this.circle(0, 0, r);
      this.fill({ color: GOLDEN_COLOR, alpha: 0.95 });

      // Sparkle highlight
      this.circle(-r * 0.3, -r * 0.3, r * 0.25);
      this.fill({ color: 0xFFFFFF, alpha: 0.6 });
    } else {
      // Normal pellet: random color from palette
      const colorIndex = Math.abs(this.id.charCodeAt(0)) % PELLET_COLORS.length;
      const color = PELLET_COLORS[colorIndex];

      // Subtle glow
      this.circle(0, 0, r + 1);
      this.fill({ color: color, alpha: 0.3 });

      // Main body
      this.circle(0, 0, r);
      this.fill({ color: color, alpha: 0.9 });
    }
  }

  /**
   * Update animation (call each frame)
   */
  update(dt: number): void {
    if (this._isGolden) {
      // Pulsing animation for golden pellets
      this.pulsePhase += dt * 0.003;
      const pulse = 1 + Math.sin(this.pulsePhase) * 0.15;
      this.scale.set(pulse);
    }
  }

  /**
   * Get bounding info for spatial hash
   */
  getSpatialEntity(): { id: string; x: number; y: number; radius: number } {
    return {
      id: this.id,
      x: this.position.x,
      y: this.position.y,
      radius: this._radius,
    };
  }
}
