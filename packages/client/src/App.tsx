import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Game } from './game';
import { LobbyScreen } from './ui/LobbyScreen';
import { GameHUD } from './ui/GameHUD';
import { GameOverScreen, GameOverData } from './ui/GameOverScreen';
import { ArenaPage } from './ArenaPage';
import type { GameStateSnapshot } from '@blobverse/shared';

type GamePhase = 'menu' | 'lobby' | 'countdown' | 'playing' | 'gameover' | 'arena';
type Lang = 'en' | 'zh';

const i18n: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Blobverse',
    subtitle: 'AI Agent Battle Royale with WDK Settlement',
    playGame: 'Play Game',
    arenaMode: 'Arena Mode (Watch & Bet)',
    arenaDesc: 'Watch AI agents compete, place bets with USDC',
    playDesc: 'Classic multiplayer blob battle',
    back: 'Back to Menu',
  },
  zh: {
    title: 'Blobverse',
    subtitle: 'AI Agent 大逃殺 — WDK 錢包結算',
    playGame: '開始遊戲',
    arenaMode: '競技場模式（觀戰＆下注）',
    arenaDesc: '觀看 AI 代理人對戰，使用 USDC 下注',
    playDesc: '經典多人 Blob 大亂鬥',
    back: '返回主選單',
  },
};

interface GameContextState {
  phase: GamePhase;
  gameState: GameStateSnapshot | null;
  playerId: string | null;
  playerColor: string;
  gameOverData: GameOverData | null;
}

export const App: React.FC = () => {
  const gameRef = useRef<Game | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const t = i18n[lang];
  const [state, setState] = useState<GameContextState>({
    phase: 'menu',
    gameState: null,
    playerId: null,
    playerColor: '#FFD700',
    gameOverData: null,
  });

  // Initialize game only when entering play mode
  const initGame = useCallback(async () => {
    if (gameRef.current) return;
    try {
      const game = await Game.create();
      gameRef.current = game;

      if ((game as any).onStateChange) {
        (game as any).onStateChange((newState: GameStateSnapshot) => {
          setState((prev) => ({ ...prev, gameState: newState }));
        });
      }
      console.log('✨ Blobverse initialized');
    } catch (error) {
      console.error('❌ Failed to initialize game:', error);
    }
  }, []);

  const handleJoinGame = (playerName: string) => {
    if (gameRef.current) {
      gameRef.current.start();
      setState((prev) => ({
        ...prev,
        phase: 'playing',
        playerId: 'player_0',
      }));
    }
  };

  const handlePlayAgain = () => {
    setState((prev) => ({
      ...prev,
      phase: 'lobby',
      gameState: null,
      gameOverData: null,
    }));
  };

  const goToMenu = () => {
    setState((prev) => ({ ...prev, phase: 'menu' }));
  };

  const handleEnterPlay = async () => {
    setState((prev) => ({ ...prev, phase: 'lobby' }));
    await initGame();
  };

  const renderPhase = () => {
    switch (state.phase) {
      case 'menu':
        return (
          <div className="w-screen h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center gap-8 pointer-events-auto">
            {/* Language toggle */}
            <div className="absolute top-6 right-6 flex gap-2">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${lang === 'en' ? 'bg-white text-slate-900' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('zh')}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${lang === 'zh' ? 'bg-white text-slate-900' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
              >
                中文
              </button>
            </div>

            <div className="text-center">
              <div className="text-7xl font-black text-white mb-4">🌊 {t.title}</div>
              <div className="text-lg text-gray-400 max-w-md">{t.subtitle}</div>
            </div>

            <div className="flex gap-8">
              <button
                onClick={handleEnterPlay}
                className="group px-10 py-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl text-xl transition-all hover:scale-105 shadow-lg shadow-purple-500/25"
              >
                <div>🎮 {t.playGame}</div>
                <div className="text-xs font-normal opacity-70 mt-1">{t.playDesc}</div>
              </button>

              <button
                onClick={() => setState((prev) => ({ ...prev, phase: 'arena' }))}
                className="group px-10 py-5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xl transition-all hover:scale-105 shadow-lg shadow-cyan-500/25"
              >
                <div>⚔️ {t.arenaMode}</div>
                <div className="text-xs font-normal opacity-70 mt-1">{t.arenaDesc}</div>
              </button>
            </div>
          </div>
        );

      case 'arena':
        return (
          <div className="w-screen h-screen bg-slate-900 pointer-events-auto">
            <button
              onClick={goToMenu}
              className="absolute top-4 left-4 z-50 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-all"
            >
              ← {t.back}
            </button>
            <ArenaPage />
          </div>
        );

      case 'lobby':
        return (
          <div className="pointer-events-auto">
            <button
              onClick={goToMenu}
              className="absolute top-4 left-4 z-50 px-4 py-2 bg-slate-700/80 hover:bg-slate-600 text-white text-sm rounded-lg transition-all"
            >
              ← {t.back}
            </button>
            <LobbyScreen
              onJoin={handleJoinGame}
              playerCount={0}
              maxPlayers={10}
            />
          </div>
        );

      case 'countdown':
        return (
          <div className="pointer-events-auto">
            <LobbyScreen
              onJoin={handleJoinGame}
              playerCount={1}
              maxPlayers={10}
              countdownSeconds={3}
            />
          </div>
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
          <div className="pointer-events-auto">
            <GameOverScreen
              data={state.gameOverData}
              onPlayAgain={handlePlayAgain}
            />
          </div>
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
