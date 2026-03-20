// Blobverse Game Server — Entry Point
// WebSocket game server with matchmaking

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { SERVER_TPS, TICK_INTERVAL_MS } from '@blobverse/shared';
import { RoomManager, Matchmaker, Player } from './game/index.js';
import { arenaManager } from './arena/ArenaManager.js';
import { wdkManager, ENTRY_FEE_USD, escrowManager } from './wallet/index.js';

// Static file serving for production
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLIENT_DIST = join(__dirname, '../../client/dist');
const SERVE_STATIC = existsSync(join(CLIENT_DIST, 'index.html'));

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    return {};
  }
}

function serveStaticFile(url: string, res: ServerResponse): boolean {
  if (!SERVE_STATIC) return false;
  const filePath = join(CLIENT_DIST, url === '/' ? 'index.html' : url);
  // Prevent directory traversal
  if (!filePath.startsWith(CLIENT_DIST)) return false;
  try {
    const stat = statSync(filePath);
    if (stat.isFile()) {
      const ext = extname(filePath);
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content);
      return true;
    }
  } catch {}
  return false;
}

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

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Routes
  const url = req.url || '/';

  if (url === '/health' || (url === '/' && !SERVE_STATIC)) {
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
    if (!match) {
      res.writeHead(204, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }
    // Strip pellets from replay frames to reduce payload (~10MB → ~500KB)
    // ArenaView only uses blob positions, leaderboard, and round info
    const lite = {
      ...match,
      replayFrames: match.replayFrames.map(f => ({
        ...f,
        pellets: [],
      })),
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(lite));
    return;
  }

  if (url === '/api/arena/history') {
    const history = arenaManager.getMatchHistory().map(m => ({
      ...m,
      replayFrames: [], // strip replay data from history listing
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ matches: history }));
    return;
  }

  if (url === '/api/arena/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(arenaManager.getStatus()));
    return;
  }

  // Escrow info for QR code display
  if (url === '/api/arena/escrow-info') {
    const escrowAddress = await wdkManager.getEscrowAddress();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      escrowAddress,
      entryFeeUsd: ENTRY_FEE_USD,
      network: 'Polygon',
      token: 'USDC',
      dryRun: wdkManager.isDryRun,
    }));
    return;
  }

  // Get agents with odds for betting UI
  if (url === '/api/arena/agents') {
    const agents = arenaManager.getAgentsForBetting();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ agents, dryRun: wdkManager.isDryRun }));
    return;
  }

  // Place a bet on an agent
  if (url === '/api/arena/bet' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const agentName = body.agentName as string;
    const amount = body.amount as number;
    if (!agentName || typeof amount !== 'number' || amount <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'agentName and positive amount required' }));
      return;
    }
    const bet = arenaManager.placeBet(agentName, amount);
    if (!bet) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No match available for betting' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, bet, dryRun: wdkManager.isDryRun }));
    return;
  }

  // Settle a bet — check if user won
  if (url?.startsWith('/api/arena/bet/') && req.method === 'GET') {
    const betId = url.split('/api/arena/bet/')[1];
    const bet = arenaManager.getBet(betId);
    if (!bet) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bet not found' }));
      return;
    }
    // Auto-settle if not yet settled
    if (!bet.settled) {
      arenaManager.settleBet(betId);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ bet }));
    return;
  }

  const matchRoute = url.match(/^\/api\/arena\/match\/(.+)$/);
  if (matchRoute) {
    const match = arenaManager.getMatchById(matchRoute[1]);
    if (match) {
      const lite = {
        ...match,
        replayFrames: match.replayFrames.map(f => ({ ...f, pellets: [] })),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(lite));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Match not found' }));
    }
    return;
  }

  // Wallet API
  if (url === '/api/wallet/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      dryRun: wdkManager.isDryRun,
      agentWallets: wdkManager.getAllAgentWallets(),
    }));
    return;
  }

  if (url === '/api/wallet/settlements') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      settlements: escrowManager.getRecentSettlements(),
    }));
    return;
  }

  const settlementRoute = url.match(/^\/api\/wallet\/settlement\/(.+)$/);
  if (settlementRoute) {
    const summary = escrowManager.getSettlementSummary(settlementRoute[1]);
    if (summary) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(summary));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Settlement not found' }));
    }
    return;
  }

  // Try serving static files (production: client dist)
  if (serveStaticFile(url, res)) return;

  // SPA fallback: serve index.html for non-API routes
  if (SERVE_STATIC && !url.startsWith('/api/')) {
    try {
      const html = readFileSync(join(CLIENT_DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    } catch {}
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

// Initialize WDK wallets (async, non-blocking)
wdkManager.initialize().then(() => {
  arenaManager.start();
}).catch(err => {
  console.error('[WDK] Init error, starting arena without wallet:', err);
  arenaManager.start();
});

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
