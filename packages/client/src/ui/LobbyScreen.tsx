import React, { useState } from 'react';

interface LobbyScreenProps {
  onJoin: (name: string) => void;
  isLoading?: boolean;
  playerCount?: number;
  maxPlayers?: number;
  countdownSeconds?: number;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  onJoin,
  isLoading = false,
  playerCount = 0,
  maxPlayers = 10,
  countdownSeconds = null,
}) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onJoin(name.trim());
    }
  };

  const isFull = playerCount >= maxPlayers;
  const showCountdown = countdownSeconds !== null && countdownSeconds > 0;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            Blobverse
          </h1>
          <p className="text-gray-400 text-sm">Browser-based Battle Royale with AI Agents</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800 bg-opacity-50 backdrop-blur-sm border border-cyan-500 border-opacity-20 rounded-2xl p-8 space-y-6">
          {/* Name Input */}
          {!showCountdown ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-widest">
                  玩家名稱
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入你的暱稱..."
                  maxLength={20}
                  disabled={isLoading || isFull}
                  autoFocus
                  className="w-full px-4 py-3 bg-slate-900 bg-opacity-50 border border-cyan-500 border-opacity-30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20 transition-all disabled:opacity-50"
                />
                <p className="text-xs text-gray-400 mt-1">{name.length}/20</p>
              </div>

              {/* Join Button */}
              <button
                type="submit"
                disabled={!name.trim() || isLoading || isFull}
                className={`w-full py-3 px-4 rounded-lg font-bold text-white uppercase tracking-widest transition-all ${
                  name.trim() && !isLoading && !isFull
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 shadow-lg hover:shadow-cyan-500/50 cursor-pointer'
                    : 'bg-gray-700 opacity-50 cursor-not-allowed'
                }`}
              >
                {isLoading ? '加入中...' : isFull ? '房間已滿' : '加入遊戲'}
              </button>
            </form>
          ) : (
            /* Countdown View */
            <div className="space-y-4 text-center py-4">
              <div className="text-gray-300 text-sm">遊戲即將開始...</div>
              <div className="text-6xl font-black text-cyan-400">{countdownSeconds}</div>
              <div className="text-gray-400 text-xs">準備好了嗎？</div>
            </div>
          )}

          {/* Player Count */}
          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>玩家人數</span>
              <span className="text-white font-bold">
                {playerCount} / {maxPlayers}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="mt-2 h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                style={{ width: `${(playerCount / maxPlayers) * 100}%` }}
              />
            </div>
          </div>

          {/* Status Messages */}
          {isFull && (
            <div className="bg-orange-500 bg-opacity-10 border border-orange-500 border-opacity-30 rounded-lg p-3 text-xs text-orange-300">
              房間已滿。請等待下一輪。
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-xs text-gray-500 space-y-1">
          <p>90 秒 × 3 輪 × 淘汰賽</p>
          <p>與 AI Agent 同場競技</p>
        </div>
      </div>
    </div>
  );
};

export default LobbyScreen;
