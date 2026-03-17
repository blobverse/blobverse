// Blobverse — Input Manager
// Mouse/Touch input → target position in world space

import { Camera } from './Camera';

export interface InputState {
  // Screen coordinates
  screenX: number;
  screenY: number;

  // World coordinates (converted via camera)
  worldX: number;
  worldY: number;

  // Normalized direction from center of screen
  dirX: number;
  dirY: number;
  distance: number; // Distance from center in pixels

  // Button states
  isPointerDown: boolean;
  isSplitPressed: boolean;
  isEjectPressed: boolean;
}

export class Input {
  private canvas: HTMLCanvasElement;
  private camera: Camera;

  // Current state
  readonly state: InputState = {
    screenX: 0,
    screenY: 0,
    worldX: 0,
    worldY: 0,
    dirX: 0,
    dirY: 0,
    distance: 0,
    isPointerDown: false,
    isSplitPressed: false,
    isEjectPressed: false,
  };

  // Callbacks
  onSplit?: () => void;
  onEject?: () => void;

  // Bound listener references (for proper removal)
  private boundPointerMove: (e: MouseEvent) => void;
  private boundPointerDown: (e: MouseEvent) => void;
  private boundPointerUp: (e: MouseEvent | TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundContextMenu: (e: Event) => void;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    this.camera = camera;

    // Bind once, store refs for cleanup
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundContextMenu = (e) => e.preventDefault();

    this.setupListeners();
  }

  private setupListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousemove', this.boundPointerMove);
    this.canvas.addEventListener('mousedown', this.boundPointerDown);
    this.canvas.addEventListener('mouseup', this.boundPointerUp);
    this.canvas.addEventListener('mouseleave', this.boundPointerUp);

    // Touch events
    this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    this.canvas.addEventListener('touchend', this.boundPointerUp);

    // Keyboard events
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    // Prevent context menu on right-click
    this.canvas.addEventListener('contextmenu', this.boundContextMenu);
  }

  private handlePointerMove(e: MouseEvent): void {
    this.updatePointerPosition(e.clientX, e.clientY);
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      this.updatePointerPosition(touch.clientX, touch.clientY);
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.state.isPointerDown = true;
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      this.updatePointerPosition(touch.clientX, touch.clientY);
    }
  }

  private handlePointerDown(e: MouseEvent): void {
    this.state.isPointerDown = true;

    // Right-click = eject
    if (e.button === 2) {
      this.state.isEjectPressed = true;
      this.onEject?.();
    }
  }

  private handlePointerUp(_e: MouseEvent | TouchEvent): void {
    this.state.isPointerDown = false;
    this.state.isEjectPressed = false;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    switch (e.key.toLowerCase()) {
      case ' ':
        if (!this.state.isSplitPressed) {
          this.state.isSplitPressed = true;
          this.onSplit?.();
        }
        break;
      case 'w':
      case 'e':
        if (!this.state.isEjectPressed) {
          this.state.isEjectPressed = true;
          this.onEject?.();
        }
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    switch (e.key.toLowerCase()) {
      case ' ':
        this.state.isSplitPressed = false;
        break;
      case 'w':
      case 'e':
        this.state.isEjectPressed = false;
        break;
    }
  }

  private updatePointerPosition(screenX: number, screenY: number): void {
    this.state.screenX = screenX;
    this.state.screenY = screenY;

    // Convert to world coordinates
    const world = this.camera.screenToWorld(screenX, screenY);
    this.state.worldX = world.x;
    this.state.worldY = world.y;

    // Calculate direction from screen center
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = screenX - centerX;
    const dy = screenY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.state.distance = dist;

    if (dist > 0) {
      this.state.dirX = dx / dist;
      this.state.dirY = dy / dist;
    } else {
      this.state.dirX = 0;
      this.state.dirY = 0;
    }
  }

  /**
   * Get the target world position for the player blob
   */
  getTargetPosition(): { x: number; y: number } {
    return { x: this.state.worldX, y: this.state.worldY };
  }

  /**
   * Get the look direction (normalized)
   */
  getLookDirection(): { x: number; y: number } {
    return { x: this.state.dirX, y: this.state.dirY };
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    this.canvas.removeEventListener('mousemove', this.boundPointerMove);
    this.canvas.removeEventListener('mousedown', this.boundPointerDown);
    this.canvas.removeEventListener('mouseup', this.boundPointerUp);
    this.canvas.removeEventListener('mouseleave', this.boundPointerUp);
    this.canvas.removeEventListener('touchmove', this.boundTouchMove);
    this.canvas.removeEventListener('touchstart', this.boundTouchStart);
    this.canvas.removeEventListener('touchend', this.boundPointerUp);
    this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
  }
}
