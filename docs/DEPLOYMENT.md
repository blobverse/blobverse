# Blobverse — Deployment Guide

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  blobverse.game │     │ Railway Static  │
│   (CDN/Static)  │     │    (Client)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    WebSocket (wss)    │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   Railway Container   │
         │      (Server)         │
         │   blobverse-server    │
         └───────────────────────┘
```

## Railway Setup

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init
```

### 2. Add Services

**Server Service:**
```bash
# From monorepo root
railway add --name blobverse-server
```

**Client Service (Static):**
```bash
railway add --name blobverse-client --static
```

### 3. Configure Environment Variables

**Server:**
| Variable | Value | Description |
|----------|-------|-------------|
| `PORT` | `3000` | Server port (Railway sets automatically) |
| `NODE_ENV` | `production` | Environment |
| `ALLOWED_ORIGINS` | `https://blobverse.game,https://blobverse-client.up.railway.app` | CORS origins |

**Client (Build-time):**
| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_WS_URL` | `wss://blobverse-server-production.up.railway.app` | WebSocket URL |
| `VITE_API_URL` | `https://blobverse-server-production.up.railway.app` | API URL |

### 4. Deploy

**Manual Deploy:**
```bash
# Deploy server
cd packages/server
railway up

# Deploy client
cd packages/client
railway up
```

**Auto Deploy (GitHub):**
1. Link Railway to GitHub repo
2. Set deploy branch to `main`
3. Push triggers deploy automatically

### 5. Custom Domain

```bash
# Add custom domain
railway domain add blobverse.game

# Add DNS records:
# CNAME @ → blobverse-client.up.railway.app
# CNAME api → blobverse-server.up.railway.app
```

## GitHub Actions Setup

### Required Secrets

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway API token (from dashboard) |

### Required Variables

| Variable | Description |
|----------|-------------|
| `VITE_WS_URL` | Production WebSocket URL |
| `VITE_API_URL` | Production API URL |

### Workflow

Push to `main` triggers:
1. ✅ Type check
2. ✅ Run tests
3. ✅ Build all packages
4. 🚀 Deploy server to Railway
5. 🚀 Deploy client to Railway

## Local Development

```bash
# Start both server and client
pnpm dev

# Or separately:
pnpm dev:server  # http://localhost:3000
pnpm dev:client  # http://localhost:5174
```

## Health Checks

**Server Health:**
```bash
curl https://blobverse-server.up.railway.app/health
```

Response:
```json
{
  "status": "ok",
  "uptime": 3600,
  "clients": 15,
  "ticks": 72000,
  "version": "0.1.0"
}
```

## Scaling

Railway supports horizontal scaling:

```toml
# railway.toml
[deploy]
numReplicas = 3
```

⚠️ Note: WebSocket connections are stateful. For multiple replicas, you'll need:
- Redis for pub/sub
- Sticky sessions or connection routing

## Troubleshooting

### WebSocket Connection Failed

1. Check CORS origins in server env
2. Verify client uses correct `wss://` URL
3. Check Railway logs: `railway logs`

### Build Failed

```bash
# Check build locally
pnpm --filter @blobverse/server build
pnpm --filter @blobverse/client build
```

### Container OOM

Increase memory in Railway dashboard or:
```toml
[deploy]
# Request more memory
```
