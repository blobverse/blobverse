import React, { useEffect, useState, useRef } from 'react';
import { Game } from './game';
import { LobbyScreen } from './ui/LobbyScreen';
import { GameHUD } from './ui/GameHUD';
import { GameOverScreen, GameOverData } from './ui/GameOverScreen';
import { ArenaPage } from './ArenaPage';
import type { GameStateSnapshot } from '@blobverse/shared';

type GamePhase = 'menu' | 'lobby' | 'countdown' | 'playing' | 'gameover' | 'arena';

interface GameContextState {
  phase: GamePhase;
  gameState: GameStateSnapshot | null;
  playerId: string | null;
  playerColor: string;
  gameOverData: GameOverData | null;
}

export const App: React.FC = () => {
  const gameRef = useRef<Game | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<GameContextState>({
    phase: 'menu',
    gameState: null,
    playerId: null,
    playerColor: '#FFD700',
    gameOverData: null,
  });

  // Initialize game on mount
  useEffect(() => {
    const initGame = async () => {
      try {
        const game = await Game.create();
        gameRef.current = game;

        // Get canvas from renderer
        // Note: This assumes Game has a way to expose the canvas
        // We may need to modify Game.ts to expose it
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        if (canvas) {
          canvasRef.current = canvas;
        }

        // Set up game state listener (if Game class supports it)
        // For now, we'll need to implement a way to get game state updates
        if ((game as any).onStateChange) {
          (game as any).onStateChange((newState: GameStateSnapshot) => {
            setState((prev) => ({
              ...prev,
              gameState: newState,
            }));
          });
        }

        console.log('✨ Blobverse initialized');
        (window as any).game = game;
      } catch (error) {
        console.error('❌ Failed to initialize game:', error);
      }
    };

    initGame();
  }, []);

  const handleJoinGame = (playerName: string) => {
    if (gameRef.current) {
      // Transition to countdown phase
      setState((prev) => ({
        ...prev,
        phase: 'countdown',
      }));

      // Send join message to server (if multiplayer)
      // For now, just start the game
      gameRef.current.start();
      setState((prev) => ({
        ...prev,
        phase: 'playing',
        playerId: 'player_0', // Placeholder - should come from server
      }));
    }
  };

  const handlePlayAgain = () => {
    if (gameRef.current) {
      // Reset game and go back to lobby
      setState((prev) => ({
        ...prev,
        phase: 'lobby',
        gameState: null,
        gameOverData: null,
      }));

      // Reset the game
      // Note: We may need to implement a reset method on Game class
      // gameRef.current.reset();
    }
  };

  const renderPhase = () => {
    switch (state.phase) {
      case 'menu':
        return (
          <div className="w-screen h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center gap-8 pointer-events-auto">
            <div className="text-center">
              <div className="text-6xl font-black text-white mb-4">🌊 Blobverse</div>
              <div className="text-xl text-gray-400">Choose Your Experience</div>
            </div>

            <div className="flex gap-8">
              <button
                onClick={() => setState((prev) => ({ ...prev, phase: 'lobby' }))}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg text-lg transition-all"
              >
                🎮 Play Game
              </button>

              <button
                onClick={() => setState((prev) => ({ ...prev, phase: 'arena' }))}
                className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg text-lg transition-all"
              >
                ⚔️ Arena Mode (Watch & Bet)
              </button>
            </div>
          </div>
        );

      case 'arena':
        return (
          <div className="w-screen h-screen bg-slate-900 pointer-events-auto">
            <ArenaPage />
          </div>
        );

      case 'lobby':
        return (
          <LobbyScreen
            onJoin={handleJoinGame}
            playerCount={0}
            maxPlayers={10}
          />
        );

      case 'countdown':
        return (
          <LobbyScreen
            onJoin={handleJoinGame}
            playerCount={1}
            maxPlayers={10}
            countdownSeconds={3}
          />
        );

      case 'playing':
        return (
          <GameHUD
            gameState={state.gameState}
            playerId={state.playerId}
            playerColor={state.playerColor}
          />
        );

      case 'gameover':
        return state.gameOverData ? (
          <GameOverScreen
            data={state.gameOverData}
            onPlayAgain={handlePlayAgain}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden">
      {/* Canvas container for PixiJS game */}
      <div id="canvas-container" />

      {/* React UI overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {renderPhase()}
      </div>
    </div>
  );
};

export default App;
