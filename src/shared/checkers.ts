export type PlayerColor = 'white' | 'black';

export interface Piece {
  color: PlayerColor;
  isKing: boolean;
}

export type Board = (Piece | null)[][];

export interface Coord {
  r: number;
  c: number;
}

export interface LegalStep {
  from: Coord;
  to: Coord;
  captured: Coord | null;
}

export interface MoveRecord {
  ply: number;
  color: PlayerColor;
  notation: string;
  wasCapture: boolean;
  promoted: boolean;
  steps: { from: Coord; to: Coord }[];
}

export const BOARD_SIZE = 8;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function coordKey(c: Coord): string {
  return `${c.r},${c.c}`;
}

export function sameCoord(a: Coord | null | undefined, b: Coord | null | undefined): boolean {
  if (!a || !b) return false;
  return a.r === b.r && a.c === b.c;
}

export function toAlgebraic(coord: Coord): string {
  const file = FILES[coord.c] ?? '?';
  const rank = BOARD_SIZE - coord.r;
  return `${file}${rank}`;
}

export function isDarkSquare(r: number, c: number): boolean {
  return (r + c) % 2 === 1;
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!isDarkSquare(r, c)) continue;
      if (r < 3) {
        board[r][c] = { color: 'black', isKing: false };
      } else if (r > 4) {
        board[r][c] = { color: 'white', isKing: false };
      }
    }
  }

  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function oppositeColor(color: PlayerColor): PlayerColor {
  return color === 'white' ? 'black' : 'white';
}

const ALL_DIAGS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export function getCapturesFromSquare(
  board: Board,
  pos: Coord,
  struckKeys: Set<string>,
): LegalStep[] {
  const piece = board[pos.r]?.[pos.c];
  if (!piece) return [];

  const enemy = oppositeColor(piece.color);
  const steps: LegalStep[] = [];

  if (!piece.isKing) {
    // Simple checker captures forward and backward
    for (const [dr, dc] of ALL_DIAGS) {
      const mr = pos.r + dr;
      const mc = pos.c + dc;
      const lr = pos.r + 2 * dr;
      const lc = pos.c + 2 * dc;

      if (!inBounds(lr, lc)) continue;
      const mid = board[mr][mc];
      const land = board[lr][lc];

      if (
        mid &&
        mid.color === enemy &&
        !struckKeys.has(`${mr},${mc}`) &&
        land === null
      ) {
        steps.push({
          from: pos,
          to: { r: lr, c: lc },
          captured: { r: mr, c: mc },
        });
      }
    }
  } else {
    // Flying king captures along any diagonal at any distance
    for (const [dr, dc] of ALL_DIAGS) {
      let r = pos.r + dr;
      let c = pos.c + dc;
      let enemyPos: Coord | null = null;

      while (inBounds(r, c)) {
        const cell = board[r][c];
        const key = `${r},${c}`;
        if (cell !== null) {
          if (cell.color === enemy && !struckKeys.has(key)) {
            enemyPos = { r, c };
          }
          break;
        }
        r += dr;
        c += dc;
      }

      if (!enemyPos) continue;

      let lr = enemyPos.r + dr;
      let lc = enemyPos.c + dc;
      while (inBounds(lr, lc)) {
        if (board[lr][lc] !== null) break;
        steps.push({
          from: pos,
          to: { r: lr, c: lc },
          captured: enemyPos,
        });
        lr += dr;
        lc += dc;
      }
    }
  }

  return steps;
}

export function getQuietMovesFromSquare(board: Board, pos: Coord): LegalStep[] {
  const piece = board[pos.r]?.[pos.c];
  if (!piece) return [];

  const steps: LegalStep[] = [];

  if (!piece.isKing) {
    const forwardDr = piece.color === 'white' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const nr = pos.r + forwardDr;
      const nc = pos.c + dc;
      if (inBounds(nr, nc) && board[nr][nc] === null) {
        steps.push({
          from: pos,
          to: { r: nr, c: nc },
          captured: null,
        });
      }
    }
  } else {
    for (const [dr, dc] of ALL_DIAGS) {
      let nr = pos.r + dr;
      let nc = pos.c + dc;
      while (inBounds(nr, nc)) {
        if (board[nr][nc] !== null) break;
        steps.push({
          from: pos,
          to: { r: nr, c: nc },
          captured: null,
        });
        nr += dr;
        nc += dc;
      }
    }
  }

  return steps;
}

export function getLegalStepsForPlayer(
  board: Board,
  turn: PlayerColor,
  chainPos: Coord | null,
  struckInChain: Coord[],
): { steps: LegalStep[]; mustCapture: boolean } {
  const struckKeys = new Set(struckInChain.map(coordKey));

  if (chainPos) {
    const chainCaptures = getCapturesFromSquare(board, chainPos, struckKeys);
    return { steps: chainCaptures, mustCapture: true };
  }

  const allCaptures: LegalStep[] = [];
  const allQuiet: LegalStep[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell || cell.color !== turn) continue;
      const pos = { r, c };
      const captures = getCapturesFromSquare(board, pos, struckKeys);
      if (captures.length > 0) {
        allCaptures.push(...captures);
      } else if (allCaptures.length === 0) {
        allQuiet.push(...getQuietMovesFromSquare(board, pos));
      }
    }
  }

  if (allCaptures.length > 0) {
    return { steps: allCaptures, mustCapture: true };
  }
  return { steps: allQuiet, mustCapture: false };
}

export function countPieces(board: Board): {
  white: number;
  black: number;
  whiteKings: number;
  blackKings: number;
} {
  let white = 0;
  let black = 0;
  let whiteKings = 0;
  let blackKings = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      if (cell.color === 'white') {
        white++;
        if (cell.isKing) whiteKings++;
      } else {
        black++;
        if (cell.isKing) blackKings++;
      }
    }
  }

  return { white, black, whiteKings, blackKings };
}

export interface StepOutcome {
  board: Board;
  turn: PlayerColor;
  chainPos: Coord | null;
  struckInChain: Coord[];
  turnCompleted: boolean;
  wasCapture: boolean;
  promoted: boolean;
  winner: PlayerColor | null;
  winReason: string | null;
}

export function applyLegalStep(
  board: Board,
  turn: PlayerColor,
  chainPos: Coord | null,
  struckInChain: Coord[],
  from: Coord,
  to: Coord,
): StepOutcome | null {
  const { steps } = getLegalStepsForPlayer(board, turn, chainPos, struckInChain);
  const matching = steps.find(
    (s) => sameCoord(s.from, from) && sameCoord(s.to, to),
  );
  if (!matching) return null;

  const nextBoard = cloneBoard(board);
  const piece = nextBoard[from.r][from.c];
  if (!piece) return null;

  nextBoard[from.r][from.c] = null;
  const reachedPromotionRow =
    (piece.color === 'white' && to.r === 0) ||
    (piece.color === 'black' && to.r === BOARD_SIZE - 1);
  const promoted = !piece.isKing && reachedPromotionRow;

  nextBoard[to.r][to.c] = {
    color: piece.color,
    isKing: piece.isKing || promoted,
  };

  if (matching.captured) {
    const nextStruck = [...struckInChain, matching.captured];
    const nextStruckKeys = new Set(nextStruck.map(coordKey));
    const furtherCaptures = getCapturesFromSquare(nextBoard, to, nextStruckKeys);

    if (furtherCaptures.length > 0) {
      return {
        board: nextBoard,
        turn,
        chainPos: to,
        struckInChain: nextStruck,
        turnCompleted: false,
        wasCapture: true,
        promoted,
        winner: null,
        winReason: null,
      };
    }

    // Chain finished: remove all struck enemy pieces from the board
    for (const sc of nextStruck) {
      nextBoard[sc.r][sc.c] = null;
    }

    const nextTurn = oppositeColor(turn);
    const counts = countPieces(nextBoard);
    if (counts[nextTurn] === 0) {
      return {
        board: nextBoard,
        turn: nextTurn,
        chainPos: null,
        struckInChain: [],
        turnCompleted: true,
        wasCapture: true,
        promoted,
        winner: turn,
        winReason:
          turn === 'white'
            ? 'У чёрных не осталось шашек'
            : 'У белых не осталось шашек',
      };
    }

    const opponentMoves = getLegalStepsForPlayer(nextBoard, nextTurn, null, []);
    if (opponentMoves.steps.length === 0) {
      return {
        board: nextBoard,
        turn: nextTurn,
        chainPos: null,
        struckInChain: [],
        turnCompleted: true,
        wasCapture: true,
        promoted,
        winner: turn,
        winReason:
          turn === 'white'
            ? 'Чёрные заперты и не имеют ходов'
            : 'Белые заперты и не имеют ходов',
      };
    }

    return {
      board: nextBoard,
      turn: nextTurn,
      chainPos: null,
      struckInChain: [],
      turnCompleted: true,
      wasCapture: true,
      promoted,
      winner: null,
      winReason: null,
    };
  }

  // Quiet move
  const nextTurn = oppositeColor(turn);
  const opponentMoves = getLegalStepsForPlayer(nextBoard, nextTurn, null, []);
  if (opponentMoves.steps.length === 0) {
    return {
      board: nextBoard,
      turn: nextTurn,
      chainPos: null,
      struckInChain: [],
      turnCompleted: true,
      wasCapture: false,
      promoted,
      winner: turn,
      winReason:
        turn === 'white'
          ? 'Чёрные заперты и не имеют ходов'
          : 'Белые заперты и не имеют ходов',
    };
  }

  return {
    board: nextBoard,
    turn: nextTurn,
    chainPos: null,
    struckInChain: [],
    turnCompleted: true,
    wasCapture: false,
    promoted,
    winner: null,
    winReason: null,
  };
}
