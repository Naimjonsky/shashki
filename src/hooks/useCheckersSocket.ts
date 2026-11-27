import { useCallback, useEffect, useRef, useState } from 'react';
import type { Coord, PlayerColor } from '../shared/checkers';
import type {
  ClientMessage,
  RoomState,
  ServerMessage,
  SidePreference,
  TimeControlSeconds,
} from '../shared/protocol';
import { soundFX } from '../utils/sound';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

function getOrCreateClientId(): string {
  const key = 'rus_checkers_client_id';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, generated);
    return generated;
  } catch {
    return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getSavedPlayerName(): string {
  try {
    return localStorage.getItem('rus_checkers_player_name') ?? '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem('rus_checkers_player_name', name);
  } catch {
    // ignore
  }
}

export function useCheckersSocket() {
  const clientIdRef = useRef<string>(getOrCreateClientId());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const activeJoinRef = useRef<{ roomId: string; playerName: string } | null>(null);
  const prevRoomRef = useRef<RoomState | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [yourRole, setYourRole] = useState<PlayerColor | 'spectator' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const activeTabRef = useRef<'moves' | 'chat'>('moves');

  const setActiveSidebarTab = useCallback((tab: 'moves' | 'chat') => {
    activeTabRef.current = tab;
    if (tab === 'chat') {
      setUnreadChatCount(0);
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const sendPayload = useCallback((payload: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const handleRoomUpdateEffects = useCallback((nextRoom: RoomState) => {
    const prev = prevRoomRef.current;
    prevRoomRef.current = nextRoom;
    if (!prev || prev.id !== nextRoom.id) return;

    if (prev.status !== 'FINISHED' && nextRoom.status === 'FINISHED') {
      soundFX.playGameEnd();
      return;
    }

    const stepAdvanced =
      nextRoom.moveHistory.length > prev.moveHistory.length ||
      nextRoom.pendingSteps.length > prev.pendingSteps.length;

    if (stepAdvanced) {
      const lastHistory = nextRoom.moveHistory[nextRoom.moveHistory.length - 1];
      const justPromoted =
        nextRoom.moveHistory.length > prev.moveHistory.length && lastHistory?.promoted;
      const wasCapture =
        nextRoom.pendingSteps.length > prev.pendingSteps.length ||
        (nextRoom.moveHistory.length > prev.moveHistory.length && lastHistory?.wasCapture);

      if (justPromoted) {
        soundFX.playPromote();
      } else if (wasCapture) {
        soundFX.playCapture();
      } else {
        soundFX.playMove();
      }
    }
  }, []);

  useEffect(() => {
    let unmounted = false;
    let reconnectAttempt = 0;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        reconnectAttempt = 0;
        setConnectionStatus('connected');

        if (activeJoinRef.current) {
          ws.send(
            JSON.stringify({
              type: 'room:join',
              roomId: activeJoinRef.current.roomId,
              clientId: clientIdRef.current,
              playerName: activeJoinRef.current.playerName,
            } satisfies ClientMessage),
          );
        }

        if (pingTimerRef.current) window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' } satisfies ClientMessage));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return;
        }

        if (msg.type === 'pong') return;

        if (msg.type === 'room:joined') {
          setErrorMessage(null);
          setRoom(msg.room);
          setYourRole(msg.yourRole);
          prevRoomRef.current = msg.room;
          activeJoinRef.current = {
            roomId: msg.room.id,
            playerName:
              msg.yourRole === 'white'
                ? msg.room.players.white?.name ?? ''
                : msg.yourRole === 'black'
                  ? msg.room.players.black?.name ?? ''
                  : getSavedPlayerName(),
          };
          const url = new URL(window.location.href);
          if (url.searchParams.get('room') !== msg.room.id) {
            url.searchParams.set('room', msg.room.id);
            window.history.replaceState({}, '', url.toString());
          }
          return;
        }

        if (msg.type === 'room:state') {
          handleRoomUpdateEffects(msg.room);
          setRoom(msg.room);
          return;
        }

        if (msg.type === 'chat:message') {
          setRoom((prev) => {
            if (!prev) return prev;
            if (prev.chat.some((m) => m.id === msg.message.id)) return prev;
            return {
              ...prev,
              chat: [...prev.chat, msg.message],
            };
          });
          if (msg.message.senderId !== clientIdRef.current) {
            soundFX.playChat();
            if (activeTabRef.current !== 'chat') {
              setUnreadChatCount((c) => c + 1);
            }
          }
          return;
        }

        if (msg.type === 'error') {
          setErrorMessage(msg.message);
          if (msg.code === 'ROOM_NOT_FOUND') {
            activeJoinRef.current = null;
          }
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        if (pingTimerRef.current) {
          window.clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        setConnectionStatus('reconnecting');
        const delay = Math.min(4000, 600 * Math.pow(1.5, reconnectAttempt));
        reconnectAttempt++;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) window.clearInterval(pingTimerRef.current);
      wsRef.current?.close();
    };
  }, [handleRoomUpdateEffects]);

  const createRoom = useCallback(
    (
      playerName: string,
      preferredSide: SidePreference,
      timeControlSec: TimeControlSeconds,
    ) => {
      setErrorMessage(null);
      savePlayerName(playerName);
      sendPayload({
        type: 'room:create',
        clientId: clientIdRef.current,
        playerName,
        preferredSide,
        timeControlSec,
      });
    },
    [sendPayload],
  );

  const joinRoom = useCallback(
    (roomId: string, playerName: string) => {
      const normalized = roomId.trim().toUpperCase();
      if (!normalized) {
        setErrorMessage('Введите код комнаты');
        return;
      }
      setErrorMessage(null);
      savePlayerName(playerName);
      activeJoinRef.current = { roomId: normalized, playerName };
      sendPayload({
        type: 'room:join',
        roomId: normalized,
        clientId: clientIdRef.current,
        playerName,
      });
    },
    [sendPayload],
  );

  const leaveRoom = useCallback(() => {
    if (room) {
      sendPayload({
        type: 'room:leave',
        roomId: room.id,
        clientId: clientIdRef.current,
      });
    }
    activeJoinRef.current = null;
    prevRoomRef.current = null;
    setRoom(null);
    setYourRole(null);
    setUnreadChatCount(0);
    setErrorMessage(null);

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }, [room, sendPayload]);

  const sendMove = useCallback(
    (from: Coord, to: Coord) => {
      if (!room) return;
      sendPayload({
        type: 'game:move',
        roomId: room.id,
        clientId: clientIdRef.current,
        from,
        to,
      });
    },
    [room, sendPayload],
  );

  const resign = useCallback(() => {
    if (!room) return;
    sendPayload({
      type: 'game:resign',
      roomId: room.id,
      clientId: clientIdRef.current,
    });
  }, [room, sendPayload]);

  const offerDraw = useCallback(() => {
    if (!room) return;
    sendPayload({
      type: 'game:draw_offer',
      roomId: room.id,
      clientId: clientIdRef.current,
    });
  }, [room, sendPayload]);

  const respondDraw = useCallback(
    (accept: boolean) => {
      if (!room) return;
      sendPayload({
        type: 'game:draw_respond',
        roomId: room.id,
        clientId: clientIdRef.current,
        accept,
      });
    },
    [room, sendPayload],
  );

  const requestRematch = useCallback(() => {
    if (!room) return;
    sendPayload({
      type: 'game:rematch',
      roomId: room.id,
      clientId: clientIdRef.current,
    });
  }, [room, sendPayload]);

  const sendChat = useCallback(
    (text: string) => {
      if (!room || !text.trim()) return;
      sendPayload({
        type: 'chat:send',
        roomId: room.id,
        clientId: clientIdRef.current,
        text: text.trim(),
      });
    },
    [room, sendPayload],
  );

  return {
    clientId: clientIdRef.current,
    connectionStatus,
    room,
    yourRole,
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
  };
}
