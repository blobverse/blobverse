import React from 'react';
import type { Settlement } from './ArenaView';

export interface SettlementDisplayProps {
  settlement: Settlement | null;
  onClose: () => void;
}

const PRIZE_PERCENTAGES = [
  { rank: 1, percentage: 50, label: 'Champion' },
  { rank: 2, percentage: 25, label: 'Runner-up' },
  { rank: 3, percentage: 15, label: '3rd Place' },
  { rank: 4, percentage: 10, label: '4th Place' },
];

export const SettlementDisplay: React.FC<SettlementDisplayProps> = ({ settlement, onClose }) => {
  if (!settlement) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-cyan-500 border-opacity-30 p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Match Settlement</h2>
          <div className="text-sm text-gray-400">Match ID: {settlement.matchId.slice(-8)}</div>
          <div className="text-lg font-bold text-green-400 mt-2">
            Prize Pool: ${settlement.totalPool.toFixed(2)} USDC
          </div>
        </div>

        {/* Prize Distributions */}
        <div className="space-y-3 mb-6">
          {settlement.distributions.map((dist) => {
            const prizeInfo = PRIZE_PERCENTAGES.find((p) => p.rank === dist.rank);
            return (
              <div
                key={dist.agentId}
                className="bg-slate-900 rounded-lg p-3 border border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold text-white">
                      {prizeInfo?.label || `#${dist.rank}`}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {dist.percentage}% of pool
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">
                      ${dist.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">USDC</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default SettlementDisplay;
