// Blobverse Game Server — Entry Point
// WebSocket game server with matchmaking

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { SERVER_TPS, TICK_INTERVAL_MS } from '@blobverse/shared';
import { RoomManager, Matchmaker, Player } from './game/index.js';
import { arenaManager } from './arena/ArenaManager.js';

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5174')
  .split(',')
  .map(s => s.trim());

// Server state
const roomManager = new RoomManager();
const matchmaker = new Matchmaker(roomManager);

// Client connection tracking
const connections = new Map<WebSocket, { playerId: string | null }>();
const startTime = Date.now();

// =============================================================================
// HTTP Server (Health Check + API)
// =============================================================================

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Routes
  const url = req.url || '/';

  if (url === '/health' || url === '/') {
    const stats = matchmaker.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      connections: connections.size,
      ...stats,
      version: '0.1.0',
    }));
    return;
  }

  if (url === '/rooms') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      rooms: roomManager.getRoomList(),
    }));
    return;
  }

  if (url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(matchmaker.getStats()));
    return;
  }

  // Arena API
  if (url === '/api/arena/current') {
    const match = arenaManager.getCurrentMatch();
    res.writeHead(match ? 200 : 204, { 'Content-Type': 'application/json' });
    res.end(match ? JSON.stringify(match) : '{}');
    return;
  }

  if (url === '/api/arena/history') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ matches: arenaManager.getMatchHistory() }));
    return;
  }

  if (url === '/api/arena/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(arenaManager.getStatus()));
    return;
  }

  const matchRoute = url.match(/^\/api\/arena\/match\/(.+)$/);
  if (matchRoute) {
    const match = arenaManager.getMatchById(matchRoute[1]);
    if (match) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(match));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Match not found' }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// =============================================================================
// WebSocket Server
// =============================================================================

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  connections.set(ws, { playerId: null });
  
  console.log(`[WS] Client connected (total: ${connections.size})`);

  // Handle messages
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (err) {
      console.error('[WS] Invalid message:', err);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    handleDisconnect(ws);
  });

  // Handle errors
  ws.on('error', (err) => {
    console.error('[WS] Error:', err);
    handleDisconnect(ws);
  });
});

// =============================================================================
// Message Handlers
// =============================================================================

function handleMessage(ws: WebSocket, message: any) {
  const { type } = message;
  const conn = connections.get(ws);
  if (!conn) return;

  switch (type) {
    case 'join_queue':
      handleJoinQueue(ws, message);
      break;

    case 'leave_queue':
      handleLeaveQueue(ws);
      break;

    case 'quick_join':
      handleQuickJoin(ws, message);
      break;

    case 'input':
      handleInput(ws, message);
      break;

    case 'ping':
      ws.send(JSON.stringify({
        type: 'pong',
        serverTime: Date.now(),
        clientTime: message.clientTime,
      }));
      break;

    default:
      console.log(`[WS] Unknown message type: ${type}`);
  }
}

function handleJoinQueue(ws: WebSocket, message: any) {
  const { name } = message;
  if (!name || typeof name !== 'string') {
    ws.send(JSON.stringify({ type: 'error', message: 'Name required' }));
    return;
  }

  const player = matchmaker.joinQueue(ws, name);
  
  const conn = connections.get(ws);
  if (conn) {
    conn.playerId = player.id;
  }
}

function handleLeaveQueue(ws: WebSocket) {
  const conn = connections.get(ws);
  if (!conn?.playerId) return;

  matchmaker.leaveQueue(conn.playerId);
  conn.playerId = null;

  ws.send(JSON.stringify({ type: 'queue_left' }));
}

function handleQuickJoin(ws: WebSocket, message: any) {
  const { name } = message;
  if (!name || typeof name !== 'string') {
    ws.send(JSON.stringify({ type: 'error', message: 'Name required' }));
    return;
  }

  const result = matchmaker.quickJoin(ws, name);
  
  if (result) {
    const conn = connections.get(ws);
    if (conn) {
      conn.playerId = result.player.id;
    }
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Could not join room' }));
  }
}

function handleInput(ws: WebSocket, message: any) {
  const conn = connections.get(ws);
  if (!conn?.playerId) return;

  const found = roomManager.findPlayer(conn.playerId);
  if (!found) return;

  const { input } = message;
  if (input) {
    found.room.handleInput(conn.playerId, input);
  }
}

function handleDisconnect(ws: WebSocket) {
  const conn = connections.get(ws);
  
  if (conn?.playerId) {
    // Leave queue if queued
    matchmaker.leaveQueue(conn.playerId);
    
    // Remove from room if in game
    roomManager.removePlayer(conn.playerId);
  }
  
  connections.delete(ws);
  
  console.log(`[WS] Client disconnected (total: ${connections.size})`);
}

// =============================================================================
// Start Server
// =============================================================================

arenaManager.start();

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🟢 Blobverse Game Server                                   ║
║                                                              ║
║   HTTP:      http://localhost:${PORT}                          ║
║   WebSocket: ws://localhost:${PORT}/ws                         ║
║   Health:    http://localhost:${PORT}/health                   ║
║   Rooms:     http://localhost:${PORT}/rooms                    ║
║                                                              ║
║   Tick Rate: ${SERVER_TPS} TPS (${TICK_INTERVAL_MS}ms interval)                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  
  arenaManager.stop();
  matchmaker.stopMatchmaking();
  
  // Close all rooms
  for (const room of roomManager.getRooms()) {
    room.close();
  }
  
  // Close all connections
  for (const [ws] of connections) {
    ws.close(1001, 'Server shutting down');
  }
  
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});
