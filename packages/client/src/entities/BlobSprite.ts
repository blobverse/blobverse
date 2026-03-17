// Blobverse — BlobSprite
// Visual representation of a Blob entity with expressions and eye tracking

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BlobColor, BlobExpression, calculateRadius, lerp, clamp } from '@blobverse/shared';

// Default blob palette (from Section 12)
export const BLOB_PALETTE: BlobColor[] = [
  { fill: '#FF6B9D', glow: 'rgba(255,107,157,0.4)', eye: '#fff' },  // Pink
  { fill: '#4ECDC4', glow: 'rgba(78,205,196,0.4)',  eye: '#fff' },  // Teal
  { fill: '#45B7D1', glow: 'rgba(69,183,209,0.4)',  eye: '#fff' },  // Sky blue
  { fill: '#96CEB4', glow: 'rgba(150,206,180,0.4)', eye: '#fff' },  // Mint
  { fill: '#FFEAA7', glow: 'rgba(255,234,167,0.4)', eye: '#333' },  // Lemon (dark eyes)
  { fill: '#DDA0DD', glow: 'rgba(221,160,221,0.4)', eye: '#fff' },  // Plum
  { fill: '#FF8C42', glow: 'rgba(255,140,66,0.4)',  eye: '#fff' },  // Orange
  { fill: '#98D8C8', glow: 'rgba(152,216,200,0.4)', eye: '#fff' },  // Seafoam
];

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export interface BlobSpriteOptions {
  color?: BlobColor;
  name?: string;
  isPlayer?: boolean;
}

export class BlobSprite extends Container {
  // State
  private _mass: number;
  private _radius: number;
  private _expression: BlobExpression = 'happy';
  private _color: BlobColor;
  private _name: string;
  private _isPlayer: boolean;

  // Look direction (normalized, for eye tracking)
  private lookX: number = 0;
  private lookY: number = 0;
  private targetLookX: number = 0;
  private targetLookY: number = 0;

  // Graphics layers
  private glowGraphics: Graphics;
  private bodyGraphics: Graphics;
  private faceGraphics: Graphics;
  private nameText: Text | null = null;

  constructor(mass: number, options: BlobSpriteOptions = {}) {
    super();

    this._mass = mass;
    this._radius = calculateRadius(mass);
    this._color = options.color || BLOB_PALETTE[Math.floor(Math.random() * BLOB_PALETTE.length)];
    this._name = options.name || '';
    this._isPlayer = options.isPlayer || false;

    // Create graphics layers
    this.glowGraphics = new Graphics();
    this.bodyGraphics = new Graphics();
    this.faceGraphics = new Graphics();

    this.addChild(this.glowGraphics);
    this.addChild(this.bodyGraphics);
    this.addChild(this.faceGraphics);

    // Create name label
    if (this._name) {
      this.createNameLabel();
    }

    // Initial render
    this.redraw();
  }

  // --- Getters/Setters ---

  get mass(): number { return this._mass; }
  set mass(value: number) {
    if (value !== this._mass) {
      this._mass = value;
      this._radius = calculateRadius(value);
      this.redraw();
    }
  }

  get radius(): number { return this._radius; }

  get expression(): BlobExpression { return this._expression; }
  set expression(value: BlobExpression) {
    if (value !== this._expression) {
      this._expression = value;
      this.redrawFace();
    }
  }

  get color(): BlobColor { return this._color; }
  set color(value: BlobColor) {
    this._color = value;
    this.redraw();
  }

  get blobName(): string { return this._name; }
  set blobName(value: string) {
    this._name = value;
    if (this.nameText) {
      this.nameText.text = value;
    } else if (value) {
      this.createNameLabel();
    }
  }

  // --- Eye Tracking ---

  /**
   * Set the look direction (eyes will lerp toward this)
   * @param dirX Normalized direction X (-1 to 1)
   * @param dirY Normalized direction Y (-1 to 1)
   */
  setLookDirection(dirX: number, dirY: number): void {
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len > 0.01) {
      this.targetLookX = dirX / len;
      this.targetLookY = dirY / len;
    } else {
      this.targetLookX = 0;
      this.targetLookY = 0;
    }
  }

  /**
   * Update eye positions (call each frame)
   */
  updateEyes(dt: number): void {
    const eyeLerp = 0.15;
    this.lookX = lerp(this.lookX, this.targetLookX, eyeLerp);
    this.lookY = lerp(this.lookY, this.targetLookY, eyeLerp);
    this.redrawFace();
  }

  // --- Rendering ---

  private createNameLabel(): void {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: clamp(this._radius * 0.5, 9, 14),
      fill: this._isPlayer ? 0xFFD700 : 0xFFFFFF,
      fontWeight: 'bold',
      dropShadow: {
        alpha: 0.5,
        blur: 2,
        distance: 1,
      },
    });

    this.nameText = new Text({ text: this._name, style });
    this.nameText.anchor.set(0.5, 1);
    this.addChild(this.nameText);
    this.updateNamePosition();
  }

  private updateNamePosition(): void {
    if (this.nameText && this._radius >= 18) {
      this.nameText.y = -this._radius - 8;
      this.nameText.visible = true;
    } else if (this.nameText) {
      this.nameText.visible = false;
    }
  }

  /**
   * Full redraw of the blob
   */
  redraw(): void {
    this.redrawBody();
    this.redrawFace();
    this.updateNamePosition();
  }

  private redrawBody(): void {
    const g = this.bodyGraphics;
    const glow = this.glowGraphics;
    const r = this._radius;
    const fillColor = hexToNumber(this._color.fill);

    // Clear
    glow.clear();
    g.clear();

    // Glow layer (outer)
    glow.circle(0, 0, r + 4);
    glow.fill({ color: fillColor, alpha: 0.3 });

    // Main body
    g.circle(0, 0, r);
    g.fill({ color: fillColor, alpha: 0.92 });

    // Highlight (top-left specular)
    g.ellipse(-r * 0.25, -r * 0.25, r * 0.3, r * 0.2);
    g.fill({ color: 0xffffff, alpha: 0.25 });
  }

  private redrawFace(): void {
    const g = this.faceGraphics;
    const r = this._radius;
    const eyeColor = hexToNumber(this._color.eye);

    g.clear();

    // Don't draw face on tiny blobs
    if (r < 12) return;

    // Eye parameters
    const eyeRadius = Math.max(3, r * 0.18);
    const pupilRadius = eyeRadius * 0.55;
    const eyeOffsetX = r * 0.22;
    const eyeOffsetY = -r * 0.08;

    // Pupil tracking offset (based on look direction)
    const maxPupilOffset = eyeRadius * 0.25;
    const pupilOffsetX = this.lookX * maxPupilOffset;
    const pupilOffsetY = this.lookY * maxPupilOffset;

    // Left eye
    g.circle(-eyeOffsetX, eyeOffsetY, eyeRadius);
    g.fill({ color: eyeColor });
    g.circle(-eyeOffsetX + pupilOffsetX, eyeOffsetY + pupilOffsetY, pupilRadius);
    g.fill({ color: 0x000000 });

    // Right eye
    g.circle(eyeOffsetX, eyeOffsetY, eyeRadius);
    g.fill({ color: eyeColor });
    g.circle(eyeOffsetX + pupilOffsetX, eyeOffsetY + pupilOffsetY, pupilRadius);
    g.fill({ color: 0x000000 });

    // Expression-based mouth (only on larger blobs)
    if (r >= 18) {
      this.drawMouth(g, r);
    }

    // Worried expression: add eyebrows
    if (this._expression === 'worried' && r >= 18) {
      this.drawEyebrows(g, r, eyeOffsetX, eyeOffsetY, eyeRadius);
    }
  }

  private drawMouth(g: Graphics, r: number): void {
    const mouthY = r * 0.22;
    const mouthWidth = r * 0.15;

    switch (this._expression) {
      case 'happy':
        // Smile curve
        g.moveTo(-mouthWidth, mouthY);
        g.quadraticCurveTo(0, mouthY + r * 0.13, mouthWidth, mouthY);
        g.stroke({ width: 2, color: 0x333333, alpha: 0.6 });
        break;

      case 'eating':
        // Open mouth (ellipse)
        g.ellipse(0, mouthY + r * 0.05, r * 0.15, r * 0.12);
        g.fill({ color: 0x333333, alpha: 0.8 });
        break;

      case 'worried':
        // Frown curve
        g.moveTo(-mouthWidth, mouthY + r * 0.08);
        g.quadraticCurveTo(0, mouthY - r * 0.05, mouthWidth, mouthY + r * 0.08);
        g.stroke({ width: 2, color: 0x333333, alpha: 0.6 });
        break;
    }
  }

  private drawEyebrows(g: Graphics, r: number, eyeOffsetX: number, eyeOffsetY: number, eyeRadius: number): void {
    const browY = eyeOffsetY - eyeRadius - 3;
    const browWidth = eyeRadius * 0.8;

    // Left eyebrow (tilted down toward center)
    g.moveTo(-eyeOffsetX - browWidth, browY - 2);
    g.lineTo(-eyeOffsetX + browWidth, browY + 2);
    g.stroke({ width: 2, color: 0x333333, alpha: 0.6 });

    // Right eyebrow (tilted down toward center)
    g.moveTo(eyeOffsetX - browWidth, browY + 2);
    g.lineTo(eyeOffsetX + browWidth, browY - 2);
    g.stroke({ width: 2, color: 0x333333, alpha: 0.6 });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.glowGraphics.destroy();
    this.bodyGraphics.destroy();
    this.faceGraphics.destroy();
    if (this.nameText) this.nameText.destroy();
    super.destroy();
  }
}
