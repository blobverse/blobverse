import React, { useState } from 'react';

export interface GameOverData {
  playerRank: number;
  totalPlayers: number;
  playerName: string;
  stats: {
    blobsEaten: number;
    maxMass: number;
    survivalTime: number;
  };
  rankings: Array<{
    rank: number;
    name: string;
    mass: number;
    isPlayer: boolean;
  }>;
  aiReveal?: Array<{
    name: string;
    personality: string;
  }>;
}

interface GameOverScreenProps {
  data: GameOverData;
  onPlayAgain: () => void;
}

const getMedalEmoji = (rank: number): string => {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '🎖️';
  }
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

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ data, onPlayAgain }) => {
  const [showAIReveal, setShowAIReveal] = useState(false);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Rank Reveal Section */}
        {!showAIReveal ? (
          <div className="space-y-8 p-8">
            {/* Big Rank Display */}
            <div className="text-center">
              <div className="text-6xl mb-4">{getMedalEmoji(data.playerRank)}</div>
              <div className="text-gray-400 text-sm mb-2">Final Rank</div>
              <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
                #{data.playerRank}
              </div>
              <div className="text-gray-400 text-sm">{data.totalPlayers} players</div>
            </div>

            {/* Stats Card */}
            <div className="bg-slate-800 bg-opacity-50 backdrop-blur-sm border border-cyan-500 border-opacity-20 rounded-2xl p-6">
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-4">Game Stats</h2>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900 bg-opacity-30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-black text-cyan-400">{data.stats.blobsEaten}</div>
                  <div className="text-xs text-gray-400 mt-1">Blobs Eaten</div>
                </div>

                <div className="bg-slate-900 bg-opacity-30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-black text-cyan-400">{data.stats.maxMass}</div>
                  <div className="text-xs text-gray-400 mt-1">Max Mass</div>
                </div>

                <div className="bg-slate-900 bg-opacity-30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-black text-cyan-400">{data.stats.survivalTime}s</div>
                  <div className="text-xs text-gray-400 mt-1">Survival Time</div>
                </div>
              </div>
            </div>

            {/* Rankings Table */}
            <div className="bg-slate-800 bg-opacity-50 backdrop-blur-sm border border-cyan-500 border-opacity-20 rounded-2xl p-6">
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-4">Final Rankings</h2>

              <div className="space-y-2">
                {data.rankings.map((entry) => (
                  <div
                    key={`${entry.rank}-${entry.name}`}
                    className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                      entry.isPlayer ? 'bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30' : 'bg-slate-900 bg-opacity-30'
                    }`}
                  >
                    <span className={`text-2xl w-8 text-center ${entry.isPlayer ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {getMedalEmoji(entry.rank)}
                    </span>
                    <span className={`font-bold w-8 ${entry.isPlayer ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {entry.rank}.
                    </span>
                    <span className={`flex-1 ${entry.isPlayer ? 'text-yellow-300 font-semibold' : 'text-gray-300'}`}>
                      {entry.name}
                    </span>
                    <span className={`text-sm font-bold ${entry.isPlayer ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {entry.mass}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Show AI Reveal Button */}
            {data.aiReveal && data.aiReveal.length > 0 && (
              <button
                onClick={() => setShowAIReveal(true)}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold uppercase tracking-widest rounded-lg transition-all shadow-lg hover:shadow-purple-500/50"
              >
                Reveal AI Identities 🤖
              </button>
            )}

            {/* Play Again Button */}
            <button
              onClick={onPlayAgain}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold uppercase tracking-widest rounded-lg transition-all shadow-lg hover:shadow-cyan-500/50"
            >
              Play Again
            </button>
          </div>
        ) : (
          /* AI Reveal Section */
          <div className="space-y-6 p-8">
            <div className="text-center">
              <div className="text-4xl mb-2">🤖</div>
              <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
                AI Identity Reveal
              </div>
              <div className="text-gray-400 text-sm">Did you spot who was a bot?</div>
            </div>

            {/* AI List */}
            <div className="bg-slate-800 bg-opacity-50 backdrop-blur-sm border border-purple-500 border-opacity-20 rounded-2xl p-6">
              <div className="space-y-3">
                {data.aiReveal?.map((ai, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900 bg-opacity-30 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-white">{ai.name}</div>
                      <div className="text-xs text-gray-400">{getPersonalityLabel(ai.personality)}</div>
                    </div>
                    <div className="text-2xl">🤖</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Back Button */}
            <button
              onClick={() => setShowAIReveal(false)}
              className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold uppercase tracking-widest rounded-lg transition-all"
            >
              Back
            </button>

            {/* Play Again Button */}
            <button
              onClick={onPlayAgain}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold uppercase tracking-widest rounded-lg transition-all shadow-lg hover:shadow-cyan-500/50"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameOverScreen;
