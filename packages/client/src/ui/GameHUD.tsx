import React, { useMemo } from 'react';
import type { GameStateSnapshot, LeaderboardEntry } from '@blobverse/shared';

interface GameHUDProps {
  gameState: GameStateSnapshot | null;
  playerId: string | null;
  playerColor?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getRoundName = (roundNum: number): string => {
  switch (roundNum) {
    case 1:
      return '搶食狂歡';
    case 2:
      return '混亂區域';
    case 3:
      return '最終決戰';
    default:
      return '準備中';
  }
};

export const GameHUD: React.FC<GameHUDProps> = ({ gameState, playerId, playerColor = '#FFD700' }) => {
  // Get player's own blob for mass display
  const playerBlob = useMemo(() => {
    if (!gameState || !playerId) return null;
    return gameState.blobs.find((b) => b.id === playerId);
  }, [gameState, playerId]);

  // Get top 5 leaderboard entries
  const topLeaderboard = useMemo(() => {
    if (!gameState?.leaderboard) return [];
    return gameState.leaderboard.slice(0, 5);
  }, [gameState?.leaderboard]);

  const playerMass = playerBlob?.radius ? Math.round((playerBlob.radius / 4.5) ** 2) : 0;
  const isPlayerInTop5 = topLeaderboard.some((e) => e.id === playerId);

  return (
    <div className="fixed inset-0 pointer-events-none font-sans text-white text-sm">
      {/* Top-left: Kill Feed area (placeholder) */}
      <div className="absolute top-4 left-4 w-64">
        <div className="text-xs text-gray-300 opacity-70">
          {/* Kill feed will go here */}
        </div>
      </div>

      {/* Top-center: Round Timer and Round Indicator */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-center">
        <div className="flex gap-6 items-center justify-center">
          {/* Round Indicator (①②③) */}
          <div className="flex gap-3">
            {[1, 2, 3].map((roundNum) => {
              const isActive = gameState?.currentRound === roundNum;
              const isCompleted = gameState && gameState.currentRound > roundNum;

              return (
                <div
                  key={roundNum}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all ${
                    isActive
                      ? 'bg-cyan-500 border-cyan-300 text-white shadow-lg'
                      : isCompleted
                        ? 'bg-gray-600 border-gray-500 text-white'
                        : 'bg-gray-800 border-gray-600 text-gray-400'
                  }`}
                >
                  {isCompleted ? '✓' : roundNum}
                </div>
              );
            })}
          </div>

          {/* Round Timer */}
          <div className="text-right">
            <div className="text-xs text-gray-300 mb-1">{getRoundName(gameState?.currentRound || 0)}</div>
            <div
              className={`text-2xl font-black transition-colors ${
                gameState && gameState.roundTimer <= 10 ? 'text-red-500' : 'text-white'
              }`}
            >
              {formatTime(gameState?.roundTimer || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Top-right: Leaderboard */}
      <div className="absolute top-4 right-4 w-48">
        <div className="bg-slate-900 bg-opacity-85 backdrop-blur-sm border border-white border-opacity-10 rounded-xl p-3">
          <div className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">排行榜</div>

          <div className="space-y-1">
            {topLeaderboard.map((entry, index) => {
              const isPlayer = entry.id === playerId;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                    isPlayer ? 'bg-yellow-500 bg-opacity-20 text-yellow-300' : 'text-gray-200'
                  }`}
                >
                  <span className={`font-bold w-4 ${isPlayer ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {entry.rank}.
                  </span>
                  <span className="flex-1 truncate">{entry.name}</span>
                  <span className={isPlayer ? 'text-yellow-300 font-bold' : 'text-gray-400'}>{entry.mass}</span>
                </div>
              );
            })}
          </div>

          {/* Show player info if not in top 5 */}
          {!isPlayerInTop5 && playerBlob && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-yellow-500 bg-opacity-10 text-yellow-300">
                <span className="font-bold text-yellow-400">You</span>
                <span className="flex-1 text-right">{playerMass}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom-left: Player Mass Display */}
      <div className="absolute bottom-4 left-4">
        <div className="bg-slate-900 bg-opacity-85 backdrop-blur-sm border border-white border-opacity-10 rounded-lg px-3 py-2 flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: playerColor }}
          />
          <span className="text-xs text-gray-300">質量:</span>
          <span className="text-sm font-bold text-yellow-400">{playerMass}</span>
        </div>
      </div>

      {/* Bottom-right: Controls hint */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-400 text-right">
        <div>🖱️ 移動</div>
        <div>空白鍵 分裂</div>
        <div>W 射出</div>
      </div>
    </div>
  );
};

export default GameHUD;
