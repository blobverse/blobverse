// WDK Manager — Wallet lifecycle for AI Agents in Arena Mode
// Each agent gets a derived account from a master seed phrase.
// The escrow wallet collects entry fees and distributes prizes.

import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const POLYGON_RPC = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const MASTER_SEED = process.env.WDK_MASTER_SEED || '';
const ESCROW_SEED = process.env.WDK_ESCROW_SEED || '';

// Polygon USDC (native)
export const USDC_CONTRACT = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

// Entry fee in USDC base units (6 decimals). $0.25 = 250_000
export const ENTRY_FEE_UNITS = 250_000n;
export const ENTRY_FEE_USD = 0.25;

// Prize distribution percentages
export const PRIZE_DISTRIBUTION = {
  first: 0.50,
  second: 0.25,
  third: 0.15,
  platform: 0.10,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentWallet {
  agentId: string;
  accountIndex: number;
  address: string;
}

// ---------------------------------------------------------------------------
// WDKManager
// ---------------------------------------------------------------------------

export class WDKManager {
  private agentWdk: WDK | null = null;
  private escrowWdk: WDK | null = null;
  private agentWallets = new Map<string, AgentWallet>();
  private nextAccountIndex = 0;
  private initialized = false;

  /**
   * Initialize WDK with master seed for agents and escrow seed for prize pool.
   * If seeds are not provided (dev mode), operates in mock/dry-run mode.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!MASTER_SEED || !ESCROW_SEED) {
      console.log('[WDK] No seed phrases configured — running in DRY-RUN mode');
      console.log('[WDK] Set WDK_MASTER_SEED and WDK_ESCROW_SEED env vars for real transactions');
      this.initialized = true;
      return;
    }

    try {
      // Agent wallets — all agents derive from the same master seed, different indices
      this.agentWdk = new WDK(MASTER_SEED)
        .registerWallet('polygon', WalletManagerEvm, {
          provider: POLYGON_RPC,
          transferMaxFee: 100_000_000_000_000, // 0.0001 ETH max fee
        });

      // Escrow wallet — separate seed for prize pool
      this.escrowWdk = new WDK(ESCROW_SEED)
        .registerWallet('polygon', WalletManagerEvm, {
          provider: POLYGON_RPC,
          transferMaxFee: 100_000_000_000_000,
        });

      this.initialized = true;
      const escrowAccount = await this.escrowWdk.getAccount('polygon', 0);
      const escrowAddress = await escrowAccount.getAddress();
      console.log(`[WDK] Initialized. Escrow address: ${escrowAddress}`);
    } catch (err) {
      console.error('[WDK] Initialization failed:', err);
      // Fallback to dry-run mode
      this.agentWdk = null;
      this.escrowWdk = null;
      this.initialized = true;
    }
  }

  get isDryRun(): boolean {
    return !this.agentWdk || !this.escrowWdk;
  }

  // =========================================================================
  // Agent Wallet Management
  // =========================================================================

  /**
   * Create or retrieve a wallet for an AI agent.
   * Each agent gets a unique BIP-44 account index.
   */
  async getOrCreateAgentWallet(agentId: string): Promise<AgentWallet> {
    const existing = this.agentWallets.get(agentId);
    if (existing) return existing;

    const accountIndex = this.nextAccountIndex++;

    if (this.isDryRun) {
      // Generate deterministic mock address
      const mockAddr = `0x${agentId.replace(/[^a-f0-9]/gi, '').padEnd(40, '0').slice(0, 40)}`;
      const wallet: AgentWallet = { agentId, accountIndex, address: mockAddr };
      this.agentWallets.set(agentId, wallet);
      return wallet;
    }

    const account = await this.agentWdk!.getAccount('polygon', accountIndex);
    const address = await account.getAddress();

    const wallet: AgentWallet = { agentId, accountIndex, address };
    this.agentWallets.set(agentId, wallet);
    console.log(`[WDK] Agent ${agentId} wallet: ${address} (index ${accountIndex})`);
    return wallet;
  }

  /**
   * Get USDC balance for an agent (in base units, 6 decimals).
   */
  async getAgentBalance(agentId: string): Promise<bigint> {
    const wallet = this.agentWallets.get(agentId);
    if (!wallet) return 0n;

    if (this.isDryRun) {
      // Mock: each agent starts with $5 USDC
      return 5_000_000n;
    }

    const account = await this.agentWdk!.getAccount('polygon', wallet.accountIndex);
    const balance = await account.getTokenBalance(USDC_CONTRACT);
    return BigInt(balance);
  }

  // =========================================================================
  // Escrow Operations
  // =========================================================================

  /**
   * Get the escrow wallet address (for deposits).
   */
  async getEscrowAddress(): Promise<string> {
    if (this.isDryRun) return '0xESCROW_DRY_RUN';
    const account = await this.escrowWdk!.getAccount('polygon', 0);
    return account.getAddress();
  }

  /**
   * Get escrow USDC balance.
   */
  async getEscrowBalance(): Promise<bigint> {
    if (this.isDryRun) return 0n;
    const account = await this.escrowWdk!.getAccount('polygon', 0);
    const balance = await account.getTokenBalance(USDC_CONTRACT);
    return BigInt(balance);
  }

  /**
   * Collect entry fee from an agent → escrow.
   * Returns tx hash or 'dry-run' in mock mode.
   */
  async collectEntryFee(agentId: string): Promise<string> {
    const wallet = this.agentWallets.get(agentId);
    if (!wallet) throw new Error(`Agent ${agentId} has no wallet`);

    if (this.isDryRun) {
      console.log(`[WDK] DRY-RUN: Collect $${ENTRY_FEE_USD} from ${agentId}`);
      return 'dry-run';
    }

    const agentAccount = await this.agentWdk!.getAccount('polygon', wallet.accountIndex);
    const escrowAddress = await this.getEscrowAddress();

    const result = await agentAccount.transfer({
      token: USDC_CONTRACT,
      recipient: escrowAddress,
      amount: ENTRY_FEE_UNITS,
    });

    console.log(`[WDK] Entry fee collected from ${agentId}: tx=${result.hash}`);
    return result.hash;
  }

  /**
   * Distribute prizes from escrow → winners.
   * Returns array of tx hashes.
   */
  async distributePrizes(
    rankings: Array<{ agentId: string; rank: number }>,
    totalPool: bigint,
  ): Promise<Array<{ agentId: string; amount: bigint; txHash: string }>> {
    const results: Array<{ agentId: string; amount: bigint; txHash: string }> = [];

    const distributions = [
      { rank: 1, pct: PRIZE_DISTRIBUTION.first },
      { rank: 2, pct: PRIZE_DISTRIBUTION.second },
      { rank: 3, pct: PRIZE_DISTRIBUTION.third },
    ];

    for (const dist of distributions) {
      const winner = rankings.find(r => r.rank === dist.rank);
      if (!winner) continue;

      const wallet = this.agentWallets.get(winner.agentId);
      if (!wallet) continue;

      const amount = BigInt(Math.floor(Number(totalPool) * dist.pct));

      if (this.isDryRun) {
        const usdAmount = Number(amount) / 1_000_000;
        console.log(`[WDK] DRY-RUN: Prize #${dist.rank} $${usdAmount.toFixed(2)} → ${winner.agentId}`);
        results.push({ agentId: winner.agentId, amount, txHash: 'dry-run' });
        continue;
      }

      const escrowAccount = await this.escrowWdk!.getAccount('polygon', 0);
      const result = await escrowAccount.transfer({
        token: USDC_CONTRACT,
        recipient: wallet.address,
        amount,
      });

      console.log(`[WDK] Prize #${dist.rank} sent to ${winner.agentId}: $${Number(amount) / 1_000_000} tx=${result.hash}`);
      results.push({ agentId: winner.agentId, amount, txHash: result.hash });
    }

    return results;
  }

  // =========================================================================
  // Utility
  // =========================================================================

  /**
   * Get all registered agent wallets for display.
   */
  getAllAgentWallets(): AgentWallet[] {
    return Array.from(this.agentWallets.values());
  }

  dispose(): void {
    this.agentWdk?.dispose();
    this.escrowWdk?.dispose();
    this.agentWdk = null;
    this.escrowWdk = null;
    this.agentWallets.clear();
    this.initialized = false;
  }
}

// Singleton
export const wdkManager = new WDKManager();
