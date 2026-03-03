// Blobverse — Camera System
// Follows player blob with smooth lerp + mass-based zoom

import { WORLD_WIDTH, WORLD_HEIGHT, lerp, clamp } from '@blobverse/shared';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.8;
const CAMERA_LERP = 0.1;
const ZOOM_LERP = 0.05;

export interface CameraTarget {
  x: number;
  y: number;
  mass?: number;
}

export class Camera {
  /** World position (center of view) */
  x: number = WORLD_WIDTH / 2;
  y: number = WORLD_HEIGHT / 2;

  /** Current zoom level */
  zoom: number = 1;

  /** Target zoom based on mass */
  private targetZoom: number = 1;

  /** Viewport dimensions */
  private viewportWidth: number = window.innerWidth;
  private viewportHeight: number = window.innerHeight;

  constructor(viewportWidth?: number, viewportHeight?: number) {
    if (viewportWidth) this.viewportWidth = viewportWidth;
    if (viewportHeight) this.viewportHeight = viewportHeight;
  }

  /**
   * Update camera position and zoom
   * @param target - The entity to follow (usually player blob)
   * @param dt - Delta time (unused for lerp-based smoothing, but available for future use)
   */
  update(target: CameraTarget | null, _dt?: number): void {
    if (target) {
      // Smooth position follow
      this.x = lerp(this.x, target.x, CAMERA_LERP);
      this.y = lerp(this.y, target.y, CAMERA_LERP);

      // Calculate target zoom based on mass
      // Mass 10 → zoom 1.5 (close)
      // Mass 100 → zoom 0.8 (medium)
      // Mass 500 → zoom 0.4 (far)
      if (target.mass !== undefined) {
        this.targetZoom = clamp(
          1.5 / Math.pow(target.mass / 10, 0.35),
          MIN_ZOOM,
          MAX_ZOOM
        );
      }
    }

    // Smooth zoom transition
    this.zoom = lerp(this.zoom, this.targetZoom, ZOOM_LERP);
  }

  /**
   * Move camera by screen-space delta (for mouse panning)
   */
  pan(screenDx: number, screenDy: number): void {
    // Convert screen delta to world delta
    this.x -= screenDx / this.zoom;
    this.y -= screenDy / this.zoom;

    // Clamp to world bounds
    this.x = clamp(this.x, 0, WORLD_WIDTH);
    this.y = clamp(this.y, 0, WORLD_HEIGHT);
  }

  /**
   * Set zoom level directly (for debugging/testing)
   */
  setZoom(zoom: number): void {
    this.targetZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  }

  /**
   * Update viewport dimensions on resize
   */
  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const screenX = (worldX - this.x) * this.zoom + this.viewportWidth / 2;
    const screenY = (worldY - this.y) * this.zoom + this.viewportHeight / 2;
    return { x: screenX, y: screenY };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const worldX = (screenX - this.viewportWidth / 2) / this.zoom + this.x;
    const worldY = (screenY - this.viewportHeight / 2) / this.zoom + this.y;
    return { x: worldX, y: worldY };
  }

  /**
   * Get the visible world bounds (useful for culling)
   */
  getVisibleBounds(): { left: number; right: number; top: number; bottom: number } {
    const halfWidth = (this.viewportWidth / 2) / this.zoom;
    const halfHeight = (this.viewportHeight / 2) / this.zoom;
    return {
      left: this.x - halfWidth,
      right: this.x + halfWidth,
      top: this.y - halfHeight,
      bottom: this.y + halfHeight,
    };
  }
}
