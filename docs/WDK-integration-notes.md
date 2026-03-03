# Tether WDK Integration Notes

## SDK Packages
- `@tetherto/wdk` — Core SDK
- `@tetherto/wdk-wallet-evm` — EVM wallet (Ethereum, Polygon, Arbitrum)
- `@tetherto/wdk-wallet-btc` — Bitcoin wallet
- Other: wallet-ton, wallet-tron, wallet-solana, wallet-spark

## Basic Usage
```typescript
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const seed = WDK.getRandomSeedPhrase(24)
const wdk = new WDK(seed)
  .registerWallet('ethereum', WalletManagerEvm, {
    provider: 'https://eth.drpc.org'
  })

const account = await wdk.getAccount('ethereum', 0)
const balance = await account.getBalance()
await account.sendTransaction({ to: '0x...', value: '...' })
```

## Key Properties
- Self-custodial & stateless (private keys never leave the app)
- BIP-39 seed phrase, BIP-44 derivation
- Multi-chain from single seed
- Full TypeScript support

## Blobverse Integration Flow
1. Agent installs Blobverse Skill/MCP package
2. Package triggers wallet creation (WDK seed → EVM account)
3. Show deposit QR code (account address + suggested amount)
4. Poll/listen for deposit confirmation
5. Once confirmed → generate game URL with auth token
6. Agent shares URL → opens in browser → enters lobby
7. Match entry fee deducted from wallet balance
8. Prize pool settled to winners via WDK sendTransaction

## MCP Docs Access
```
claude mcp add wdk-docs --transport sse https://docs.wallet.tether.io/~gitbook/mcp
```

## References
- Docs: https://docs.wdk.tether.io
- SDK Get Started: https://docs.wdk.tether.io/sdk/get-started
- Build with AI: https://docs.wdk.tether.io/start-building/build-with-ai
- MCP Toolkit: https://docs.wdk.tether.io/start-building/mcp-toolkit
