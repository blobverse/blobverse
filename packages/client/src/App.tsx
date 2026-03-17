import React, { useEffect, useState, useRef } from 'react';
import { Game } from './game';
import { LobbyScreen } from './ui/LobbyScreen';
import { GameHUD } from './ui/GameHUD';
import { GameOverScreen, GameOverData } from './ui/GameOverScreen';
import type { GameStateSnapshot } from '@blobverse/shared';

type GamePhase = 'lobby' | 'countdown' | 'playing' | 'gameover';

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
    phase: 'lobby',
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
