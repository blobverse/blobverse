// Network — WebSocket client with prediction and interpolation

import {
  ClientMessage,
  ServerMessage,
  GameStateSnapshot,
  BlobSnapshot,
} from '@blobverse/shared';

// =============================================================================
// Types
// =============================================================================

export interface NetworkConfig {
  url: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  interpolationDelay?: number; // ms behind server time
  predictionEnabled?: boolean;
}

export interface NetworkStats {
  ping: number;
  jitter: number;
  packetLoss: number;
  serverTime: number;
  clientTime: number;
  connectionState: ConnectionState;
  messagesPerSecond: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// Input with sequence number for reconciliation
export interface PendingInput {
  seq: number;
  tick: number;
  targetX: number;
  targetY: number;
  timestamp: number;
}

// Interpolation buffer entry
export interface StateSnapshot {
  timestamp: number;
  serverTick: number;
  blobs: Map<string, BlobSnapshot>;
}

// =============================================================================
// Network Manager
// =============================================================================

export class Network {
  private config: Required<NetworkConfig>;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: number | null = null;
  
  // Identity
  private playerId: string | null = null;
  private roomId: string | null = null;
  
  // Timing & Sync
  private serverTimeOffset = 0; // server time = client time + offset
  private pingHistory: number[] = [];
  private lastPingTime = 0;
  private pingInterval: number | null = null;
  
  // Client-side prediction
  private inputSeq = 0;
  private pendingInputs: PendingInput[] = [];
  private lastAckedSeq = 0;
  
  // Entity interpolation
  private stateBuffer: StateSnapshot[] = [];
  private maxBufferSize = 60; // ~3 seconds at 20 TPS
  
  // Stats
  private messageCount = 0;
  private lastStatsReset = Date.now();
  
  // Callbacks
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onStateUpdate?: (state: GameStateSnapshot, interpolated: Map<string, BlobSnapshot>) => void;
  onRoundStart?: (round: number, duration: number) => void;
  onRoundEnd?: (round: number, eliminated: string[]) => void;
  onGameOver?: (payload: import('@blobverse/shared').GameOverPayload) => void;
  onKillFeed?: (killerId: string, killedId: string) => void;
  onError?: (error: string) => void;
  
  constructor(config: NetworkConfig) {
    this.config = {
      url: config.url,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      interpolationDelay: config.interpolationDelay ?? 100, // 100ms interpolation delay
      predictionEnabled: config.predictionEnabled ?? true,
    };
  }
  
  // ===========================================================================
  // Connection Management
  // ===========================================================================
  
  connect(): void {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }
    
    this.connectionState = 'connecting';
    
    try {
      this.ws = new WebSocket(this.config.url);
      
      this.ws.onopen = () => this.handleOpen();
      this.ws.onclose = (e) => this.handleClose(e);
      this.ws.onerror = (e) => this.handleError(e);
      this.ws.onmessage = (e) => this.handleMessage(e);
    } catch (err) {
      console.error('[Network] Failed to connect:', err);
      this.scheduleReconnect();
    }
  }
  
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }
    
    this.connectionState = 'disconnected';
    this.playerId = null;
    this.roomId = null;
  }
  
  private handleOpen(): void {
    console.log('[Network] Connected');
    this.connectionState = 'connected';
    this.reconnectAttempts = 0;
    
    // Start ping interval
    this.startPingInterval();
    
    this.onConnect?.();
  }
  
  private handleClose(event: CloseEvent): void {
    console.log(`[Network] Disconnected: ${event.code} ${event.reason}`);
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    this.onDisconnect?.(event.reason || 'Connection closed');
    
    // Attempt reconnect if not intentional
    if (event.code !== 1000) {
      this.scheduleReconnect();
    } else {
      this.connectionState = 'disconnected';
    }
  }
  
  private handleError(event: Event): void {
    console.error('[Network] WebSocket error:', event);
    this.onError?.('WebSocket error');
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[Network] Max reconnect attempts reached');
      this.connectionState = 'disconnected';
      this.onError?.('Failed to reconnect');
      return;
    }
    
    this.connectionState = 'reconnecting';
    this.reconnectAttempts++;
    
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[Network] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  // ===========================================================================
  // Message Handling
  // ===========================================================================
  
  private handleMessage(event: MessageEvent): void {
    this.messageCount++;
    
    try {
      const message = JSON.parse(event.data) as ServerMessage;
      
      switch (message.type) {
        case 'welcome':
          this.handleWelcome(message.payload);
          break;
          
        case 'state':
          this.handleState(message.payload);
          break;
          
        case 'round_start':
          this.onRoundStart?.(message.payload.round, message.payload.duration);
          break;
          
        case 'round_end':
          this.onRoundEnd?.(message.payload.round, message.payload.eliminated);
          break;
          
        case 'game_over':
          this.onGameOver?.(message.payload);
          break;
          
        case 'kill_feed':
          this.onKillFeed?.(message.payload.killerId, message.payload.killedId);
          break;
          
        case 'pong':
          this.handlePong(message.payload);
          break;
      }
    } catch (err) {
      console.error('[Network] Failed to parse message:', err);
    }
  }
  
  private handleWelcome(payload: { playerId: string; roomId: string }): void {
    this.playerId = payload.playerId;
    this.roomId = payload.roomId;
    console.log(`[Network] Joined room ${payload.roomId} as ${payload.playerId}`);
  }
  
  private handleState(state: GameStateSnapshot): void {
    const now = Date.now();
    
    // Add to interpolation buffer
    const snapshot: StateSnapshot = {
      timestamp: now,
      serverTick: state.tick,
      blobs: new Map(state.blobs.map(b => [b.id, b])),
    };
    
    this.stateBuffer.push(snapshot);
    
    // Trim buffer
    while (this.stateBuffer.length > this.maxBufferSize) {
      this.stateBuffer.shift();
    }
    
    // Server reconciliation for local player
    if (this.config.predictionEnabled && this.playerId) {
      this.reconcile(state);
    }
    
    // Interpolate other entities
    const interpolated = this.interpolate();
    
    // Notify listeners
    this.onStateUpdate?.(state, interpolated);
  }
  
  private handlePong(payload: { timestamp: number; serverTime: number }): void {
    const now = Date.now();
    const rtt = now - payload.timestamp;
    const ping = rtt / 2;
    
    // Update ping history
    this.pingHistory.push(ping);
    if (this.pingHistory.length > 10) {
      this.pingHistory.shift();
    }
    
    // Calculate server time offset
    this.serverTimeOffset = payload.serverTime - now + ping;
  }
  
  // ===========================================================================
  // Client-Side Prediction
  // ===========================================================================
  
  /**
   * Send input and store for reconciliation
   */
  sendInput(targetX: number, targetY: number): void {
    if (!this.isConnected()) return;
    
    const input: PendingInput = {
      seq: ++this.inputSeq,
      tick: this.getServerTick(),
      targetX,
      targetY,
      timestamp: Date.now(),
    };
    
    // Store for reconciliation
    if (this.config.predictionEnabled) {
      this.pendingInputs.push(input);
      
      // Limit pending inputs
      while (this.pendingInputs.length > 60) {
        this.pendingInputs.shift();
      }
    }
    
    // Send to server
    this.send({
      type: 'input',
      payload: { targetX, targetY },
    });
  }
  
  /**
   * Reconcile local state with server state
   */
  private reconcile(serverState: GameStateSnapshot): void {
    if (!this.playerId) return;
    
    const serverBlob = serverState.blobs.find(b => b.id === this.playerId);
    if (!serverBlob) return;
    
    // Remove acknowledged inputs
    // In a full implementation, server would send last processed input seq
    // For now, we use time-based cleanup
    const cutoffTime = Date.now() - 1000; // Remove inputs older than 1s
    this.pendingInputs = this.pendingInputs.filter(i => i.timestamp > cutoffTime);
  }
  
  /**
   * Apply prediction to local player
   */
  predictLocalPlayer(currentX: number, currentY: number, dt: number): { x: number; y: number } {
    if (!this.config.predictionEnabled || this.pendingInputs.length === 0) {
      return { x: currentX, y: currentY };
    }
    
    // Get most recent input
    const lastInput = this.pendingInputs[this.pendingInputs.length - 1];
    
    // Simple prediction: move towards target
    const dx = lastInput.targetX - currentX;
    const dy = lastInput.targetY - currentY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 5) {
      return { x: currentX, y: currentY };
    }
    
    // Apply movement (simplified, should use actual physics)
    const speed = 200; // Base speed
    const moveX = (dx / dist) * speed * dt;
    const moveY = (dy / dist) * speed * dt;
    
    return {
      x: currentX + moveX,
      y: currentY + moveY,
    };
  }
  
  // ===========================================================================
  // Entity Interpolation
  // ===========================================================================
  
  /**
   * Interpolate entities between server snapshots
   */
  interpolate(): Map<string, BlobSnapshot> {
    const result = new Map<string, BlobSnapshot>();
    
    if (this.stateBuffer.length < 2) {
      // Not enough data, return most recent
      const latest = this.stateBuffer[this.stateBuffer.length - 1];
      return latest?.blobs ?? result;
    }
    
    // Target render time (behind server time for smoothness)
    const renderTime = Date.now() - this.config.interpolationDelay;
    
    // Find two snapshots to interpolate between
    let before: StateSnapshot | null = null;
    let after: StateSnapshot | null = null;
    
    for (let i = 0; i < this.stateBuffer.length - 1; i++) {
      if (this.stateBuffer[i].timestamp <= renderTime && 
          this.stateBuffer[i + 1].timestamp >= renderTime) {
        before = this.stateBuffer[i];
        after = this.stateBuffer[i + 1];
        break;
      }
    }
    
    // If no valid pair found, use most recent
    if (!before || !after) {
      const latest = this.stateBuffer[this.stateBuffer.length - 1];
      return latest?.blobs ?? result;
    }
    
    // Calculate interpolation factor (0 to 1)
    const range = after.timestamp - before.timestamp;
    const t = range > 0 ? (renderTime - before.timestamp) / range : 0;
    const clampedT = Math.max(0, Math.min(1, t));
    
    // Interpolate each entity
    for (const [id, afterBlob] of after.blobs) {
      const beforeBlob = before.blobs.get(id);
      
      if (!beforeBlob) {
        // Entity is new, use after state
        result.set(id, afterBlob);
        continue;
      }
      
      // Skip interpolation for local player (uses prediction)
      if (id === this.playerId && this.config.predictionEnabled) {
        result.set(id, afterBlob);
        continue;
      }
      
      // Interpolate position
      const interpolated: BlobSnapshot = {
        ...afterBlob,
        x: this.lerp(beforeBlob.x, afterBlob.x, clampedT),
        y: this.lerp(beforeBlob.y, afterBlob.y, clampedT),
        radius: this.lerp(beforeBlob.radius, afterBlob.radius, clampedT),
        // Interpolate fragment positions too
        fragments: afterBlob.fragments.map((frag, i) => {
          const beforeFrag = beforeBlob.fragments[i];
          if (!beforeFrag) return frag;
          
          return {
            ...frag,
            x: this.lerp(beforeFrag.x, frag.x, clampedT),
            y: this.lerp(beforeFrag.y, frag.y, clampedT),
            radius: this.lerp(beforeFrag.radius, frag.radius, clampedT),
          };
        }),
      };
      
      result.set(id, interpolated);
    }
    
    return result;
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  
  // ===========================================================================
  // Sending Messages
  // ===========================================================================
  
  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  join(name: string): void {
    this.send({ type: 'join', payload: { name } });
  }
  
  split(dirX: number, dirY: number): void {
    this.send({ type: 'split', payload: { dirX, dirY } });
  }
  
  eject(dirX: number, dirY: number): void {
    this.send({ type: 'eject', payload: { dirX, dirY } });
  }
  
  spectatePellet(targetX: number, targetY: number): void {
    this.send({ type: 'spectate_pellet', payload: { targetX, targetY } });
  }
  
  // ===========================================================================
  // Ping & Stats
  // ===========================================================================
  
  private startPingInterval(): void {
    // Send ping every 2 seconds
    this.pingInterval = window.setInterval(() => {
      this.sendPing();
    }, 2000);
    
    // Initial ping
    this.sendPing();
  }
  
  private sendPing(): void {
    this.lastPingTime = Date.now();
    this.send({ type: 'ping', payload: { timestamp: this.lastPingTime } });
  }
  
  getStats(): NetworkStats {
    const now = Date.now();
    const elapsed = (now - this.lastStatsReset) / 1000;
    const mps = elapsed > 0 ? this.messageCount / elapsed : 0;
    
    // Reset stats every 5 seconds
    if (elapsed > 5) {
      this.messageCount = 0;
      this.lastStatsReset = now;
    }
    
    const ping = this.getAveragePing();
    
    return {
      ping,
      jitter: this.getJitter(),
      packetLoss: 0, // Would need sequence tracking
      serverTime: this.getServerTime(),
      clientTime: now,
      connectionState: this.connectionState,
      messagesPerSecond: Math.round(mps * 10) / 10,
    };
  }
  
  getAveragePing(): number {
    if (this.pingHistory.length === 0) return 0;
    const sum = this.pingHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.pingHistory.length);
  }
  
  getJitter(): number {
    if (this.pingHistory.length < 2) return 0;
    
    let variance = 0;
    const avg = this.getAveragePing();
    
    for (const ping of this.pingHistory) {
      variance += Math.pow(ping - avg, 2);
    }
    
    return Math.round(Math.sqrt(variance / this.pingHistory.length));
  }
  
  getServerTime(): number {
    return Date.now() + this.serverTimeOffset;
  }
  
  getServerTick(): number {
    // Assuming 20 TPS
    return Math.floor(this.getServerTime() / 50);
  }
  
  // ===========================================================================
  // Getters
  // ===========================================================================
  
  isConnected(): boolean {
    return this.connectionState === 'connected' && 
           this.ws?.readyState === WebSocket.OPEN;
  }
  
  getPlayerId(): string | null {
    return this.playerId;
  }
  
  getRoomId(): string | null {
    return this.roomId;
  }
  
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
}
