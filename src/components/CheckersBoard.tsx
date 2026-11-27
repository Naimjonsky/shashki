import { useEffect, useMemo, useState } from 'react';
import {
  BOARD_SIZE,
  coordKey,
  getLegalStepsForPlayer,
  isDarkSquare,
  sameCoord,
  type Board,
  type Coord,
  type LegalStep,
  type PlayerColor,
} from '../shared/checkers';

interface CheckersBoardProps {
  board: Board;
  turn: PlayerColor;
  yourRole: PlayerColor | 'spectator' | null;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  chainPos: Coord | null;
  struckInChain: Coord[];
  lastMoveCoords: { from: Coord; to: Coord } | null;
  flipped: boolean;
  onMove: (from: Coord, to: Coord) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function KingCrown({ color }: { color: PlayerColor }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-[54%] h-[54%] drop-shadow-sm ${
        color === 'white' ? 'text-[#9C651E]' : 'text-[#E3AF5B]'
      }`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 17.5h16v2H4v-2zm.5-2.5L3 7.5l5 3.5L12 5l4 6 5-3.5-1.5 7.5h-15z" />
    </svg>
  );
}

export function CheckersBoard({
  board,
  turn,
  yourRole,
  status,
  chainPos,
  struckInChain,
  lastMoveCoords,
  flipped,
  onMove,
}: CheckersBoardProps) {
  const [selected, setSelected] = useState<Coord | null>(null);

  const canInteract =
    status === 'PLAYING' &&
    (yourRole === 'white' || yourRole === 'black') &&
    yourRole === turn;

  const { steps: legalSteps, mustCapture } = useMemo(() => {
    if (!canInteract) {
      return { steps: [] as LegalStep[], mustCapture: false };
    }
    return getLegalStepsForPlayer(board, turn, chainPos, struckInChain);
  }, [board, turn, chainPos, struckInChain, canInteract]);

  // Auto-select piece during a multi-capture chain or clear invalid selection
  useEffect(() => {
    if (!canInteract) {
      setSelected(null);
      return;
    }
    if (chainPos) {
      setSelected(chainPos);
      return;
    }
    if (selected) {
      const stillValid = legalSteps.some((s) => sameCoord(s.from, selected));
      if (!stillValid) {
        setSelected(null);
      }
    }
  }, [canInteract, chainPos, legalSteps, selected]);

  const movableFromKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of legalSteps) {
      set.add(coordKey(s.from));
    }
    return set;
  }, [legalSteps]);

  const targetsForSelected = useMemo(() => {
    if (!selected) return new Map<string, LegalStep>();
    const map = new Map<string, LegalStep>();
    for (const s of legalSteps) {
      if (sameCoord(s.from, selected)) {
        map.set(coordKey(s.to), s);
      }
    }
    return map;
  }, [legalSteps, selected]);

  const struckKeys = useMemo(
    () => new Set(struckInChain.map(coordKey)),
    [struckInChain],
  );

  const rowIndices = useMemo(() => {
    const arr = Array.from({ length: BOARD_SIZE }, (_, i) => i);
    return flipped ? arr.reverse() : arr;
  }, [flipped]);

  const colIndices = useMemo(() => {
    const arr = Array.from({ length: BOARD_SIZE }, (_, i) => i);
    return flipped ? arr.reverse() : arr;
  }, [flipped]);

  const handleSquareClick = (r: number, c: number) => {
    if (!canInteract) return;
    const coord = { r, c };
    const key = coordKey(coord);

    const targetStep = targetsForSelected.get(key);
    if (targetStep && selected) {
      onMove(selected, coord);
      if (!chainPos) {
        setSelected(null);
      }
      return;
    }

    // During a multi-capture chain, selection is locked to chainPos
    if (chainPos) return;

    if (movableFromKeys.has(key)) {
      if (sameCoord(selected, coord)) {
        setSelected(null);
      } else {
        setSelected(coord);
      }
      return;
    }

    setSelected(null);
  };

  return (
    <div className="w-full max-w-[580px] mx-auto select-none">
      {/* Timber frame */}
      <div className="p-3 sm:p-4 rounded-xl bg-[#2A201A] border border-[#F5EFE6]/12 shadow-2xl">
        <div className="grid grid-cols-[18px_1fr] gap-1.5 sm:gap-2 items-center">
          {/* Left rank coordinates (8..1) */}
          <div className="grid grid-rows-8 h-full py-0.5 text-[11px] font-mono tabular-nums text-[#C9BAA8]/70">
            {rowIndices.map((r) => (
              <div key={r} className="flex items-center justify-center">
                {BOARD_SIZE - r}
              </div>
            ))}
          </div>

          {/* 8x8 Square Grid */}
          <div
            className="aspect-square w-full grid grid-cols-8 grid-rows-8 rounded-sm overflow-hidden border border-[#140F0C]"
            role="grid"
            aria-label="Доска для русских шашек"
          >
            {rowIndices.map((r) =>
              colIndices.map((c) => {
                const dark = isDarkSquare(r, c);
                const piece = board[r][c];
                const key = `${r},${c}`;
                const isSelected = sameCoord(selected, { r, c });
                const isLastFrom = sameCoord(lastMoveCoords?.from, { r, c });
                const isLastTo = sameCoord(lastMoveCoords?.to, { r, c });
                const isTarget = targetsForSelected.has(key);
                const targetStep = targetsForSelected.get(key);
                const isMovable = canInteract && movableFromKeys.has(key);
                const isStruck = struckKeys.has(key);

                let squareBg = dark ? 'bg-[#5E3B24]' : 'bg-[#EFE0C6]';
                if (dark && (isLastFrom || isLastTo)) {
                  squareBg = 'bg-[#7A5128]';
                }
                if (isSelected) {
                  squareBg = 'bg-[#8B5E2B]';
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSquareClick(r, c)}
                    disabled={!dark || (!canInteract && !piece)}
                    aria-label={`${FILES[c]}${BOARD_SIZE - r}${
                      piece
                        ? piece.color === 'white'
                          ? piece.isKing
                            ? ', белая дамка'
                            : ', белая шашка'
                          : piece.isKing
                            ? ', чёрная дамка'
                            : ', чёрная шашка'
                        : ''
                    }`}
                    className={`relative flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E3AF5B] ${squareBg} ${
                      isMovable || isTarget ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    {/* Subtle diagonal wood highlight on dark squares */}
                    {dark && (isLastFrom || isLastTo) && (
                      <span
                        className="absolute inset-0 ring-1 ring-inset ring-[#E3AF5B]/45 pointer-events-none"
                        aria-hidden="true"
                      />
                    )}

                    {/* Target move indicator */}
                    {isTarget && (
                      <span
                        className={`z-10 pointer-events-none transition-transform duration-150 ${
                          targetStep?.captured
                            ? 'w-[54%] h-[54%] rounded-full border-[3px] border-[#E3AF5B] bg-[#E3AF5B]/20'
                            : 'w-[30%] h-[30%] rounded-full bg-[#E3AF5B]/85 shadow-sm'
                        }`}
                        aria-hidden="true"
                      />
                    )}

                    {/* Checker piece */}
                    {piece && (
                      <div
                        className={`relative z-10 w-[78%] h-[78%] rounded-full flex items-center justify-center transition-transform duration-150 ease-out ${
                          isSelected ? 'scale-108 -translate-y-0.5' : ''
                        } ${isStruck ? 'opacity-35 scale-90' : 'opacity-100'} ${
                          piece.color === 'white'
                            ? 'bg-gradient-to-b from-[#FAF4E8] to-[#DFD0B7] border border-[#B59F7E] shadow-[0_4px_8px_rgba(0,0,0,0.48),inset_0_1px_1px_rgba(255,255,255,0.85)]'
                            : 'bg-gradient-to-b from-[#332C28] to-[#171311] border border-[#0D0A09] shadow-[0_4px_8px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.14)]'
                        } ${
                          isMovable && !isSelected
                            ? mustCapture
                              ? 'ring-2 ring-[#E3AF5B] ring-offset-2 ring-offset-[#5E3B24]'
                              : 'hover:scale-105'
                            : ''
                        } ${
                          isSelected
                            ? 'ring-2 ring-[#F5EFE6] ring-offset-2 ring-offset-[#8B5E2B]'
                            : ''
                        }`}
                      >
                        {/* Concentric turned-wood grooves */}
                        <div
                          className={`w-[72%] h-[72%] rounded-full border flex items-center justify-center ${
                            piece.color === 'white'
                              ? 'border-[#C4B091]/70 bg-[#F4EAD8]/60'
                              : 'border-[#4D433D]/70 bg-[#221D1A]/80'
                          }`}
                        >
                          {piece.isKing ? (
                            <KingCrown color={piece.color} />
                          ) : (
                            <div
                              className={`w-[42%] h-[42%] rounded-full border ${
                                piece.color === 'white'
                                  ? 'border-[#C4B091]/55'
                                  : 'border-[#4D433D]/55'
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              }),
            )}
          </div>

          {/* Bottom-left empty corner */}
          <div />

          {/* Bottom file coordinates (a..h) */}
          <div className="grid grid-cols-8 pt-0.5 text-[11px] font-mono text-[#C9BAA8]/70">
            {colIndices.map((c) => (
              <div key={c} className="text-center">
                {FILES[c]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mandatory capture notice below board */}
      <div className="mt-2.5 min-h-[20px] flex items-center justify-between text-xs text-[#C9BAA8]">
        <span>
          {canInteract && mustCapture
            ? chainPos
              ? 'Продолжите серию взятий этой же шашкой'
              : 'Бить обязательно — выберите шашку с подсветкой'
            : canInteract
              ? 'Ваш ход — выберите шашку и целевую клетку'
              : status === 'WAITING'
                ? 'Ожидание второго игрока'
                : status === 'FINISHED'
                  ? 'Партия завершена'
                  : 'Ход соперника'}
        </span>
        {yourRole === 'spectator' && (
          <span className="text-[#E3AF5B]">Режим зрителя</span>
        )}
      </div>
    </div>
  );
}
