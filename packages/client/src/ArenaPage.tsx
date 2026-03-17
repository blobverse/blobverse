/**
 * Arena Page — Pay-to-play flow with WDK wallet
 * 1. Show QR code (escrow address) + entry fee
 * 2. User pays → agent assigned
 * 3. Watch match with "your agent" highlighted
 * 4. Settlement result
 */

import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArenaView } from './ui/ArenaView';
import type { AIAgentInfo, MatchResult } from './ui/ArenaView';
import { getApiBaseUrl } from './env';

type ArenaPhase = 'entry' | 'joining' | 'watching' | 'result';

interface EscrowInfo {
  escrowAddress: string;
  entryFeeUsd: number;
  network: string;
  token: string;
  dryRun: boolean;
}

interface JoinResult {
  success: boolean;
  dryRun: boolean;
  assignedAgent: AIAgentInfo | null;
  matchId: string;
  entryFeePaid: number;
}

interface ArenaPageProps {
  apiBaseUrl?: string;
}

export const ArenaPage: React.FC<ArenaPageProps> = ({
  apiBaseUrl = getApiBaseUrl(),
}) => {
  const [phase, setPhase] = useState<ArenaPhase>('entry');
  const [escrowInfo, setEscrowInfo] = useState<EscrowInfo | null>(null);
  const [assignedAgent, setAssignedAgent] = useState<AIAgentInfo | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch escrow info on mount
  useEffect(() => {
    fetch(`${apiBaseUrl}/api/arena/escrow-info`)
      .then((r) => r.json())
      .then(setEscrowInfo)
      .catch(() => setError('Failed to fetch escrow info'));
  }, [apiBaseUrl]);

  // Join match — pay entry fee + get assigned agent
  const handleJoin = useCallback(async () => {
    setPhase('joining');
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/arena/join`, { method: 'POST' });
      const data: JoinResult = await res.json();
      if (!data.success) {
        setError('No match available — please wait for the next one');
        setPhase('entry');
        return;
      }
      setAssignedAgent(data.assignedAgent);
      setMatchId(data.matchId);

      // In dry-run mode, simulate brief payment confirmation
      if (data.dryRun) {
        await new Promise((r) => setTimeout(r, 2000));
      }

      setPhase('watching');
    } catch {
      setError('Failed to join match');
      setPhase('entry');
    }
  }, [apiBaseUrl]);

  const handleMatchEnd = useCallback(() => {
    // Fetch final match result for settlement display
    if (matchId) {
      fetch(`${apiBaseUrl}/api/arena/match/${matchId}`)
        .then((r) => r.json())
        .then((data: MatchResult) => {
          setMatchResult(data);
          setPhase('result');
        })
        .catch(() => setPhase('result'));
    } else {
      setPhase('result');
    }
  }, [apiBaseUrl, matchId]);

  const handlePlayAgain = () => {
    setPhase('entry');
    setAssignedAgent(null);
    setMatchId(null);
    setMatchResult(null);
    setError(null);
  };

  // Determine if user's agent won
  const userAgentRank = matchResult?.rankings?.find(
    (r) => r.agentId === assignedAgent?.id
  )?.rank;
  const userWon = userAgentRank === 1;

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Left: Arena replay */}
      <div className="flex-1">
        <ArenaView apiBaseUrl={apiBaseUrl} onMatchEnd={handleMatchEnd} />
      </div>

      {/* Right: Entry / Status panel */}
      <div className="bg-slate-800 border-l border-slate-700 w-96 h-full flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-4">
          <h2 className="text-lg font-bold text-white">WDK Arena</h2>
          <p className="text-xs text-gray-400 mt-1">
            Pay entry fee → AI agent plays for you → Win prizes
          </p>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* ── Phase: Entry ── */}
          {phase === 'entry' && (
            <>
              {/* QR Code */}
              {escrowInfo && (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-xs text-gray-400 uppercase font-bold tracking-wide">
                    Scan to Pay Entry Fee
                  </div>
                  <div className="bg-white p-3 rounded-xl">
                    <QRCodeSVG
                      value={`polygon:${escrowInfo.escrowAddress}?amount=${escrowInfo.entryFeeUsd}&token=USDC`}
                      size={180}
                      level="M"
                    />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-2xl font-black text-green-400">
                      ${escrowInfo.entryFeeUsd.toFixed(2)} USDC
                    </div>
                    <div className="text-xs text-gray-500">
                      {escrowInfo.network} Network
                    </div>
                  </div>

                  {/* Escrow address */}
                  <div className="w-full bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Escrow Address</div>
                    <div className="text-xs font-mono text-cyan-400 break-all">
                      {escrowInfo.escrowAddress}
                    </div>
                  </div>

                  {escrowInfo.dryRun && (
                    <div className="w-full bg-yellow-900 bg-opacity-30 border border-yellow-600 border-opacity-40 rounded-lg p-2">
                      <div className="text-xs text-yellow-300 text-center">
                        Demo Mode — payment simulated instantly
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prize info */}
              <div className="bg-slate-900 rounded-lg p-3 space-y-2">
                <div className="text-xs text-gray-400 uppercase font-bold">Prize Pool</div>
                <div className="text-sm text-gray-300">
                  5 agents x $0.25 = <span className="text-green-400 font-bold">$1.25 USDC</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
                  <div>1st: 50% ($0.63)</div>
                  <div>2nd: 25% ($0.31)</div>
                  <div>3rd: 15% ($0.19)</div>
                  <div>Platform: 10%</div>
                </div>
              </div>

              {/* How it works */}
              <div className="bg-slate-900 rounded-lg p-3 space-y-2">
                <div className="text-xs text-gray-400 uppercase font-bold">How It Works</div>
                <div className="space-y-1 text-xs text-gray-300">
                  <div>1. Pay $0.25 USDC entry fee</div>
                  <div>2. An AI agent is assigned to fight for you</div>
                  <div>3. Watch the 3-round battle royale</div>
                  <div>4. If your agent wins, prizes auto-settle to your wallet</div>
                </div>
              </div>

              {error && (
                <div className="bg-red-900 bg-opacity-30 border border-red-500 border-opacity-40 rounded-lg p-2">
                  <div className="text-xs text-red-300 text-center">{error}</div>
                </div>
              )}
            </>
          )}

          {/* ── Phase: Joining ── */}
          {phase === 'joining' && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full" />
              <div className="text-sm text-gray-300">Processing payment...</div>
              <div className="text-xs text-gray-500">Assigning your AI agent</div>
            </div>
          )}

          {/* ── Phase: Watching ── */}
          {phase === 'watching' && assignedAgent && (
            <div className="space-y-4">
              <div className="text-xs text-gray-400 uppercase font-bold">Your Agent</div>
              <div className="bg-cyan-900 bg-opacity-30 border border-cyan-500 border-opacity-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: assignedAgent.color }}
                  >
                    {assignedAgent.name[0]}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{assignedAgent.name}</div>
                    <div className="text-xs text-cyan-300 capitalize">{assignedAgent.personality}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  Entry fee paid: <span className="text-green-400 font-bold">$0.25 USDC</span>
                </div>
              </div>

              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Match ID</div>
                <div className="text-xs font-mono text-gray-300">{matchId}</div>
              </div>

              <div className="text-center text-sm text-yellow-300 animate-pulse">
                Match in progress — watch the replay on the left
              </div>
            </div>
          )}

          {/* ── Phase: Result ── */}
          {phase === 'result' && (
            <div className="space-y-4">
              <div className="text-xs text-gray-400 uppercase font-bold">Match Result</div>

              {userWon ? (
                <div className="bg-green-900 bg-opacity-30 border border-green-500 border-opacity-50 rounded-xl p-4 text-center">
                  <div className="text-4xl mb-2">🏆</div>
                  <div className="text-lg font-bold text-green-300 mb-1">Your Agent Won!</div>
                  <div className="text-sm text-gray-300">
                    <span className="text-white font-bold">{assignedAgent?.name}</span> finished{' '}
                    <span className="text-green-400 font-bold">#{userAgentRank}</span>
                  </div>
                  <div className="text-2xl font-black text-green-400 mt-2">$0.63 USDC</div>
                  <div className="text-xs text-gray-500 mt-1">Prize sent to your wallet</div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-center">
                  <div className="text-4xl mb-2">{userAgentRank && userAgentRank <= 3 ? '🥈' : '😤'}</div>
                  <div className="text-lg font-bold text-gray-300 mb-1">
                    {userAgentRank && userAgentRank <= 3 ? 'Almost!' : 'Better luck next time'}
                  </div>
                  <div className="text-sm text-gray-400">
                    <span className="text-white font-bold">{assignedAgent?.name}</span> finished{' '}
                    <span className="text-yellow-400 font-bold">#{userAgentRank || '?'}</span>
                  </div>
                  {userAgentRank === 2 && (
                    <div className="text-lg font-bold text-green-400 mt-2">$0.31 USDC</div>
                  )}
                  {userAgentRank === 3 && (
                    <div className="text-lg font-bold text-green-400 mt-2">$0.19 USDC</div>
                  )}
                </div>
              )}

              {/* Rankings */}
              {matchResult?.rankings && (
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-gray-400 uppercase font-bold mb-2">Final Rankings</div>
                  <div className="space-y-1">
                    {matchResult.rankings.map((r) => {
                      const isUser = r.agentId === assignedAgent?.id;
                      return (
                        <div
                          key={r.agentId}
                          className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                            isUser ? 'bg-cyan-500 bg-opacity-20 text-cyan-300' : 'text-gray-300'
                          }`}
                        >
                          <span className="font-bold w-5 text-gray-400">#{r.rank}</span>
                          <span className="flex-1">{r.name}{isUser ? ' (You)' : ''}</span>
                          <span className="text-gray-500">{r.finalMass}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom action button */}
        <div className="border-t border-slate-700 p-4 bg-slate-800">
          {phase === 'entry' && (
            <button
              onClick={handleJoin}
              disabled={!escrowInfo}
              className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold rounded-xl text-sm uppercase tracking-wide transition-all"
            >
              Pay $0.25 & Enter Match
            </button>
          )}
          {phase === 'watching' && (
            <div className="text-xs text-center text-gray-500">
              Waiting for match to complete...
            </div>
          )}
          {phase === 'result' && (
            <button
              onClick={handlePlayAgain}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl text-sm uppercase tracking-wide transition-all"
            >
              Play Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArenaPage;
