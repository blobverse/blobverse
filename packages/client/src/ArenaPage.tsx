/**
 * Arena Page — Horse-racing style betting on AI agent battles
 * 1. See 5 agents with stats, personality, odds
 * 2. Pick an agent and bet amount
 * 3. Watch the match replay
 * 4. Settlement — win payout if your agent wins
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArenaView } from './ui/ArenaView';
import type { AIAgentInfo } from './ui/ArenaView';
import { getApiBaseUrl } from './env';

type ArenaPhase = 'betting' | 'confirming' | 'watching' | 'result';

interface BetInfo {
  betId: string;
  agentId: string;
  agentName: string;
  amount: number;
  odds: number;
  settled?: boolean;
  won?: boolean;
  payout?: number;
}

interface ArenaPageProps {
  apiBaseUrl?: string;
}

const BET_AMOUNTS = [
  { label: '$0.25', value: 0.25 },
  { label: '$0.50', value: 0.50 },
  { label: '$1.00', value: 1.00 },
];

const PERSONALITY_EMOJI: Record<string, string> = {
  aggressor: '⚔️',
  survivor: '🛡️',
  opportunist: '🎯',
  trickster: '🎭',
  herder: '🐑',
};

export const ArenaPage: React.FC<ArenaPageProps> = ({
  apiBaseUrl = getApiBaseUrl(),
}) => {
  const [phase, setPhase] = useState<ArenaPhase>('betting');
  const [agents, setAgents] = useState<AIAgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null); // agent name
  const [betAmount, setBetAmount] = useState(0.25);
  const [bet, setBet] = useState<BetInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);

  // Fetch agents with odds on mount
  useEffect(() => {
    fetch(`${apiBaseUrl}/api/arena/agents`)
      .then((r) => r.json())
      .then((data) => {
        setAgents(data.agents || []);
        setDryRun(data.dryRun ?? true);
      })
      .catch(() => setError('Failed to load agents'));
  }, [apiBaseUrl]);

  // Place bet
  const handlePlaceBet = useCallback(async () => {
    if (!selectedAgent) return;
    setPhase('confirming');
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/arena/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: selectedAgent, amount: betAmount }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to place bet');
        setPhase('betting');
        return;
      }
      setBet(data.bet);
      // Brief confirmation delay
      await new Promise((r) => setTimeout(r, 1500));
      setPhase('watching');
    } catch {
      setError('Failed to place bet');
      setPhase('betting');
    }
  }, [apiBaseUrl, selectedAgent, betAmount]);

  // On match replay end → settle bet
  const handleMatchEnd = useCallback(async () => {
    if (!bet?.betId) {
      setPhase('result');
      return;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/arena/bet/${bet.betId}`);
      const data = await res.json();
      if (data.bet) {
        setBet(data.bet);
      }
    } catch {
      // ignore, show result anyway
    }
    setPhase('result');
  }, [apiBaseUrl, bet]);

  const handleBetAgain = () => {
    setPhase('betting');
    setSelectedAgent(null);
    setBet(null);
    setError(null);
  };

  const selectedAgentData = agents.find((a) => a.name === selectedAgent);
  const potentialPayout = selectedAgentData
    ? betAmount * (selectedAgentData as any).odds
    : 0;

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Left: Arena replay */}
      <div className="flex-1">
        <ArenaView
          apiBaseUrl={apiBaseUrl}
          onMatchEnd={handleMatchEnd}
          highlightAgentId={bet?.agentId}
        />
      </div>

      {/* Right: Betting panel */}
      <div className="bg-slate-800 border-l border-slate-700 w-96 h-full flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-900/50 to-slate-800 border-b border-slate-700 p-4">
          <h2 className="text-lg font-bold text-white">Blobverse Arena</h2>
          <p className="text-xs text-amber-300 mt-1">
            Pick your champion — bet on the winner
          </p>
          {dryRun && (
            <div className="mt-2 bg-yellow-900/30 border border-yellow-600/40 rounded px-2 py-1">
              <div className="text-[10px] text-yellow-300 text-center">Demo Mode — bets simulated</div>
            </div>
          )}
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* ── Phase: Betting ── */}
          {phase === 'betting' && (
            <>
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wide">
                Choose Your Champion
              </div>

              {/* Agent cards */}
              <div className="space-y-2">
                {agents.map((agent) => {
                  const odds = (agent as any).odds || 2.0;
                  const emoji = PERSONALITY_EMOJI[agent.personality] || '🤖';
                  const isSelected = selectedAgent === agent.name;
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent.name)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'bg-amber-900/30 border-amber-500 shadow-lg shadow-amber-500/20'
                          : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                          style={{ backgroundColor: agent.color }}
                        >
                          {agent.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{agent.name}</span>
                            <span className="text-xs">{emoji}</span>
                          </div>
                          <div className="text-xs text-gray-400 capitalize">{agent.personality}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-black text-amber-400">{odds}x</div>
                          <div className="text-[10px] text-gray-500">odds</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Bet amount selector */}
              {selectedAgent && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-400 uppercase font-bold">Bet Amount</div>
                  <div className="grid grid-cols-3 gap-2">
                    {BET_AMOUNTS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setBetAmount(opt.value)}
                        className={`py-2 rounded-lg text-sm font-bold transition-all ${
                          betAmount === opt.value
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-900 text-gray-300 hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Potential payout */}
                  <div className="bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                    <div className="text-xs text-gray-400">Potential Payout</div>
                    <div className="text-xl font-black text-green-400">
                      ${potentialPayout.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* How it works */}
              <div className="bg-slate-900 rounded-lg p-3 space-y-1">
                <div className="text-xs text-gray-400 uppercase font-bold">How It Works</div>
                <div className="text-xs text-gray-300">1. Pick an AI agent to bet on</div>
                <div className="text-xs text-gray-300">2. Choose your bet amount</div>
                <div className="text-xs text-gray-300">3. Watch the 3-round battle royale</div>
                <div className="text-xs text-gray-300">4. Win payout if your agent wins!</div>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-2">
                  <div className="text-xs text-red-300 text-center">{error}</div>
                </div>
              )}
            </>
          )}

          {/* ── Phase: Confirming ── */}
          {phase === 'confirming' && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="animate-spin w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full" />
              <div className="text-sm text-gray-300">Placing your bet...</div>
              <div className="text-xs text-gray-500">
                ${betAmount.toFixed(2)} on {selectedAgent}
              </div>
            </div>
          )}

          {/* ── Phase: Watching ── */}
          {phase === 'watching' && bet && (
            <div className="space-y-4">
              <div className="text-xs text-gray-400 uppercase font-bold">Your Bet</div>

              <div className="bg-amber-900/30 border border-amber-500/50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: selectedAgentData?.color || '#666' }}
                  >
                    {bet.agentName[0]}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{bet.agentName}</div>
                    <div className="text-xs text-amber-300">
                      {bet.odds}x odds
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900 rounded p-2">
                    <div className="text-gray-400">Bet</div>
                    <div className="text-green-400 font-bold">${bet.amount.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-900 rounded p-2">
                    <div className="text-gray-400">Potential Win</div>
                    <div className="text-amber-400 font-bold">${(bet.amount * bet.odds).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div className="text-center text-sm text-amber-300 animate-pulse">
                Match in progress...
              </div>
            </div>
          )}

          {/* ── Phase: Result ── */}
          {phase === 'result' && bet && (
            <div className="space-y-4">
              <div className="text-xs text-gray-400 uppercase font-bold">Result</div>

              {bet.won ? (
                <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-5 text-center">
                  <div className="text-5xl mb-3">🏆</div>
                  <div className="text-xl font-bold text-green-300 mb-1">You Won!</div>
                  <div className="text-sm text-gray-300 mb-3">
                    {bet.agentName} took the crown
                  </div>
                  <div className="text-3xl font-black text-green-400">
                    +${(bet.payout || 0).toFixed(2)} USDC
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Bet: ${bet.amount.toFixed(2)} @ {bet.odds}x
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-600 rounded-xl p-5 text-center">
                  <div className="text-5xl mb-3">😤</div>
                  <div className="text-xl font-bold text-gray-300 mb-1">Not This Time</div>
                  <div className="text-sm text-gray-400 mb-3">
                    {bet.agentName} didn't make it
                  </div>
                  <div className="text-lg text-red-400 font-bold">
                    -${bet.amount.toFixed(2)} USDC
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom action button */}
        <div className="border-t border-slate-700 p-4 bg-slate-800">
          {phase === 'betting' && selectedAgent && (
            <button
              onClick={handlePlaceBet}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl text-sm uppercase tracking-wide transition-all shadow-lg shadow-amber-500/25"
            >
              Place Bet — ${betAmount.toFixed(2)} on {selectedAgent}
            </button>
          )}
          {phase === 'betting' && !selectedAgent && (
            <div className="text-xs text-center text-gray-500">
              Select an agent to place your bet
            </div>
          )}
          {phase === 'watching' && (
            <div className="text-xs text-center text-gray-500">
              Waiting for match to complete...
            </div>
          )}
          {phase === 'result' && (
            <button
              onClick={handleBetAgain}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl text-sm uppercase tracking-wide transition-all"
            >
              Bet Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArenaPage;
