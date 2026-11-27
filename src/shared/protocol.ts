import type { Board, Coord, MoveRecord, PlayerColor } from './checkers';

export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED';
export type SidePreference = 'white' | 'black' | 'random';
export type TimeControlSeconds = 0 | 300 | 600;

export interface PlayerSlot {
  clientId: string;
  name: string;
  connected: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: PlayerColor | 'spectator';
  text: string;
  timestamp: number;
}

export interface RoomState {
  id: string;
  status: RoomStatus;
  board: Board;
  turn: PlayerColor;
  chainPos: Coord | null;
  struckInChain: Coord[];
  pendingSteps: { from: Coord; to: Coord }[];
  moveHistory: MoveRecord[];
  lastMoveCoords: { from: Coord; to: Coord } | null;
  players: {
    white: PlayerSlot | null;
    black: PlayerSlot | null;
  };
  spectatorCount: number;
  winner: PlayerColor | 'draw' | null;
  winReason: string | null;
  drawOfferBy: PlayerColor | null;
  rematchVotes: PlayerColor[];
  timeControlSec: TimeControlSeconds;
  clocks: {
    whiteMs: number;
    blackMs: number;
    lastTickAt: number | null;
  };
  chat: ChatMessage[];
  createdAt: number;
}

export type ClientMessage =
  | {
      type: 'room:create';
      clientId: string;
      playerName: string;
      preferredSide: SidePreference;
      timeControlSec: TimeControlSeconds;
    }
  | {
      type: 'room:join';
      roomId: string;
      clientId: string;
      playerName: string;
    }
  | {
      type: 'room:leave';
      roomId: string;
      clientId: string;
    }
  | {
      type: 'game:move';
      roomId: string;
      clientId: string;
      from: Coord;
      to: Coord;
    }
  | {
      type: 'game:resign';
      roomId: string;
      clientId: string;
    }
  | {
      type: 'game:draw_offer';
      roomId: string;
      clientId: string;
    }
  | {
      type: 'game:draw_respond';
      roomId: string;
      clientId: string;
      accept: boolean;
    }
  | {
      type: 'game:rematch';
      roomId: string;
      clientId: string;
    }
  | {
      type: 'chat:send';
      roomId: string;
      clientId: string;
      text: string;
    }
  | {
      type: 'ping';
    };

export type ServerMessage =
  | {
      type: 'room:joined';
      room: RoomState;
      yourRole: PlayerColor | 'spectator';
    }
  | {
      type: 'room:state';
      room: RoomState;
    }
  | {
      type: 'chat:message';
      message: ChatMessage;
    }
  | {
      type: 'error';
      message: string;
      code?: 'ROOM_NOT_FOUND' | 'INVALID_MOVE' | 'BAD_REQUEST';
    }
  | {
      type: 'pong';
    };
