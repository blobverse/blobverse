import React, { useEffect, useState, useRef } from 'react';
import type { GameStateSnapshot } from '@blobverse/shared';
import { SettlementDisplay } from './SettlementDisplay';

export interface AIAgentInfo {
  id: string;
  name: string;
  personality: string;
  walletAddress: string;
  walletBalance?: number;
  winRate: number;
  totalEarnings: number;
  color: string;
}

export interface Settlement {
  matchId: string;
  totalPool: number;
  distributions: Array<{
    agentId: string;
    rank: number;
    amount: number;
    percentage: number;
  }>;
  timestamp: number;
}

export interface MatchResult {
  matchId: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  agents: AIAgentInfo[];
  rankings: Array<{ rank: number; agentId: string; name: string; finalMass: number }>;
  killLog: Array<{ timestamp: number; killerId: string; victimId: string }>;
  replayFrames: GameStateSnapshot[];
  winner: AIAgentInfo;
  settlement?: Settlement;
}

export interface ArenaViewProps {
  apiBaseUrl?: string;
  onMatchEnd?: () => void;
  highlightAgentId?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getPersonalityLabel = (personality: string): string => {
  const labels: Record<string, string> = {
    aggressor: 'Aggressor',
    survivor: 'Survivor',
    opportunist: 'Opportunist',
    trickster: 'Trickster',
    herder: 'Herder',
  };
  return labels[personality] || personality;
};

const getPersonalityEmoji = (personality: string): string => {
  const emojis: Record<string, string> = {
    aggressor: '⚔️',
    survivor: '🛡️',
    opportunist: '🤝',
    trickster: '🎭',
    herder: '🐑',
  };
  return emojis[personality] || '🤖';
};

export const ArenaView: React.FC<ArenaViewProps> = ({
  apiBaseUrl = 'http://localhost:3000',
  onMatchEnd,
  highlightAgentId,
}) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [leaderboard, setLeaderboard] = useState<Array<{ id: string; name: string; mass: number; rank: number }>>([]);
  const [killFeed, setKillFeed] = useState<Array<{ id: string; killer: string; killed: string; timestamp: number }>>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [agents, setAgents] = useState<AIAgentInfo[]>([]);
  const [replayFrames, setReplayFrames] = useState<GameStateSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch current match data from API
  useEffect(() => {
    const fetchCurrentMatch = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiBaseUrl}/api/arena/current`);
        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }
        const data: MatchResult = await response.json();
        setMatchResult(data);
        setAgents(data.agents);
        setReplayFrames(data.replayFrames);
        if (data.settlement) {
          setSettlement(data.settlement);
        }
        setCurrentFrameIndex(0);
        setIsPlaying(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch match data');
        console.error('Error fetching match:', err);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchCurrentMatch();

    // Poll for new matches every 5 seconds
    pollIntervalRef.current = setInterval(fetchCurrentMatch, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [apiBaseUrl]);

  // Frame playback animation
  useEffect(() => {
    if (!isPlaying || replayFrames.length === 0) return;

    const updateFrame = () => {
      const now = Date.now();
      const timeDelta = now - lastUpdateTimeRef.current;

      if (timeDelta >= 50) { // ~20 FPS playback
        setCurrentFrameIndex((prev) => {
          const next = prev + 1;
          if (next >= replayFrames.length) {
            setIsPlaying(false);
            onMatchEnd?.();
            return prev;
          }
          return next;
        });
        lastUpdateTimeRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(updateFrame);
    };

    animationFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, replayFrames, onMatchEnd]);

  // Update leaderboard from current frame
  useEffect(() => {
    if (replayFrames.length > 0 && currentFrameIndex < replayFrames.length) {
      const frame = replayFrames[currentFrameIndex];
      if (frame.leaderboard) {
        setLeaderboard(frame.leaderboard.slice(0, 5));
      }
    }
  }, [currentFrameIndex, replayFrames]);

  const currentFrame = replayFrames[currentFrameIndex] || null;
  const progress = replayFrames.length > 0 ? (currentFrameIndex / replayFrames.length) * 100 : 0;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚔️</div>
          <div className="text-xl font-bold text-white mb-2">Blobverse Arena</div>
          <div className="text-gray-400">Loading match...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl font-bold text-red-400 mb-2">Failed to load</div>
          <div className="text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col">
      {/* Main Canvas Area */}
      <div className="flex-1 bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
        <div id="canvas-container" className="w-full h-full" />

        {/* PixiJS Canvas will be rendered here by Game class */}

        {/* Top: Round Timer & Info */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-center text-white">
          <div className="text-xs text-gray-300 mb-1">Arena Match</div>
          <div className="text-3xl font-black">
            {formatTime(currentFrame?.roundTimer || 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Round {currentFrame?.currentRound || 1} / 3
          </div>
        </div>

        {/* Right: Leaderboard & Kill Feed */}
        <div className="absolute top-4 right-4 w-56 space-y-4">
          {highlightAgentId && (
            <div className="bg-cyan-900 bg-opacity-30 backdrop-blur-sm border border-cyan-400 border-opacity-60 rounded-xl p-3">
              <div className="text-[10px] text-cyan-300 uppercase tracking-wide font-bold">Your Agent</div>
              <div className="text-sm text-white font-semibold mt-1">
                {agents.find((a) => a.id === highlightAgentId)?.name || highlightAgentId}
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="bg-slate-900 bg-opacity-85 backdrop-blur-sm border border-cyan-500 border-opacity-20 rounded-xl p-3">
            <div className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">Leaderboard</div>

            <div className="space-y-1">
              {leaderboard.map((entry, idx) => {
                const agent = agents.find((a) => a.id === entry.id);
                const isMine = highlightAgentId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                      isMine ? 'bg-cyan-500 bg-opacity-20 text-cyan-200 border border-cyan-400 border-opacity-50' : 'text-gray-200'
                    }`}
                  >
                    <span className="font-bold w-4 text-gray-400">{entry.rank}.</span>
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: agent?.color || '#FFD700' }}
                    />
                    <span className="flex-1 truncate">{entry.name}</span>
                    <span className="text-gray-400">{entry.mass}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kill Feed */}
          <div className="bg-slate-900 bg-opacity-85 backdrop-blur-sm border border-cyan-500 border-opacity-20 rounded-xl p-3">
            <div className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">Events</div>

            <div className="space-y-1 max-h-40 overflow-y-auto">
              {killFeed.slice(-4).map((entry, idx) => (
                <div key={idx} className="text-xs text-gray-300">
                  <span className="text-yellow-300">{entry.killer}</span>
                  <span className="text-gray-500"> ate</span>
                  <span className="text-yellow-300">{entry.killed}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Agent Cards */}
      <div className="bg-slate-800 border-t border-slate-700 p-4">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {agents.map((agent) => {
            const isAlive = currentFrame?.blobs.some((b) => b.id === agent.id) ?? false;
            const finalRank = matchResult?.rankings.find((r) => r.agentId === agent.id)?.rank ?? 0;
            const isMine = highlightAgentId === agent.id;

            return (
              <div
                key={agent.id}
                className={`flex-shrink-0 bg-slate-900 rounded-lg p-3 border transition-all ${
                  isMine
                    ? 'border-cyan-400 shadow-lg shadow-cyan-500/30 ring-1 ring-cyan-400/50'
                    : isAlive
                    ? 'border-cyan-500 border-opacity-50 shadow-lg shadow-cyan-500/20'
                    : 'border-slate-700 opacity-50'
                }`}
              >
                <div className="w-32 space-y-2">
                  {/* Personality Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getPersonalityEmoji(agent.personality)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{agent.name}</div>
                      <div className="text-xs text-gray-400">{getPersonalityLabel(agent.personality)}</div>
                    </div>
                  </div>
                  {isMine && (
                    <div className="text-[10px] uppercase tracking-wide font-bold text-cyan-300">
                      You
                    </div>
                  )}

                  {/* Stats */}
                  <div className="bg-slate-800 rounded px-2 py-1">
                    <div className="text-xs text-gray-400">Win Rate</div>
                    <div className="text-sm font-bold text-green-400">{(agent.winRate * 100).toFixed(0)}%</div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${isAlive ? 'bg-green-500' : 'bg-red-500'}`}
                    />
                    <span className="text-xs text-gray-400">
                      {isAlive ? 'Fighting' : finalRank > 0 ? `#${finalRank}` : 'Eliminated'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Playback Controls */}
      <div className="bg-slate-900 border-t border-slate-700 p-3">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>

          <div className="flex-1">
            <div className="bg-slate-700 rounded-full h-1 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="text-xs text-gray-400">
            {currentFrameIndex} / {replayFrames.length}
          </div>
        </div>
      </div>

      {/* Settlement Display Modal */}
      <SettlementDisplay settlement={settlement} onClose={() => setSettlement(null)} />
    </div>
  );
};

export default ArenaView;
