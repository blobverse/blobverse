/**
 * Arena Page - Full spectator + betting interface for Blobverse Arena Mode
 * Combines ArenaView (match replay) with BettingPanel (betting interface)
 */

import React, { useState } from 'react';
import { ArenaView } from './ui/ArenaView';
import { BettingPanel } from './ui/BettingPanel';
import { getApiBaseUrl } from './env';

interface ArenaPageProps {
  apiBaseUrl?: string;
}

/**
 * Arena Page component combining spectator view with betting interface
 * Layout: 
 * - Left: Main arena replay (ArenaView)
 * - Right: Betting panel (BettingPanel)
 */
export const ArenaPage: React.FC<ArenaPageProps> = ({ 
  apiBaseUrl = getApiBaseUrl() 
}) => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | undefined>();
  const [userBalance, setUserBalance] = useState(10.0);
  const [matchInProgress, setMatchInProgress] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    winnerId: string;
    userWon: boolean;
    payout: number;
  } | undefined>();

  const handleConnectWallet = () => {
    // Placeholder for WDK wallet connection
    setWalletConnected(true);
    setWalletAddress('0x1234...5678');
    console.log('Wallet connected');
  };

  const handleBet = (agentId: string, amount: number) => {
    console.log(`Bet placed: ${agentId} - $${amount}`);
    setMatchInProgress(true);
    
    // Simulate bet result after match
    // In real implementation, this would be connected to backend events
  };

  const handleMatchEnd = () => {
    setMatchInProgress(false);
    // Simulate match result for demo
    setMatchResult({
      winnerId: 'agent_1',
      userWon: Math.random() > 0.5,
      payout: 10.0,
    });
  };

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Main Arena View */}
      <div className="flex-1">
        <ArenaView 
          apiBaseUrl={apiBaseUrl} 
          onMatchEnd={handleMatchEnd}
        />
      </div>

      {/* Betting Panel */}
      <BettingPanel
        agents={[
          {
            id: 'agent_1',
            name: 'TITAN',
            personality: 'aggressor',
            walletAddress: '0xabcd...1234',
            walletBalance: 50,
            winRate: 0.55,
            totalEarnings: 1250,
            color: '#FFD700',
          },
          {
            id: 'agent_2',
            name: 'ECHO',
            personality: 'survivor',
            walletAddress: '0xefgh...5678',
            walletBalance: 30,
            winRate: 0.45,
            totalEarnings: 750,
            color: '#FF6B6B',
          },
          {
            id: 'agent_3',
            name: 'NOVA',
            personality: 'opportunist',
            walletAddress: '0xijkl...9012',
            walletBalance: 25,
            winRate: 0.38,
            totalEarnings: 500,
            color: '#4ECDC4',
          },
          {
            id: 'agent_4',
            name: 'SHADE',
            personality: 'trickster',
            walletAddress: '0xmnop...3456',
            walletBalance: 35,
            winRate: 0.48,
            totalEarnings: 900,
            color: '#95E1D3',
          },
          {
            id: 'agent_5',
            name: 'HERD',
            personality: 'herder',
            walletAddress: '0xqrst...7890',
            walletBalance: 28,
            winRate: 0.31,
            totalEarnings: 450,
            color: '#F38181',
          },
        ]}
        walletConnected={walletConnected}
        walletAddress={walletAddress}
        userBalance={userBalance}
        onConnect={handleConnectWallet}
        onBet={handleBet}
        matchInProgress={matchInProgress}
        matchResult={matchResult}
        apiBaseUrl={apiBaseUrl}
      />
    </div>
  );
};

export default ArenaPage;
