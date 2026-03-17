// Blobverse — Kill Feed
// Displays recent kills/deaths

import { Container, Text, TextStyle } from 'pixi.js';

interface KillEvent {
  killer: string;
  victim: string;
  timestamp: number;
}

const KILL_FEED_DURATION = 4000; // ms
const MAX_VISIBLE = 5;

export class KillFeed extends Container {
  private events: KillEvent[] = [];
  private textNodes: Text[] = [];
  private style: TextStyle;

  constructor() {
    super();

    this.style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fill: 0xFFFFFF,
      dropShadow: {
        alpha: 0.8,
        blur: 2,
        distance: 1,
        color: 0x000000,
      },
    });
  }

  /**
   * Add a kill event
   */
  addKill(killer: string, victim: string): void {
    this.events.push({
      killer,
      victim,
      timestamp: performance.now(),
    });

    // Limit events
    while (this.events.length > MAX_VISIBLE) {
      this.events.shift();
    }

    this.rebuild();
    console.log(`💀 ${killer} ate ${victim}`);
  }

  /**
   * Update (remove old events)
   */
  update(): void {
    const now = performance.now();
    const before = this.events.length;

    this.events = this.events.filter(
      (e) => now - e.timestamp < KILL_FEED_DURATION
    );

    if (this.events.length !== before) {
      this.rebuild();
    }
  }

  private rebuild(): void {
    // Clear old text nodes
    for (const node of this.textNodes) {
      this.removeChild(node);
      node.destroy();
    }
    this.textNodes = [];

    // Create new text nodes
    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];
      const text = new Text({
        text: `${event.killer} 🍽️ ${event.victim}`,
        style: this.style,
      });
      text.anchor.set(1, 0); // Right-align
      text.y = i * 20;
      this.addChild(text);
      this.textNodes.push(text);
    }
  }
}
