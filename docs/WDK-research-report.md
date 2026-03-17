# Tether WDK SDK 深度研究報告

> **Project:** Blobverse Agentic Wallet Integration  
> **Task ID:** T017 (Hackathon-Galactica-WDK)  
> **Date:** 2026-03-04  
> **Author:** Shuri 🔍 (Research Agent)

---

## Executive Summary

Tether WDK (Wallet Development Kit) 是一個模組化的 SDK，專為建構 multi-chain、non-custodial 的 AI Agent 錢包設計。它支援 EVM chains、Bitcoin、Solana、TON、TRON 等主流區塊鏈，並提供 MCP (Model Context Protocol) toolkit 讓 AI agents 能夠安全地執行錢包操作。

**關鍵發現：**
- ✅ 完整的 wallet creation/management API
- ✅ MCP toolkit 支援 AI agent 整合
- ✅ 支援 testnet 測試 (Sepolia, Hardhat, Anvil)
- ✅ x402 HTTP 付款協議整合
- ⚠️ MCP toolkit 尚未發佈到 npm (需從 GitHub 安裝)
- ⚠️ SDK 仍在 beta 階段 (v1.0.0-beta.x)

---

## 1. API Summary Table

### Core Packages

| Package | Version | Description |
|---------|---------|-------------|
| `@tetherto/wdk` | 1.0.0-beta.5 | Core module manager |
| `@tetherto/wdk-wallet-evm` | 1.0.0-beta.8 | EVM wallet (ETH, Polygon, Arbitrum) |
| `@tetherto/wdk-wallet-btc` | beta | Bitcoin wallet |
| `@tetherto/wdk-wallet-solana` | beta | Solana wallet |
| `@tetherto/wdk-wallet-ton` | beta | TON blockchain |
| `@tetherto/wdk-wallet-tron` | beta | TRON blockchain |
| `wdk-mcp-toolkit` | GitHub only | MCP server for AI agents |

### Key Methods

| Method | Module | Description |
|--------|--------|-------------|
| `new WDK(seed)` | @tetherto/wdk | Initialize with BIP-39 seed phrase |
| `wdk.registerWallet(chain, module, config)` | @tetherto/wdk | Register wallet for blockchain |
| `wdk.getAccount(chain, index)` | @tetherto/wdk | Get wallet account by index |
| `wdk.getAccountByPath(chain, path)` | @tetherto/wdk | Get account by BIP-44 path |
| `account.getAddress()` | wallet module | Get deposit address |
| `account.getBalance()` | wallet module | Get native token balance |
| `account.getTokenBalance(contract)` | wallet module | Get ERC20 balance |
| `account.sendTransaction(tx)` | wallet module | Send transaction |
| `account.transfer(params)` | wallet module | Transfer tokens |
| `account.sign(message)` | wallet module | Sign message |
| `account.quoteSendTransaction(tx)` | wallet module | Estimate gas fee |
| `WDK.getRandomSeedPhrase()` | @tetherto/wdk | Generate new seed phrase |
| `WDK.isValidSeedPhrase(phrase)` | @tetherto/wdk | Validate seed phrase |

---

## 2. Wallet Creation Flow

### 2.1 Generate New Wallet (Agent Onboarding)

```typescript
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

// Step 1: Generate new seed phrase (for new agents)
const seedPhrase = WDK.getRandomSeedPhrase()
// => "test only example nut use this real life secret phrase must random"

// Step 2: Validate seed phrase (optional)
const isValid = WDK.isValidSeedPhrase(seedPhrase)
// => true

// Step 3: Initialize WDK with seed
const wdk = new WDK(seedPhrase)

// Step 4: Register wallet module(s)
wdk.registerWallet('ethereum', WalletManagerEvm, {
  provider: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  transferMaxFee: 100000000000000n // Optional: max fee in wei
})

// For testnet (Sepolia)
wdk.registerWallet('sepolia', WalletManagerEvm, {
  provider: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY'
})
```

### 2.2 Get Deposit Address

```typescript
// Get account (default index 0)
const account = await wdk.getAccount('ethereum', 0)

// Get checksummed Ethereum address
const depositAddress = await account.getAddress()
// => "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

// Or use custom derivation path
// Full path: m/44'/60'/0'/0/5
const customAccount = await wdk.getAccountByPath('ethereum', "0'/0/5")
```

### 2.3 QR Code Generation

```typescript
import QRCode from 'qrcode'

const depositAddress = await account.getAddress()

// Generate QR code for deposit
const qrDataUrl = await QRCode.toDataURL(depositAddress)

// Or with EIP-681 payment URI (includes chain info)
const paymentUri = `ethereum:${depositAddress}?chainId=1`
const qrWithChain = await QRCode.toDataURL(paymentUri)
```

---

## 3. Balance Polling & Deposit Detection

### 3.1 Simple Polling

```typescript
async function pollForDeposit(
  account: WalletAccountEvm,
  expectedAmount: bigint,
  intervalMs = 5000,
  timeoutMs = 300000
): Promise<boolean> {
  const startTime = Date.now()
  const initialBalance = await account.getBalance()
  
  while (Date.now() - startTime < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, intervalMs))
    
    const currentBalance = await account.getBalance()
    const delta = currentBalance - initialBalance
    
    if (delta >= expectedAmount) {
      console.log(`Deposit detected: ${delta} wei`)
      return true
    }
  }
  
  return false
}

// Usage
const account = await wdk.getAccount('ethereum', 0)
const deposited = await pollForDeposit(account, 1000000000000000n) // 0.001 ETH
```

### 3.2 Token Balance Polling

```typescript
async function pollTokenDeposit(
  account: WalletAccountEvm,
  tokenContract: string,
  expectedAmount: bigint
): Promise<boolean> {
  const initialBalance = await account.getTokenBalance(tokenContract)
  
  // Poll loop...
  const currentBalance = await account.getTokenBalance(tokenContract)
  const delta = currentBalance - initialBalance
  
  return delta >= expectedAmount
}

// USDT on Ethereum mainnet
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const deposited = await pollTokenDeposit(account, USDT, 1000000n) // 1 USDT (6 decimals)
```

### 3.3 Event-Based Detection (Advanced)

WDK 目前不直接提供 event listener，但可透過 ethers provider 實現：

```typescript
import { ethers } from 'ethers'

// Get the underlying provider
const provider = new ethers.JsonRpcProvider('https://eth-mainnet...')
const address = await account.getAddress()

// Listen for incoming transactions
provider.on('block', async (blockNumber) => {
  const block = await provider.getBlock(blockNumber, true)
  
  for (const tx of block.prefetchedTransactions) {
    if (tx.to?.toLowerCase() === address.toLowerCase()) {
      console.log(`Incoming tx: ${tx.hash}, value: ${tx.value}`)
      // Handle deposit...
    }
  }
})
```

---

## 4. Send Transaction (Prize Settlement)

### 4.1 Native Token Transfer

```typescript
// Send ETH with EIP-1559 (recommended)
const result = await account.sendTransaction({
  to: '0xRecipientAddress...',
  value: 1000000000000000000n, // 1 ETH
  maxFeePerGas: 30000000000n,        // 30 gwei
  maxPriorityFeePerGas: 2000000000n  // 2 gwei
})

console.log('Tx hash:', result.hash)
console.log('Fee paid:', result.fee, 'wei')
```

### 4.2 ERC20 Token Transfer

```typescript
// Transfer USDT
const transferResult = await account.transfer({
  token: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
  recipient: '0xWinnerAddress...',
  amount: 10000000n // 10 USDT (6 decimals)
})

console.log('Transfer hash:', transferResult.hash)
console.log('Fee:', transferResult.fee, 'wei')
```

### 4.3 Fee Estimation

```typescript
// Quote native transfer
const nativeQuote = await account.quoteSendTransaction({
  to: '0x...',
  value: 1000000000000000000n
})
console.log('Estimated fee:', nativeQuote.fee, 'wei')

// Quote token transfer
const tokenQuote = await account.quoteTransfer({
  token: '0x...',
  recipient: '0x...',
  amount: 1000000n
})
console.log('Token transfer fee:', tokenQuote.fee, 'wei')

// Get current fee rates
const feeRates = await wallet.getFeeRates()
console.log('Normal:', feeRates.normal)  // 1.1x base fee
console.log('Fast:', feeRates.fast)      // 2.0x base fee
```

---

## 5. Local Testing Strategy

### 5.1 Sepolia Testnet (Recommended)

```typescript
// Configuration for Sepolia
const config = {
  provider: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY',
  // Or use public RPC:
  // provider: 'https://rpc.sepolia.org'
}

const wdk = new WDK(seedPhrase)
  .registerWallet('sepolia', WalletManagerEvm, config)

// Get Sepolia ETH from faucets:
// - https://sepoliafaucet.com/
// - https://faucet.sepolia.dev/
```

### 5.2 Hardhat Local Node

```bash
# Start local Hardhat node
npx hardhat node
# => Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

# Fund test accounts (Hardhat provides pre-funded accounts)
```

```typescript
const config = {
  provider: 'http://127.0.0.1:8545'
}

const wdk = new WDK(seedPhrase)
  .registerWallet('hardhat', WalletManagerEvm, config)
```

### 5.3 Anvil (Foundry)

```bash
# Start Anvil
anvil
# => Listening on 127.0.0.1:8545

# Or with specific chain ID
anvil --chain-id 31337
```

```typescript
const config = {
  provider: 'http://127.0.0.1:8545'
}
```

### 5.4 Test Suite Example

```typescript
// tests/wallet.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

describe('WDK Wallet Integration', () => {
  let wdk: WDK
  let account: any
  
  beforeAll(async () => {
    // Use deterministic seed for testing
    const testSeed = 'test test test test test test test test test test test junk'
    
    wdk = new WDK(testSeed)
      .registerWallet('local', WalletManagerEvm, {
        provider: 'http://127.0.0.1:8545'
      })
    
    account = await wdk.getAccount('local', 0)
  })
  
  it('should get address', async () => {
    const address = await account.getAddress()
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })
  
  it('should check balance', async () => {
    const balance = await account.getBalance()
    expect(typeof balance).toBe('bigint')
  })
  
  it('should send transaction', async () => {
    const result = await account.sendTransaction({
      to: '0x0000000000000000000000000000000000000001',
      value: 1n
    })
    expect(result.hash).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })
})
```

---

## 6. MCP Toolkit for AI Agents

### 6.1 Installation

```bash
# Currently GitHub-only (not on npm)
npm install github:tetherto/wdk-mcp-toolkit
npm install @modelcontextprotocol/sdk
npm install @tetherto/wdk-wallet-evm
```

### 6.2 Basic MCP Server Setup

```typescript
import { WdkMcpServer, WALLET_TOOLS, PRICING_TOOLS } from '@tetherto/wdk-mcp-toolkit'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const server = new WdkMcpServer('blobverse-wallet', '1.0.0')
  .useWdk({ seed: process.env.WDK_SEED })
  .registerWallet('ethereum', WalletManagerEvm, {
    provider: 'https://eth-mainnet.g.alchemy.com/v2/...'
  })
  .usePricing()
  .registerTools([...WALLET_TOOLS, ...PRICING_TOOLS])

const transport = new StdioServerTransport()
await server.connect(transport)
```

### 6.3 Available Tool Categories

| Tool Category | Tools | Requires |
|--------------|-------|----------|
| `WALLET_READ_TOOLS` | getAddress, getBalance, quoteSendTransaction | `useWdk()` |
| `WALLET_WRITE_TOOLS` | sendTransaction, transfer, sign | `useWdk()` + Elicitations |
| `PRICING_TOOLS` | getPrice, getPrices | `usePricing()` |
| `INDEXER_TOOLS` | getTransactionHistory | `useIndexer()` |
| `SWAP_TOOLS` | swap, quoteSwap | `registerProtocol()` |
| `BRIDGE_TOOLS` | bridge, quoteBridge | `registerProtocol()` |

### 6.4 Custom Token Registration

```typescript
server
  .registerToken('ethereum', 'USDT', {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6
  })
  .registerToken('ethereum', 'USDC', {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6
  })
```

---

## 7. x402 HTTP Payment Protocol

### 7.1 Overview

x402 是 Coinbase 開發的 HTTP 原生付款協議，基於 HTTP 402 "Payment Required" 狀態碼。它允許 AI agents 在不需要 API key 或帳戶的情況下，直接以 stablecoins 付款取得 API 存取權。

**Key Features:**
- Zero protocol fees (只有 network gas fees)
- Zero friction (不需要 KYC/帳戶)
- HTTP-native (內建於 HTTP 請求)
- Multi-chain support

### 7.2 Server-Side Integration

```typescript
import express from 'express'
import { paymentMiddleware } from '@x402/middleware'

const app = express()

app.use(
  paymentMiddleware({
    'GET /api/premium-data': {
      accepts: [
        { network: 'base', currency: 'USDC', amount: '0.001' },
        { network: 'ethereum', currency: 'USDT', amount: '0.001' }
      ],
      description: 'Access to premium data endpoint'
    }
  })
)

app.get('/api/premium-data', (req, res) => {
  res.json({ data: 'Premium content' })
})
```

### 7.3 Client-Side (Agent) Integration

```typescript
// When agent receives HTTP 402:
// 1. Parse payment requirements from response
// 2. Use WDK to send payment
// 3. Retry request with payment proof

async function handlePaymentRequired(response: Response) {
  const paymentInfo = await response.json()
  
  // Pay using WDK
  const account = await wdk.getAccount('base', 0)
  const result = await account.transfer({
    token: paymentInfo.tokenAddress,
    recipient: paymentInfo.payTo,
    amount: BigInt(paymentInfo.amount)
  })
  
  // Retry with payment proof
  return fetch(originalUrl, {
    headers: {
      'X-402-Payment-Proof': result.hash
    }
  })
}
```

---

## 8. Recommended Chain Selection

### For Blobverse (Hackathon)

| Chain | Use Case | Pros | Cons |
|-------|----------|------|------|
| **Base** (recommended) | Production | Low fees, fast, Coinbase backing, x402 native | Newer ecosystem |
| **Arbitrum** | Production | Low fees, mature ecosystem | Slightly higher fees than Base |
| **Polygon** | Production | Very low fees, wide adoption | Occasional congestion |
| **Sepolia** | Testing | Free testnet ETH | Testnet only |
| **Ethereum** | High-value only | Maximum security | High gas fees |

**Recommendation:** Use **Base** for production (best x402 support, low fees) with **Sepolia** for testing.

---

## 9. Agent Onboarding Flow (Technical Feasibility)

### 9.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Blobverse Backend                        │
├─────────────────────────────────────────────────────────────┤
│  1. Agent Registration API                                  │
│     - Generate unique seed phrase per agent                 │
│     - Store encrypted seed in secure vault                  │
│     - Return agent_id + deposit address                     │
├─────────────────────────────────────────────────────────────┤
│  2. Deposit Detection Service                               │
│     - Poll for deposits OR subscribe to events              │
│     - Credit agent balance on confirmation                  │
├─────────────────────────────────────────────────────────────┤
│  3. Prize Settlement Service                                │
│     - Validate game results                                 │
│     - Execute batch transfers                               │
│     - Handle gas estimation + fee deduction                 │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Implementation Steps

```typescript
// 1. Create Agent Wallet
async function createAgentWallet(): Promise<AgentWallet> {
  const seedPhrase = WDK.getRandomSeedPhrase()
  const wdk = new WDK(seedPhrase)
    .registerWallet('base', WalletManagerEvm, baseConfig)
  
  const account = await wdk.getAccount('base', 0)
  const address = await account.getAddress()
  
  // Encrypt and store seed securely
  const encryptedSeed = await encryptSeed(seedPhrase)
  await db.agents.create({
    address,
    encryptedSeed,
    balance: 0n
  })
  
  return { address, wdk, account }
}

// 2. Generate Deposit QR
async function getDepositQR(agentId: string): Promise<string> {
  const agent = await db.agents.findById(agentId)
  return QRCode.toDataURL(agent.address)
}

// 3. Settlement
async function settlePrize(agentId: string, winnerId: string, amount: bigint) {
  const agent = await getAgentWallet(agentId)
  const winner = await db.users.findById(winnerId)
  
  const result = await agent.account.transfer({
    token: USDT_ADDRESS,
    recipient: winner.walletAddress,
    amount
  })
  
  return result.hash
}
```

---

## 10. Risk Assessment

### High Risk ⚠️

| Risk | Impact | Mitigation |
|------|--------|------------|
| **SDK Beta Status** | Breaking changes | Pin versions, thorough testing |
| **Seed Phrase Leakage** | Total fund loss | HSM/KMS, never log seeds |
| **Transaction Failure** | Stuck funds | Implement retry logic, nonce management |

### Medium Risk ⚡

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Gas Price Spikes** | High fees | Gas estimation, fee caps |
| **RPC Provider Downtime** | Service interruption | Multiple provider fallbacks |
| **Network Congestion** | Slow settlements | Priority fees, L2 chains |

### Low Risk ✓

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Package Updates** | Minor breakage | Lock dependencies |
| **API Rate Limits** | Throttling | Connection pooling |

---

## 11. Next Steps

1. **Phase 1: Setup (Day 1)**
   - [ ] Install WDK packages
   - [ ] Configure Sepolia testnet
   - [ ] Implement basic wallet creation

2. **Phase 2: Core Features (Day 2-3)**
   - [ ] Deposit address generation + QR
   - [ ] Balance polling service
   - [ ] Transaction settlement

3. **Phase 3: AI Integration (Day 4)**
   - [ ] MCP server setup
   - [ ] Agent wallet binding
   - [ ] x402 integration (if time permits)

4. **Phase 4: Testing & Polish (Day 5)**
   - [ ] End-to-end testing on Sepolia
   - [ ] Error handling
   - [ ] Deploy to Base mainnet

---

## References

- [WDK Documentation](https://docs.wdk.tether.io)
- [WDK GitHub](https://github.com/tetherto/wdk-core)
- [WDK MCP Toolkit](https://github.com/tetherto/wdk-mcp-toolkit)
- [x402 Protocol](https://www.x402.org)
- [x402 Docs](https://docs.x402.org)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

*Report generated by Shuri 🔍 | Research & QA Agent*
