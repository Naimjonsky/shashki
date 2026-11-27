import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  applyLegalStep,
  createInitialBoard,
  oppositeColor,
  toAlgebraic,
  type PlayerColor,
} from './src/shared/checkers';
import type {
  ChatMessage,
  ClientMessage,
  RoomState,
  ServerMessage,
  TimeControlSeconds,
} from './src/shared/protocol';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

interface ConnectedClient {
  ws: WebSocket;
  clientId: string;
  roomId: string | null;
}

interface ServerRoom extends RoomState {
  pendingPromoted: boolean;
  clients: Map<WebSocket, { clientId: string; name: string }>;
}

const rooms = new Map<string, ServerRoom>();
const clientMap = new Map<WebSocket, ConnectedClient>();

const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomId(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function sanitizeName(raw: string | undefined, fallback: string): string {
  const cleaned = (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
  return cleaned.length > 0 ? cleaned : fallback;
}

function serializeRoom(room: ServerRoom): RoomState {
  const spectatorIds = new Set<string>();
  for (const meta of room.clients.values()) {
    const isWhite = room.players.white?.clientId === meta.clientId;
    const isBlack = room.players.black?.clientId === meta.clientId;
    if (!isWhite && !isBlack) {
      spectatorIds.add(meta.clientId);
    }
  }

  return {
    id: room.id,
    status: room.status,
    board: room.board,
    turn: room.turn,
    chainPos: room.chainPos,
    struckInChain: room.struckInChain,
    pendingSteps: room.pendingSteps,
    moveHistory: room.moveHistory,
    lastMoveCoords: room.lastMoveCoords,
    players: room.players,
    spectatorCount: spectatorIds.size,
    winner: room.winner,
    winReason: room.winReason,
    drawOfferBy: room.drawOfferBy,
    rematchVotes: room.rematchVotes,
    timeControlSec: room.timeControlSec,
    clocks: room.clocks,
    chat: room.chat,
    createdAt: room.createdAt,
  };
}

function sendToSocket(ws: WebSocket, payload: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoomState(room: ServerRoom): void {
  const message: ServerMessage = {
    type: 'room:state',
    room: serializeRoom(room),
  };
  const serialized = JSON.stringify(message);
  for (const ws of room.clients.keys()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

function broadcastChatMessage(room: ServerRoom, chatMessage: ChatMessage): void {
  const message: ServerMessage = {
    type: 'chat:message',
    message: chatMessage,
  };
  const serialized = JSON.stringify(message);
  for (const ws of room.clients.keys()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

function getRoleInRoom(room: ServerRoom, clientId: string): PlayerColor | 'spectator' {
  if (room.players.white?.clientId === clientId) return 'white';
  if (room.players.black?.clientId === clientId) return 'black';
  return 'spectator';
}

function detachSocketFromRoom(ws: WebSocket): void {
  const conn = clientMap.get(ws);
  if (!conn || !conn.roomId) return;

  const room = rooms.get(conn.roomId);
  conn.roomId = null;
  if (!room) return;

  const meta = room.clients.get(ws);
  room.clients.delete(ws);

  if (meta) {
    // Check if the same clientId still has another active socket in the room
    let stillConnected = false;
    for (const other of room.clients.values()) {
      if (other.clientId === meta.clientId) {
        stillConnected = true;
        break;
      }
    }

    if (!stillConnected) {
      if (room.players.white?.clientId === meta.clientId) {
        room.players.white.connected = false;
      }
      if (room.players.black?.clientId === meta.clientId) {
        room.players.black.connected = false;
      }
    }
  }

  broadcastRoomState(room);
}

function syncClockBeforeAction(room: ServerRoom): boolean {
  if (room.status !== 'PLAYING' || room.timeControlSec === 0 || !room.clocks.lastTickAt) {
    return false;
  }

  const now = Date.now();
  const elapsed = Math.max(0, now - room.clocks.lastTickAt);
  room.clocks.lastTickAt = now;

  if (room.turn === 'white') {
    room.clocks.whiteMs = Math.max(0, room.clocks.whiteMs - elapsed);
    if (room.clocks.whiteMs === 0) {
      room.status = 'FINISHED';
      room.winner = 'black';
      room.winReason = 'У белых закончилось время';
      room.clocks.lastTickAt = null;
      return true;
    }
  } else {
    room.clocks.blackMs = Math.max(0, room.clocks.blackMs - elapsed);
    if (room.clocks.blackMs === 0) {
      room.status = 'FINISHED';
      room.winner = 'white';
      room.winReason = 'У чёрных закончилось время';
      room.clocks.lastTickAt = null;
      return true;
    }
  }

  return false;
}

function formatMoveNotation(
  steps: { from: { r: number; c: number }; to: { r: number; c: number } }[],
  wasCapture: boolean,
): string {
  if (steps.length === 0) return '';
  const sep = wasCapture ? ':' : '-';
  const parts = [toAlgebraic(steps[0].from), ...steps.map((s) => toAlgebraic(s.to))];
  return parts.join(sep);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.get('/api/rooms/:id', (req, res) => {
    const code = req.params.id.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false });
      return;
    }
    res.json({
      exists: true,
      id: room.id,
      status: room.status,
      hasOpenSeat: !room.players.white || !room.players.black,
    });
  });

  const server = http.createServer(app);

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server, path: '/vite-hmr' },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url ?? '', 'http://localhost');
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    clientMap.set(ws, { ws, clientId: '', roomId: null });

    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        sendToSocket(ws, {
          type: 'error',
          code: 'BAD_REQUEST',
          message: 'Некорректный формат сообщения',
        });
        return;
      }

      if (msg.type === 'ping') {
        sendToSocket(ws, { type: 'pong' });
        return;
      }

      if (msg.type === 'room:create') {
        detachSocketFromRoom(ws);

        const clientId = msg.clientId.trim();
        if (!clientId) return;

        const roomId = generateRoomId();
        const playerName = sanitizeName(msg.playerName, 'Игрок 1');
        const timeControlSec: TimeControlSeconds =
          msg.timeControlSec === 300 || msg.timeControlSec === 600 ? msg.timeControlSec : 0;
        const initialMs = timeControlSec * 1000;

        let chosenSide: PlayerColor;
        if (msg.preferredSide === 'white' || msg.preferredSide === 'black') {
          chosenSide = msg.preferredSide;
        } else {
          chosenSide = Math.random() < 0.5 ? 'white' : 'black';
        }

        const room: ServerRoom = {
          id: roomId,
          status: 'WAITING',
          board: createInitialBoard(),
          turn: 'white',
          chainPos: null,
          struckInChain: [],
          pendingSteps: [],
          pendingPromoted: false,
          moveHistory: [],
          lastMoveCoords: null,
          players: {
            white: chosenSide === 'white' ? { clientId, name: playerName, connected: true } : null,
            black: chosenSide === 'black' ? { clientId, name: playerName, connected: true } : null,
          },
          spectatorCount: 0,
          winner: null,
          winReason: null,
          drawOfferBy: null,
          rematchVotes: [],
          timeControlSec,
          clocks: {
            whiteMs: initialMs,
            blackMs: initialMs,
            lastTickAt: null,
          },
          chat: [],
          createdAt: Date.now(),
          clients: new Map(),
        };

        room.clients.set(ws, { clientId, name: playerName });
        rooms.set(roomId, room);
        clientMap.set(ws, { ws, clientId, roomId });

        sendToSocket(ws, {
          type: 'room:joined',
          room: serializeRoom(room),
          yourRole: chosenSide,
        });
        return;
      }

      if (msg.type === 'room:join') {
        detachSocketFromRoom(ws);

        const roomId = msg.roomId.trim().toUpperCase();
        const clientId = msg.clientId.trim();
        const room = rooms.get(roomId);

        if (!room) {
          sendToSocket(ws, {
            type: 'error',
            code: 'ROOM_NOT_FOUND',
            message: `Комната ${roomId} не найдена`,
          });
          return;
        }

        const fallbackName =
          room.players.white && !room.players.black
            ? 'Игрок 2'
            : !room.players.white && room.players.black
              ? 'Игрок 1'
              : 'Гость';
        const playerName = sanitizeName(msg.playerName, fallbackName);

        // Reconnect existing player
        if (room.players.white?.clientId === clientId) {
          room.players.white.connected = true;
          if (msg.playerName.trim()) room.players.white.name = playerName;
        } else if (room.players.black?.clientId === clientId) {
          room.players.black.connected = true;
          if (msg.playerName.trim()) room.players.black.name = playerName;
        } else if (!room.players.white) {
          room.players.white = { clientId, name: playerName, connected: true };
        } else if (!room.players.black) {
          room.players.black = { clientId, name: playerName, connected: true };
        }

        if (room.status === 'WAITING' && room.players.white && room.players.black) {
          room.status = 'PLAYING';
          if (room.timeControlSec > 0) {
            room.clocks.lastTickAt = Date.now();
          }
        }

        room.clients.set(ws, { clientId, name: playerName });
        clientMap.set(ws, { ws, clientId, roomId });

        const role = getRoleInRoom(room, clientId);
        sendToSocket(ws, {
          type: 'room:joined',
          room: serializeRoom(room),
          yourRole: role,
        });
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'room:leave') {
        detachSocketFromRoom(ws);
        return;
      }

      // Room-scoped actions
      const room = rooms.get(msg.roomId.trim().toUpperCase());
      if (!room) {
        sendToSocket(ws, {
          type: 'error',
          code: 'ROOM_NOT_FOUND',
          message: 'Комната не найдена',
        });
        return;
      }

      const role = getRoleInRoom(room, msg.clientId);

      if (msg.type === 'chat:send') {
        const text = msg.text.trim().slice(0, 300);
        if (!text) return;
        const meta = room.clients.get(ws);
        const senderName =
          role === 'white'
            ? room.players.white?.name ?? 'Белые'
            : role === 'black'
              ? room.players.black?.name ?? 'Чёрные'
              : meta?.name ?? 'Зритель';

        const chatMsg: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          senderId: msg.clientId,
          senderName,
          senderColor: role,
          text,
          timestamp: Date.now(),
        };
        room.chat.push(chatMsg);
        if (room.chat.length > 100) {
          room.chat.shift();
        }
        broadcastChatMessage(room, chatMsg);
        return;
      }

      if (role === 'spectator') {
        sendToSocket(ws, {
          type: 'error',
          code: 'BAD_REQUEST',
          message: 'Зрители не могут управлять партией',
        });
        return;
      }

      if (msg.type === 'game:move') {
        if (room.status !== 'PLAYING' || room.turn !== role) {
          sendToSocket(ws, {
            type: 'error',
            code: 'INVALID_MOVE',
            message: 'Сейчас не ваш ход',
          });
          return;
        }

        const timedOut = syncClockBeforeAction(room);
        if (timedOut) {
          broadcastRoomState(room);
          return;
        }

        const outcome = applyLegalStep(
          room.board,
          room.turn,
          room.chainPos,
          room.struckInChain,
          msg.from,
          msg.to,
        );

        if (!outcome) {
          sendToSocket(ws, {
            type: 'error',
            code: 'INVALID_MOVE',
            message: 'Недопустимый ход по правилам русских шашек',
          });
          return;
        }

        room.board = outcome.board;
        room.turn = outcome.turn;
        room.chainPos = outcome.chainPos;
        room.struckInChain = outcome.struckInChain;
        room.pendingSteps.push({ from: msg.from, to: msg.to });
        room.pendingPromoted = room.pendingPromoted || outcome.promoted;
        room.lastMoveCoords = { from: msg.from, to: msg.to };

        if (outcome.turnCompleted) {
          const notation = formatMoveNotation(room.pendingSteps, outcome.wasCapture);
          room.moveHistory.push({
            ply: room.moveHistory.length + 1,
            color: role,
            notation,
            wasCapture: outcome.wasCapture,
            promoted: room.pendingPromoted,
            steps: [...room.pendingSteps],
          });
          room.pendingSteps = [];
          room.pendingPromoted = false;
          room.drawOfferBy = null;

          if (room.timeControlSec > 0 && !outcome.winner) {
            room.clocks.lastTickAt = Date.now();
          }
        }

        if (outcome.winner) {
          room.status = 'FINISHED';
          room.winner = outcome.winner;
          room.winReason = outcome.winReason;
          room.clocks.lastTickAt = null;
        }

        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'game:resign') {
        if (room.status !== 'PLAYING') return;
        room.status = 'FINISHED';
        room.winner = oppositeColor(role);
        room.winReason = role === 'white' ? 'Белые сдались' : 'Чёрные сдались';
        room.clocks.lastTickAt = null;
        room.drawOfferBy = null;
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'game:draw_offer') {
        if (room.status !== 'PLAYING') return;
        if (room.drawOfferBy === null) {
          room.drawOfferBy = role;
          broadcastRoomState(room);
        }
        return;
      }

      if (msg.type === 'game:draw_respond') {
        if (room.status !== 'PLAYING' || !room.drawOfferBy || room.drawOfferBy === role) return;
        if (msg.accept) {
          room.status = 'FINISHED';
          room.winner = 'draw';
          room.winReason = 'Ничья по соглашению сторон';
          room.clocks.lastTickAt = null;
          room.drawOfferBy = null;
        } else {
          room.drawOfferBy = null;
        }
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'game:rematch') {
        if (room.status !== 'FINISHED') return;
        if (!room.rematchVotes.includes(role)) {
          room.rematchVotes.push(role);
        }

        if (
          room.rematchVotes.includes('white') &&
          room.rematchVotes.includes('black') &&
          room.players.white &&
          room.players.black
        ) {
          // Swap sides for fair rematch
          const prevWhite = room.players.white;
          const prevBlack = room.players.black;
          room.players.white = prevBlack;
          room.players.black = prevWhite;

          room.board = createInitialBoard();
          room.turn = 'white';
          room.chainPos = null;
          room.struckInChain = [];
          room.pendingSteps = [];
          room.pendingPromoted = false;
          room.moveHistory = [];
          room.lastMoveCoords = null;
          room.winner = null;
          room.winReason = null;
          room.drawOfferBy = null;
          room.rematchVotes = [];
          room.status = 'PLAYING';
          const initialMs = room.timeControlSec * 1000;
          room.clocks = {
            whiteMs: initialMs,
            blackMs: initialMs,
            lastTickAt: room.timeControlSec > 0 ? Date.now() : null,
          };

          // Re-send room:joined to each player so their role swaps cleanly
          for (const [sock, meta] of room.clients.entries()) {
            sendToSocket(sock, {
              type: 'room:joined',
              room: serializeRoom(room),
              yourRole: getRoleInRoom(room, meta.clientId),
            });
          }
          return;
        }

        broadcastRoomState(room);
      }
    });

    ws.on('close', () => {
      detachSocketFromRoom(ws);
      clientMap.delete(ws);
    });
  });

  // Periodic clock expiration check & stale room cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      if (room.status === 'PLAYING' && room.timeControlSec > 0 && room.clocks.lastTickAt) {
        const elapsed = now - room.clocks.lastTickAt;
        const activeMs = room.turn === 'white' ? room.clocks.whiteMs : room.clocks.blackMs;
        if (activeMs - elapsed <= 0) {
          syncClockBeforeAction(room);
          broadcastRoomState(room);
        }
      }

      if (room.clients.size === 0 && now - room.createdAt > 2 * 60 * 60 * 1000) {
        rooms.delete(roomId);
      }
    }
  }, 1000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Russian Checkers server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
