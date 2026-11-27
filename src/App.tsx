import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckersBoard } from './components/CheckersBoard';
import { LobbyView } from './components/LobbyView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PlayerBar } from './components/PlayerBar';
import { PWAInstallButton } from './components/PWAInstallButton';
import { RoomSidebar } from './components/RoomSidebar';
import { RulesModal } from './components/RulesModal';
import {
  getSavedPlayerName,
  useCheckersSocket,
} from './hooks/useCheckersSocket';
import { useOnlineStatus } from './hooks/usePWAInstall';
import {
  applyLegalStep,
  countPieces,
  createInitialBoard,
  toAlgebraic,
  type Coord,
  type PlayerColor,
} from './shared/checkers';
import type { RoomState } from './shared/protocol';
import { soundFX } from './utils/sound';

function getInitialUrlRoom(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') ?? '').trim().toUpperCase();
  } catch {
    return '';
  }
}

function createLocalOfflineRoom(): RoomState {
  return {
    id: 'LOCAL',
    status: 'PLAYING',
    board: createInitialBoard(),
    turn: 'white',
    chainPos: null,
    struckInChain: [],
    pendingSteps: [],
    moveHistory: [],
    lastMoveCoords: null,
    players: {
      white: { clientId: 'local-white', name: 'Белые', connected: true },
      black: { clientId: 'local-black', name: 'Чёрные', connected: true },
    },
    spectatorCount: 0,
    winner: null,
    winReason: null,
    drawOfferBy: null,
    rematchVotes: [],
    timeControlSec: 0,
    clocks: { whiteMs: 0, blackMs: 0, lastTickAt: null },
    chat: [],
    createdAt: Date.now(),
  };
}

export default function App() {
  const {
    connectionStatus,
    room: onlineRoom,
    yourRole: onlineRole,
    errorMessage,
    unreadChatCount,
    setActiveSidebarTab,
    clearError,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMove,
    resign,
    offerDraw,
    respondDraw,
    requestRematch,
    sendChat,
  } = useCheckersSocket();

  const isOnline = useOnlineStatus();
  const [initialUrlRoom] = useState<string>(() => getInitialUrlRoom());
  const [savedName] = useState<string>(() => getSavedPlayerName());
  const [autoJoined, setAutoJoined] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [manualFlip, setManualFlip] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => soundFX.isMuted());

  const [localRoom, setLocalRoom] = useState<RoomState | null>(null);
  const [localPendingPromoted, setLocalPendingPromoted] = useState(false);

  const isLocalOffline = !onlineRoom && localRoom !== null;
  const activeRoom = onlineRoom ?? localRoom;
  const activeRole: PlayerColor | 'spectator' | null = onlineRoom
    ? onlineRole
    : localRoom
      ? localRoom.turn
      : null;

  // Automatically rejoin on refresh if player already has a saved name & ?room= in URL
  useEffect(() => {
    if (
      !autoJoined &&
      initialUrlRoom &&
      savedName.trim() &&
      connectionStatus === 'connected' &&
      !onlineRoom
    ) {
      setAutoJoined(true);
      joinRoom(initialUrlRoom, savedName);
    }
  }, [autoJoined, initialUrlRoom, savedName, connectionStatus, onlineRoom, joinRoom]);

  // Reset manual flip when entering a new room or changing online role
  useEffect(() => {
    setManualFlip(false);
  }, [onlineRoom?.id, onlineRole]);

  const defaultFlipped = onlineRoom ? onlineRole === 'black' : false;
  const flipped = manualFlip ? !defaultFlipped : defaultFlipped;

  const topColor: PlayerColor = flipped ? 'white' : 'black';
  const bottomColor: PlayerColor = flipped ? 'black' : 'white';

  const pieceCounts = useMemo(() => {
    if (!activeRoom) return { white: 12, black: 12, whiteKings: 0, blackKings: 0 };
    return countPieces(activeRoom.board);
  }, [activeRoom]);

  const capturedByWhite = 12 - pieceCounts.black;
  const capturedByBlack = 12 - pieceCounts.white;

  const handleToggleMute = () => {
    const next = !muted;
    soundFX.setMuted(next);
    setMuted(next);
  };

  const handleStartLocalGame = useCallback(() => {
    setLocalPendingPromoted(false);
    setManualFlip(false);
    setLocalRoom(createLocalOfflineRoom());
  }, []);

  const handleLeaveActive = useCallback(() => {
    if (onlineRoom) {
      leaveRoom();
    }
    setLocalRoom(null);
    setLocalPendingPromoted(false);
  }, [onlineRoom, leaveRoom]);

  const handleLocalMove = useCallback(
    (from: Coord, to: Coord) => {
      if (!localRoom || localRoom.status !== 'PLAYING') return;
      const mover = localRoom.turn;
      const outcome = applyLegalStep(
        localRoom.board,
        localRoom.turn,
        localRoom.chainPos,
        localRoom.struckInChain,
        from,
        to,
      );
      if (!outcome) return;

      const nextSteps = [...localRoom.pendingSteps, { from, to }];
      const nextPromoted = localPendingPromoted || outcome.promoted;

      if (outcome.winner) {
        soundFX.playGameEnd();
      } else if (outcome.promoted) {
        soundFX.playPromote();
      } else if (outcome.wasCapture) {
        soundFX.playCapture();
      } else {
        soundFX.playMove();
      }

      if (outcome.turnCompleted) {
        const sep = outcome.wasCapture ? ':' : '-';
        const notation = [
          toAlgebraic(nextSteps[0].from),
          ...nextSteps.map((s) => toAlgebraic(s.to)),
        ].join(sep);

        setLocalPendingPromoted(false);
        setLocalRoom({
          ...localRoom,
          board: outcome.board,
          turn: outcome.turn,
          chainPos: null,
          struckInChain: [],
          pendingSteps: [],
          lastMoveCoords: { from, to },
          moveHistory: [
            ...localRoom.moveHistory,
            {
              ply: localRoom.moveHistory.length + 1,
              color: mover,
              notation,
              wasCapture: outcome.wasCapture,
              promoted: nextPromoted,
              steps: nextSteps,
            },
          ],
          status: outcome.winner ? 'FINISHED' : 'PLAYING',
          winner: outcome.winner,
          winReason: outcome.winReason,
        });
      } else {
        setLocalPendingPromoted(nextPromoted);
        setLocalRoom({
          ...localRoom,
          board: outcome.board,
          turn: outcome.turn,
          chainPos: outcome.chainPos,
          struckInChain: outcome.struckInChain,
          pendingSteps: nextSteps,
          lastMoveCoords: { from, to },
        });
      }
    },
    [localRoom, localPendingPromoted],
  );

  const handleHeaderAction = () => {
    if (activeRoom) {
      handleLeaveActive();
    } else if (isOnline && connectionStatus === 'connected') {
      createRoom(savedName || 'Игрок 1', 'random', 0);
    } else {
      handleStartLocalGame();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#171311] text-[#F5EFE6]">
      {/* Top Bar Contract: Brand — Nav Links — 1 Primary Action */}
      <header className="border-b border-[#F5EFE6]/10 bg-[#1B1613]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => {
              if (activeRoom) handleLeaveActive();
            }}
            className="font-display text-2xl font-bold tracking-tight text-[#F5EFE6] whitespace-nowrap shrink-0 hover:text-[#E3AF5B] transition-colors"
          >
            Шашечный клуб
          </button>

          <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-[#C9BAA8]">
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="hover:text-[#F5EFE6] transition-colors whitespace-nowrap shrink-0"
            >
              Правила
            </button>
            {activeRoom && (
              <button
                type="button"
                onClick={handleLeaveActive}
                className="hidden sm:inline-block hover:text-[#F5EFE6] transition-colors whitespace-nowrap shrink-0"
              >
                В лобби
              </button>
            )}
            <PWAInstallButton />
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleHeaderAction}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#C88A3B] text-[#171311] hover:bg-[#D79949] transition-colors whitespace-nowrap shrink-0"
            >
              {activeRoom
                ? 'Новая игра'
                : isOnline && connectionStatus === 'connected'
                  ? 'Быстрая игра'
                  : 'Играть офлайн'}
            </button>
          </div>
        </div>
      </header>

      <OfflineIndicator />

      {/* Reconnecting banner when online device temporarily loses WebSocket */}
      {isOnline && connectionStatus === 'reconnecting' && (
        <div className="bg-[#382716] border-b border-[#C88A3B]/40 px-4 py-2 text-center text-xs text-[#F3D19B]">
          Связь с сервером прервана. Переподключение...
        </div>
      )}

      {/* Main Content */}
      {!activeRoom ? (
        <div className="flex-1">
          {initialUrlRoom && !savedName && (
            <div className="max-w-[1160px] mx-auto px-4 sm:px-6 pt-6">
              <div className="px-4 py-3 rounded-lg bg-[#231D1A] border border-[#C88A3B]/40 text-sm text-[#F5EFE6]">
                Вас пригласили в партию — комната{' '}
                <span className="font-mono font-semibold text-[#E3AF5B]">
                  {initialUrlRoom}
                </span>
                . Введите имя и нажмите «Войти в комнату».
              </div>
            </div>
          )}

          <LobbyView
            initialName={savedName}
            initialRoomCode={initialUrlRoom}
            isConnected={isOnline && connectionStatus === 'connected'}
            errorMessage={errorMessage}
            onCreateRoom={(name, side, time) => {
              setLocalRoom(null);
              createRoom(name, side, time);
            }}
            onJoinRoom={(code, name) => {
              setLocalRoom(null);
              joinRoom(code, name);
            }}
            onStartLocalGame={handleStartLocalGame}
            onOpenRules={() => setRulesOpen(true)}
          />
        </div>
      ) : (
        <main className="flex-1 max-w-[1160px] w-full mx-auto px-4 sm:px-6 py-5 lg:py-8">
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 px-4 py-2.5 rounded-lg bg-[#42201C] border border-[#D96B52]/40 flex items-center justify-between gap-4 text-xs text-[#FFB4A2]"
            >
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={clearError}
                className="text-[#F5EFE6] hover:underline shrink-0"
              >
                Скрыть
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">
            {/* Board Column */}
            <div className="space-y-3 max-w-[580px] w-full mx-auto">
              <PlayerBar
                color={topColor}
                slot={activeRoom.players[topColor]}
                isYou={!isLocalOffline && activeRole === topColor}
                isActiveTurn={activeRoom.turn === topColor}
                status={activeRoom.status}
                capturedCount={topColor === 'white' ? capturedByWhite : capturedByBlack}
                timeControlSec={activeRoom.timeControlSec}
                clockMs={
                  topColor === 'white'
                    ? activeRoom.clocks.whiteMs
                    : activeRoom.clocks.blackMs
                }
                lastTickAt={activeRoom.clocks.lastTickAt}
              />

              <CheckersBoard
                board={activeRoom.board}
                turn={activeRoom.turn}
                yourRole={activeRole}
                status={activeRoom.status}
                chainPos={activeRoom.chainPos}
                struckInChain={activeRoom.struckInChain}
                lastMoveCoords={activeRoom.lastMoveCoords}
                flipped={flipped}
                onMove={isLocalOffline ? handleLocalMove : sendMove}
              />

              <PlayerBar
                color={bottomColor}
                slot={activeRoom.players[bottomColor]}
                isYou={!isLocalOffline && activeRole === bottomColor}
                isActiveTurn={activeRoom.turn === bottomColor}
                status={activeRoom.status}
                capturedCount={
                  bottomColor === 'white' ? capturedByWhite : capturedByBlack
                }
                timeControlSec={activeRoom.timeControlSec}
                clockMs={
                  bottomColor === 'white'
                    ? activeRoom.clocks.whiteMs
                    : activeRoom.clocks.blackMs
                }
                lastTickAt={activeRoom.clocks.lastTickAt}
              />
            </div>

            {/* Sidebar Column */}
            <div className="w-full lg:sticky lg:top-6">
              <RoomSidebar
                room={activeRoom}
                yourRole={activeRole}
                isLocalOffline={isLocalOffline}
                unreadChatCount={unreadChatCount}
                muted={muted}
                onToggleMute={handleToggleMute}
                onFlipBoard={() => setManualFlip((f) => !f)}
                onResign={resign}
                onOfferDraw={offerDraw}
                onRespondDraw={respondDraw}
                onRequestRematch={isLocalOffline ? handleStartLocalGame : requestRematch}
                onSendChat={sendChat}
                onLeaveRoom={handleLeaveActive}
                onTabChange={setActiveSidebarTab}
              />
            </div>
          </div>
        </main>
      )}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
