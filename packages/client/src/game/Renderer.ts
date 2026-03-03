// Blobverse — PixiJS v8 Renderer
// Background grid + parallax + entity rendering

import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '@blobverse/shared';
import { Camera } from './Camera';

// Visual theme constants (from Section 12)
const THEME = {
  bg: 0x0B0E17,
  bgGrid: 'rgba(255,255,255,0.03)',
  gridColor: 0x1a1a2e,
  gridAlpha: 0.4,
};

const GRID_SPACING = 50;
const PARALLAX_FACTOR = 0.3; // Grid moves slower than camera

export class Renderer {
  app: Application;
  camera: Camera;

  // Containers (layers) - exposed for entity management
  private worldContainer: Container;
  private gridGraphics: Graphics;
  entityContainer: Container; // Public for adding entities
  private uiContainer: Container;

  // Debug display
  private debugText: Text | null = null;
  private showDebug: boolean = true;
  private debugData: Record<string, string | number> = {};

  // Bound listener for cleanup
  private boundHandleResize: () => void = () => {};

  private constructor(app: Application, camera: Camera) {
    this.app = app;
    this.camera = camera;

    // Create layer hierarchy
    this.worldContainer = new Container();
    this.gridGraphics = new Graphics();
    this.entityContainer = new Container();
    this.uiContainer = new Container();

    // Add to stage in order (bottom to top)
    this.worldContainer.addChild(this.gridGraphics);
    this.worldContainer.addChild(this.entityContainer);
    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.uiContainer);
  }

  /**
   * Initialize the renderer (async factory)
   */
  static async create(canvas?: HTMLCanvasElement): Promise<Renderer> {
    const app = new Application();

    await app.init({
      background: THEME.bg,
      resizeTo: window,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      canvas: canvas,
    });

    const camera = new Camera(app.screen.width, app.screen.height);
    const renderer = new Renderer(app, camera);

    // Setup resize handler
    renderer.boundHandleResize = () => renderer.handleResize();
    window.addEventListener('resize', renderer.boundHandleResize);

    // Create debug text
    if (renderer.showDebug) {
      renderer.createDebugDisplay();
    }

    return renderer;
  }

  /**
   * Get the canvas element to attach to DOM
   */
  getCanvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    this.camera.resize(window.innerWidth, window.innerHeight);
  }

  /**
   * Set debug data to display
   */
  setDebugData(key: string, value: string | number): void {
    this.debugData[key] = value;
  }

  /**
   * Render a single frame
   */
  render(dt: number): void {
    // Apply camera transform to world container
    this.worldContainer.x = this.app.screen.width / 2;
    this.worldContainer.y = this.app.screen.height / 2;
    this.worldContainer.scale.set(this.camera.zoom);
    this.worldContainer.pivot.x = this.camera.x;
    this.worldContainer.pivot.y = this.camera.y;

    // Render grid (with parallax)
    this.renderGrid();

    // Update debug display
    if (this.debugText) {
      this.updateDebugDisplay(dt);
    }
  }

  /**
   * Render infinite background grid with parallax
   */
  private renderGrid(): void {
    const g = this.gridGraphics;
    g.clear();

    const bounds = this.camera.getVisibleBounds();

    // Apply parallax offset
    const parallaxOffsetX = this.camera.x * PARALLAX_FACTOR;
    const parallaxOffsetY = this.camera.y * PARALLAX_FACTOR;

    // Calculate grid line positions (snapped to grid spacing)
    const startX = Math.floor((bounds.left + parallaxOffsetX) / GRID_SPACING) * GRID_SPACING - parallaxOffsetX;
    const startY = Math.floor((bounds.top + parallaxOffsetY) / GRID_SPACING) * GRID_SPACING - parallaxOffsetY;
    const endX = bounds.right;
    const endY = bounds.bottom;

    // Draw vertical lines
    for (let x = startX; x <= endX; x += GRID_SPACING) {
      // Only draw within world bounds
      if (x >= 0 && x <= WORLD_WIDTH) {
        g.moveTo(x, Math.max(0, bounds.top));
        g.lineTo(x, Math.min(WORLD_HEIGHT, bounds.bottom));
      }
    }

    // Draw horizontal lines
    for (let y = startY; y <= endY; y += GRID_SPACING) {
      if (y >= 0 && y <= WORLD_HEIGHT) {
        g.moveTo(Math.max(0, bounds.left), y);
        g.lineTo(Math.min(WORLD_WIDTH, bounds.right), y);
      }
    }

    g.stroke({ width: 1 / this.camera.zoom, color: THEME.gridColor, alpha: THEME.gridAlpha });

    // Draw world boundary
    g.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    g.stroke({ width: 2 / this.camera.zoom, color: 0xff4444, alpha: 0.5 });
  }

  /**
   * Create debug display
   */
  private createDebugDisplay(): void {
    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0x88ff88,
    });
    this.debugText = new Text({ text: '', style });
    this.debugText.position.set(10, 10);
    this.uiContainer.addChild(this.debugText);
  }

  /**
   * Update debug display
   */
  private updateDebugDisplay(dt: number): void {
    if (!this.debugText) return;

    const fps = Math.round(1000 / (dt || 16.67));
    const lines = [
      `FPS: ${fps}`,
      `Camera: (${Math.round(this.camera.x)}, ${Math.round(this.camera.y)})`,
      `Zoom: ${this.camera.zoom.toFixed(2)}`,
    ];

    // Add custom debug data
    for (const [key, value] of Object.entries(this.debugData)) {
      if (typeof value === 'number') {
        lines.push(`${key}: ${value.toFixed(1)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }

    this.debugText.text = lines.join('\n');
  }

  /**
   * Destroy the renderer
   */
  destroy(): void {
    window.removeEventListener('resize', this.boundHandleResize);
    this.app.destroy(true);
  }
}
