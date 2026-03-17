import React, { useState, useEffect } from 'react';
import type { AIAgentInfo } from './ArenaView';

export interface BettingPanelProps {
  agents: AIAgentInfo[];
  walletConnected: boolean;
  walletAddress?: string;
  userBalance?: number;
  onConnect: () => void;
  onBet: (agentId: string, amount: number) => void;
  matchInProgress: boolean;
  matchResult?: {
    winnerId: string;
    userWon: boolean;
    payout: number;
  };
  apiBaseUrl?: string;
}

const BET_AMOUNTS = [
  { label: '$0.25', value: 0.25 },
  { label: '$0.50', value: 0.5 },
  { label: '$1.00', value: 1.0 },
];

export const BettingPanel: React.FC<BettingPanelProps> = ({
  agents,
  walletConnected,
  walletAddress,
  userBalance = 10.0,
  onConnect,
  onBet,
  matchInProgress,
  matchResult,
  apiBaseUrl = 'http://localhost:3000',
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState(0.25);
  const [agentBalances, setAgentBalances] = useState<Record<string, number>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Fetch agent wallet balances
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        setLoadingBalances(true);
        const response = await fetch(`${apiBaseUrl}/api/wallet/status`);
        if (response.ok) {
          const data = await response.json();
          const balances: Record<string, number> = {};
          data.agents?.forEach((agent: any) => {
            balances[agent.id] = agent.balance;
          });
          setAgentBalances(balances);
        }
      } catch (err) {
        console.error('Error fetching wallet balances:', err);
      } finally {
        setLoadingBalances(false);
      }
    };

    if (walletConnected) {
      fetchBalances();
      // Refresh every 10 seconds
      const interval = setInterval(fetchBalances, 10000);
      return () => clearInterval(interval);
    }
  }, [walletConnected, apiBaseUrl]);

  const handleBet = () => {
    if (selectedAgent && selectedAmount > 0) {
      onBet(selectedAgent, selectedAmount);
      setSelectedAgent(null);
    }
  };

  const formatAddress = (addr?: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="bg-slate-800 border-l border-slate-700 w-96 h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-4 sticky top-0">
        <h2 className="text-lg font-bold text-white mb-2">WDK 下注</h2>

        {/* Wallet Connection */}
        {!walletConnected ? (
          <button
            onClick={onConnect}
            className="w-full py-2 px-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold rounded-lg transition-all"
          >
            🔌 連接 WDK 錢包
          </button>
        ) : (
          <div className="space-y-2">
            <div className="bg-slate-900 rounded p-2">
              <div className="text-xs text-gray-400 mb-1">錢包地址</div>
              <div className="text-xs font-mono text-cyan-400">{formatAddress(walletAddress)}</div>
            </div>
            <div className="bg-slate-900 rounded p-2">
              <div className="text-xs text-gray-400 mb-1">USDT 餘額</div>
              <div className="text-lg font-bold text-green-400">${userBalance.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {matchInProgress ? (
          /* Match In Progress - Show Betting Status */
          <div className="space-y-3">
            <div className="text-xs text-gray-400 uppercase font-bold">進行中的下注</div>

            {selectedAgent && (
              <div className="bg-cyan-900 bg-opacity-30 border border-cyan-500 border-opacity-50 rounded-lg p-3">
                <div className="text-sm font-bold text-cyan-300 mb-1">
                  {agents.find((a) => a.id === selectedAgent)?.name}
                </div>
                <div className="text-xs text-gray-300">
                  下注金額: <span className="text-green-400 font-bold">${selectedAmount.toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">等待比賽結束...</div>
              </div>
            )}
          </div>
        ) : matchResult ? (
          /* Match Result - Show Payout */
          <div className="space-y-3">
            <div className="text-xs text-gray-400 uppercase font-bold">比賽結果</div>

            {matchResult.userWon ? (
              <div className="bg-green-900 bg-opacity-30 border border-green-500 border-opacity-50 rounded-lg p-3 text-center">
                <div className="text-2xl mb-2">🎉</div>
                <div className="text-sm font-bold text-green-300 mb-1">恭喜！你贏了！</div>
                <div className="text-2xl font-black text-green-400">${matchResult.payout.toFixed(2)}</div>
              </div>
            ) : (
              <div className="bg-red-900 bg-opacity-30 border border-red-500 border-opacity-50 rounded-lg p-3 text-center">
                <div className="text-2xl mb-2">😢</div>
                <div className="text-sm font-bold text-red-300">這次運氣不好</div>
                <div className="text-sm text-gray-400 mt-1">等待下一場比賽...</div>
              </div>
            )}
          </div>
        ) : (
          /* Ready to Bet */
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-400 uppercase font-bold mb-2">選擇 AI Agent</div>
              <div className="space-y-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    disabled={userBalance < selectedAmount}
                    className={`w-full text-left p-2 rounded-lg border transition-all ${
                      selectedAgent === agent.id
                        ? 'bg-cyan-600 bg-opacity-30 border-cyan-500'
                        : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                    } ${userBalance < selectedAmount ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-sm font-bold text-white">{agent.name}</div>
                    <div className="text-xs text-gray-400">{agent.personality}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedAgent && (
              <div>
                <div className="text-xs text-gray-400 uppercase font-bold mb-2">下注金額</div>
                <div className="grid grid-cols-3 gap-2">
                  {BET_AMOUNTS.map((amount) => (
                    <button
                      key={amount.value}
                      onClick={() => setSelectedAmount(amount.value)}
                      disabled={userBalance < amount.value}
                      className={`py-2 px-2 rounded-lg text-sm font-bold transition-all ${
                        selectedAmount === amount.value
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-900 text-gray-300 hover:bg-slate-800'
                      } ${userBalance < amount.value ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {amount.label}
                    </button>
                  ))}
                </div>

                {userBalance < selectedAmount && (
                  <div className="mt-2 bg-red-900 bg-opacity-20 border border-red-500 border-opacity-30 rounded p-2">
                    <div className="text-xs text-red-300">錢包餘額不足</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Button */}
      {!matchInProgress && !matchResult && walletConnected && selectedAgent && (
        <div className="border-t border-slate-700 p-4 sticky bottom-0 bg-slate-800">
          <button
            onClick={handleBet}
            disabled={userBalance < selectedAmount}
            className={`w-full py-3 rounded-lg font-bold uppercase text-sm transition-all ${
              userBalance >= selectedAmount
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {userBalance >= selectedAmount ? '確認下注' : '錢包餘額不足'}
          </button>
        </div>
      )}

      {matchInProgress && (
        <div className="border-t border-slate-700 p-4 sticky bottom-0 bg-slate-800">
          <div className="text-xs text-center text-gray-400">比賽進行中，請稍候結果...</div>
        </div>
      )}
    </div>
  );
};

export default BettingPanel;
