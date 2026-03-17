// Blobverse — Particle System
// Death animations and effects

import { Container, Graphics } from 'pixi.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

export class ParticleSystem extends Container {
  private particles: Particle[] = [];
  private graphics: Graphics;

  constructor() {
    super();
    this.graphics = new Graphics();
    this.addChild(this.graphics);
  }

  /**
   * Spawn death/pop particles at position
   */
  spawnDeathParticles(x: number, y: number, color: number, count: number = 12): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 100 + Math.random() * 150;
      const size = 2 + Math.random() * 4;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 500 + Math.random() * 300,
        maxLife: 500 + Math.random() * 300,
        size,
        color,
      });
    }
  }

  /**
   * Spawn eat particles (smaller burst)
   */
  spawnEatParticles(x: number, y: number, color: number, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 80;
      const size = 1 + Math.random() * 2;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 300 + Math.random() * 200,
        maxLife: 300 + Math.random() * 200,
        size,
        color,
      });
    }
  }

  /**
   * Update all particles
   */
  update(dt: number): void {
    const dtSeconds = dt / 1000;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.vx *= 0.95; // Friction
      p.vy *= 0.95;
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Redraw
    this.redraw();
  }

  private redraw(): void {
    this.graphics.clear();

    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      this.graphics.circle(p.x, p.y, p.size * alpha);
      this.graphics.fill({ color: p.color, alpha: alpha * 0.8 });
    }
  }

  get particleCount(): number {
    return this.particles.length;
  }
}
