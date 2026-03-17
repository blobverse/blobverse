// NetworkUI — HUD overlay for network stats

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Network, NetworkStats } from './Network.js';

export class NetworkUI {
  private container: Container;
  private network: Network;
  
  // UI Elements
  private background: Graphics;
  private pingText: Text;
  private stateText: Text;
  private fpsText: Text;
  
  // Config
  private visible = true;
  private updateInterval = 500; // Update every 500ms
  private lastUpdate = 0;
  
  // FPS tracking
  private frameCount = 0;
  private fpsStartTime = Date.now();
  private currentFps = 60;
  
  constructor(network: Network) {
    this.network = network;
    this.container = new Container();
    this.container.zIndex = 1000;
    
    // Background panel
    this.background = new Graphics();
    this.background.roundRect(0, 0, 140, 70, 8);
    this.background.fill({ color: 0x000000, alpha: 0.6 });
    this.container.addChild(this.background);
    
    // Text style
    const style = new TextStyle({
      fontSize: 12,
      fontFamily: 'monospace',
      fill: 0xFFFFFF,
    });
    
    // Ping text
    this.pingText = new Text({ text: 'PING: --ms', style });
    this.pingText.position.set(10, 8);
    this.container.addChild(this.pingText);
    
    // State text
    this.stateText = new Text({ text: 'STATE: --', style });
    this.stateText.position.set(10, 28);
    this.container.addChild(this.stateText);
    
    // FPS text
    this.fpsText = new Text({ text: 'FPS: --', style });
    this.fpsText.position.set(10, 48);
    this.container.addChild(this.fpsText);
  }
  
  getContainer(): Container {
    return this.container;
  }
  
  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }
  
  toggle(): void {
    this.visible = !this.visible;
    this.container.visible = this.visible;
  }
  
  update(dt: number): void {
    // Track FPS
    this.frameCount++;
    const fpsElapsed = Date.now() - this.fpsStartTime;
    if (fpsElapsed >= 1000) {
      this.currentFps = Math.round(this.frameCount * 1000 / fpsElapsed);
      this.frameCount = 0;
      this.fpsStartTime = Date.now();
    }
    
    // Throttle UI updates
    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) return;
    this.lastUpdate = now;
    
    const stats = this.network.getStats();
    
    // Update ping with color coding
    const pingColor = this.getPingColor(stats.ping);
    this.pingText.text = `PING: ${stats.ping}ms ±${stats.jitter}`;
    this.pingText.style.fill = pingColor;
    
    // Update state
    const stateEmoji = this.getStateEmoji(stats.connectionState);
    this.stateText.text = `${stateEmoji} ${stats.connectionState.toUpperCase()}`;
    
    // Update FPS with color coding
    const fpsColor = this.getFpsColor(this.currentFps);
    this.fpsText.text = `FPS: ${this.currentFps}`;
    this.fpsText.style.fill = fpsColor;
  }
  
  private getPingColor(ping: number): number {
    if (ping < 50) return 0x00FF00;  // Green
    if (ping < 100) return 0xFFFF00; // Yellow
    if (ping < 200) return 0xFFA500; // Orange
    return 0xFF0000;                  // Red
  }
  
  private getFpsColor(fps: number): number {
    if (fps >= 55) return 0x00FF00;  // Green
    if (fps >= 30) return 0xFFFF00;  // Yellow
    return 0xFF0000;                  // Red
  }
  
  private getStateEmoji(state: string): string {
    switch (state) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'reconnecting': return '🟠';
      case 'disconnected': return '🔴';
      default: return '⚪';
    }
  }
  
  destroy(): void {
    this.container.destroy({ children: true });
  }
}
