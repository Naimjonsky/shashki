import { useEffect, useState } from 'react';
import type { PlayerColor } from '../shared/checkers';
import type { PlayerSlot, RoomStatus, TimeControlSeconds } from '../shared/protocol';

interface PlayerBarProps {
  color: PlayerColor;
  slot: PlayerSlot | null;
  isYou: boolean;
  isActiveTurn: boolean;
  status: RoomStatus;
  capturedCount: number;
  timeControlSec: TimeControlSeconds;
  clockMs: number;
  lastTickAt: number | null;
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function PlayerBar({
  color,
  slot,
  isYou,
  isActiveTurn,
  status,
  capturedCount,
  timeControlSec,
  clockMs,
  lastTickAt,
}: PlayerBarProps) {
  const [displayMs, setDisplayMs] = useState(clockMs);

  useEffect(() => {
    setDisplayMs(clockMs);
    if (status !== 'PLAYING' || !isActiveTurn || !lastTickAt || timeControlSec === 0) {
      return;
    }

    const update = () => {
      const elapsed = Math.max(0, Date.now() - lastTickAt);
      setDisplayMs(Math.max(0, clockMs - elapsed));
    };
    update();
    const id = window.setInterval(update, 200);
    return () => window.clearInterval(id);
  }, [clockMs, lastTickAt, isActiveTurn, status, timeControlSec]);

  const colorLabel = color === 'white' ? 'Белые' : 'Чёрные';
  const lowTime = timeControlSec > 0 && displayMs <= 30_000 && status === 'PLAYING';

  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg border transition-colors duration-150 ${
        isActiveTurn && status === 'PLAYING'
          ? 'bg-[#2B231D] border-[#C88A3B]/60'
          : 'bg-[#211B18] border-[#F5EFE6]/10'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Piece swatch */}
        <span
          className={`w-6 h-6 rounded-full shrink-0 border ${
            color === 'white'
              ? 'bg-[#F3E9D8] border-[#B59F7E]'
              : 'bg-[#1A1513] border-[#4A3F38]'
          }`}
          aria-hidden="true"
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-[#F5EFE6] truncate">
              {slot ? slot.name : 'Ожидание игрока...'}
            </span>
            {isYou && (
              <span className="text-xs text-[#E3AF5B] shrink-0">Вы</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[#B7A99A]">
            <span>{colorLabel}</span>
            {slot && (
              <>
                <span aria-hidden="true">·</span>
                <span className={slot.connected ? 'text-[#89B88B]' : 'text-[#D08A6C]'}>
                  {slot.connected ? 'В сети' : 'Переподключение'}
                </span>
              </>
            )}
            {capturedCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums text-[#F5EFE6]/85">
                  Срублено: {capturedCount}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {status === 'PLAYING' && isActiveTurn && (
          <span className="text-xs font-medium text-[#E3AF5B] whitespace-nowrap">
            {isYou ? 'Ваш ход' : 'Ходит'}
          </span>
        )}

        {timeControlSec > 0 && (
          <div
            className={`px-2.5 py-1 rounded font-mono text-sm font-semibold tabular-nums border ${
              lowTime
                ? 'bg-[#42201C] border-[#D96B52]/50 text-[#FFB4A2]'
                : isActiveTurn && status === 'PLAYING'
                  ? 'bg-[#171311] border-[#C88A3B]/50 text-[#F5EFE6]'
                  : 'bg-[#171311]/70 border-[#F5EFE6]/10 text-[#B7A99A]'
            }`}
          >
            {formatClock(displayMs)}
          </div>
        )}
      </div>
    </div>
  );
}
