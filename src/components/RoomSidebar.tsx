import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Flag,
  Handshake,
  LogOut,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { MoveRecord, PlayerColor } from '../shared/checkers';
import type { RoomState } from '../shared/protocol';

interface RoomSidebarProps {
  room: RoomState;
  yourRole: PlayerColor | 'spectator' | null;
  isLocalOffline?: boolean;
  unreadChatCount: number;
  muted: boolean;
  onToggleMute: () => void;
  onFlipBoard: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onRespondDraw: (accept: boolean) => void;
  onRequestRematch: () => void;
  onSendChat: (text: string) => void;
  onLeaveRoom: () => void;
  onTabChange: (tab: 'moves' | 'chat') => void;
}

export function RoomSidebar({
  room,
  yourRole,
  isLocalOffline = false,
  unreadChatCount,
  muted,
  onToggleMute,
  onFlipBoard,
  onResign,
  onOfferDraw,
  onRespondDraw,
  onRequestRematch,
  onSendChat,
  onLeaveRoom,
  onTabChange,
}: RoomSidebarProps) {
  const [tab, setTab] = useState<'moves' | 'chat'>('moves');
  const [copied, setCopied] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [chatText, setChatText] = useState('');

  const movesEndRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const isPlayer = yourRole === 'white' || yourRole === 'black';

  useEffect(() => {
    setConfirmResign(false);
  }, [room.status, room.id]);

  useEffect(() => {
    if (tab === 'moves') {
      movesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room.moveHistory.length, tab]);

  useEffect(() => {
    if (tab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room.chat.length, tab]);

  const handleTabSelect = (nextTab: 'moves' | 'chat') => {
    setTab(nextTab);
    onTabChange(nextTab);
  };

  const handleCopyInvite = async () => {
    const shareUrl = `${window.location.origin}/?room=${room.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback via temporary textarea
      const input = document.createElement('textarea');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendChat(chatText);
    setChatText('');
  };

  const pairedMoves = useMemo(() => {
    const rows: { num: number; white?: MoveRecord; black?: MoveRecord }[] = [];
    for (let i = 0; i < room.moveHistory.length; i++) {
      const m = room.moveHistory[i];
      if (m.color === 'white') {
        rows.push({ num: rows.length + 1, white: m });
      } else {
        const last = rows[rows.length - 1];
        if (last && !last.black) {
          last.black = m;
        } else {
          rows.push({ num: rows.length + 1, black: m });
        }
      }
    }
    return rows;
  }, [room.moveHistory]);

  const opponentColor: PlayerColor | null =
    yourRole === 'white' ? 'black' : yourRole === 'black' ? 'white' : null;
  const youVotedRematch = isPlayer && room.rematchVotes.includes(yourRole);
  const opponentVotedRematch =
    opponentColor !== null && room.rematchVotes.includes(opponentColor);

  const winnerHeading =
    room.winner === 'draw'
      ? 'Ничья'
      : room.winner === 'white'
        ? yourRole === 'white'
          ? 'Вы победили'
          : 'Победа белых'
        : yourRole === 'black'
          ? 'Вы победили'
          : 'Победа чёрных';

  return (
    <aside className="flex flex-col h-full bg-[#211B18] border border-[#F5EFE6]/10 rounded-xl overflow-hidden">
      {/* Room header + invite link */}
      <div className="p-4 border-b border-[#F5EFE6]/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[#B7A99A]">
              {isLocalOffline ? 'Режим игры' : 'Код комнаты'}
            </div>
            <div className="font-mono text-lg font-semibold tracking-wider text-[#F5EFE6] tabular-nums">
              {isLocalOffline ? 'На одном экране' : room.id}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isLocalOffline && (
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#C88A3B] text-[#171311] hover:bg-[#D79949] transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Скопировано' : 'Ссылка другу'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLeaveRoom}
              title="Выйти в лобби"
              aria-label="Выйти в лобби"
              className="inline-flex items-center justify-center p-2 rounded-lg border border-[#F5EFE6]/12 text-[#C9BAA8] hover:text-[#F5EFE6] hover:bg-[#F5EFE6]/5 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {room.status === 'WAITING' && (
          <p className="mt-3 text-xs leading-relaxed text-[#C9BAA8]">
            Отправьте ссылку или код комнаты другу — партия начнётся сразу после его входа.
          </p>
        )}

        {room.spectatorCount > 0 && (
          <p className="mt-2 text-xs text-[#B7A99A]">
            Зрителей в комнате: <span className="tabular-nums">{room.spectatorCount}</span>
          </p>
        )}
      </div>

      {/* Finished game summary */}
      {room.status === 'FINISHED' && (
        <div className="p-4 bg-[#2A211B] border-b border-[#F5EFE6]/10">
          <h3 className="font-display text-2xl font-bold text-[#F5EFE6]">
            {winnerHeading}
          </h3>
          {room.winReason && (
            <p className="mt-1 text-xs text-[#C9BAA8]">{room.winReason}</p>
          )}

          {isPlayer && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onRequestRematch}
                disabled={youVotedRematch}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  youVotedRematch
                    ? 'bg-[#F5EFE6]/10 text-[#C9BAA8] cursor-default'
                    : 'bg-[#C88A3B] text-[#171311] hover:bg-[#D79949]'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {youVotedRematch ? 'Ожидание соперника' : 'Сыграть ещё раз'}
                </span>
              </button>

              {opponentVotedRematch && !youVotedRematch && (
                <span className="text-xs text-[#E3AF5B]">
                  Соперник ждёт реванш
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Draw offer banner */}
      {room.status === 'PLAYING' && room.drawOfferBy && isPlayer && (
        <div className="p-3.5 bg-[#2D241C] border-b border-[#C88A3B]/30">
          {room.drawOfferBy === yourRole ? (
            <p className="text-xs text-[#E3AF5B]">
              Вы предложили ничью. Ожидаем ответа соперника.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#F5EFE6]">
                Соперник предлагает ничью
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onRespondDraw(true)}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-[#C88A3B] text-[#171311] hover:bg-[#D79949] transition-colors whitespace-nowrap"
                >
                  Принять
                </button>
                <button
                  type="button"
                  onClick={() => onRespondDraw(false)}
                  className="px-3 py-1.5 rounded text-xs font-medium border border-[#F5EFE6]/15 text-[#C9BAA8] hover:text-[#F5EFE6] transition-colors whitespace-nowrap"
                >
                  Отклонить
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compact controls */}
      <div className="px-4 py-2.5 border-b border-[#F5EFE6]/10 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onFlipBoard}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#C9BAA8] hover:text-[#F5EFE6] hover:bg-[#F5EFE6]/5 transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Перевернуть</span>
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#C9BAA8] hover:text-[#F5EFE6] hover:bg-[#F5EFE6]/5 transition-colors whitespace-nowrap shrink-0"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{muted ? 'Без звука' : 'Звук'}</span>
        </button>

        {isPlayer && room.status === 'PLAYING' && !isLocalOffline && (
          <>
            <button
              type="button"
              onClick={onOfferDraw}
              disabled={room.drawOfferBy !== null}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#C9BAA8] hover:text-[#F5EFE6] hover:bg-[#F5EFE6]/5 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              <Handshake className="w-3.5 h-3.5" />
              <span>Ничья</span>
            </button>

            {!confirmResign ? (
              <button
                type="button"
                onClick={() => setConfirmResign(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#D98B78] hover:text-[#FFB4A2] hover:bg-[#D96B52]/10 transition-colors whitespace-nowrap shrink-0"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Сдаться</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmResign(false);
                    onResign();
                  }}
                  className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[#B84A39] text-[#F5EFE6] hover:bg-[#C95543] transition-colors whitespace-nowrap"
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResign(false)}
                  className="px-2 py-1.5 rounded-md text-xs text-[#C9BAA8] hover:text-[#F5EFE6] whitespace-nowrap"
                >
                  Отмена
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Segmented Tabs: Ходы | Чат */}
      {isLocalOffline ? (
        <div className="px-4 pt-3 flex items-center justify-between">
          <span className="text-xs font-medium text-[#C9BAA8]">
            Ходы ({room.moveHistory.length})
          </span>
          {room.status === 'PLAYING' && (
            <button
              type="button"
              onClick={onRequestRematch}
              className="text-xs text-[#E3AF5B] hover:underline whitespace-nowrap"
            >
              Начать заново
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#171311]">
            <button
              type="button"
              onClick={() => handleTabSelect('moves')}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'moves'
                  ? 'bg-[#2C2420] text-[#F5EFE6]'
                  : 'text-[#B7A99A] hover:text-[#F5EFE6]'
              }`}
            >
              Ходы ({room.moveHistory.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabSelect('chat')}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'chat'
                  ? 'bg-[#2C2420] text-[#F5EFE6]'
                  : 'text-[#B7A99A] hover:text-[#F5EFE6]'
              }`}
            >
              Чат{unreadChatCount > 0 ? ` (${unreadChatCount})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {tab === 'moves' || isLocalOffline ? (
        <div className="flex-1 min-h-[240px] max-h-[380px] overflow-y-auto p-4 club-scroll">
          {pairedMoves.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-xs text-[#9C8D7E] py-10">
              Запись партии появится после первого хода белых.
            </div>
          ) : (
            <div className="space-y-1 font-mono text-xs tabular-nums">
              {pairedMoves.map((row) => (
                <div
                  key={row.num}
                  className="grid grid-cols-[36px_1fr_1fr] gap-2 px-2 py-1 rounded hover:bg-[#F5EFE6]/5"
                >
                  <span className="text-[#8D7F71]">{row.num}.</span>
                  <span className="text-[#F5EFE6]">
                    {row.white ? (
                      <>
                        {row.white.notation}
                        {row.white.promoted ? ' Д' : ''}
                      </>
                    ) : (
                      '...'
                    )}
                  </span>
                  <span className="text-[#D4C6B6]">
                    {row.black ? (
                      <>
                        {row.black.notation}
                        {row.black.promoted ? ' Д' : ''}
                      </>
                    ) : (
                      ''
                    )}
                  </span>
                </div>
              ))}
              <div ref={movesEndRef} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-[240px] max-h-[380px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 club-scroll">
            {room.chat.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-xs text-[#9C8D7E] py-10">
                Напишите сообщение другу — оно придёт мгновенно.
              </div>
            ) : (
              room.chat.map((msg) => (
                <div key={msg.id} className="text-xs leading-relaxed">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-semibold ${
                        msg.senderColor === 'white'
                          ? 'text-[#F5EFE6]'
                          : msg.senderColor === 'black'
                            ? 'text-[#E3AF5B]'
                            : 'text-[#9C8D7E]'
                      }`}
                    >
                      {msg.senderName}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-[#8D7F71]">
                      {new Date(msg.timestamp).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-[#DFD5C8] break-words mt-0.5">{msg.text}</p>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form
            onSubmit={handleChatSubmit}
            className="p-3 border-t border-[#F5EFE6]/10 flex items-center gap-2"
          >
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              maxLength={300}
              placeholder="Сообщение..."
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#171311] border border-[#F5EFE6]/12 text-xs text-[#F5EFE6] placeholder-[#8D7F71] focus:outline-none focus:border-[#C88A3B]"
            />
            <button
              type="submit"
              disabled={!chatText.trim()}
              aria-label="Отправить сообщение"
              className="p-2 rounded-lg bg-[#C88A3B] text-[#171311] hover:bg-[#D79949] disabled:opacity-40 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
