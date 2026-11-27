import { useState, type FormEvent } from 'react';
import { createInitialBoard, isDarkSquare } from '../shared/checkers';
import type { SidePreference, TimeControlSeconds } from '../shared/protocol';

interface LobbyViewProps {
  initialName: string;
  initialRoomCode: string;
  isConnected: boolean;
  errorMessage: string | null;
  onCreateRoom: (
    playerName: string,
    preferredSide: SidePreference,
    timeControlSec: TimeControlSeconds,
  ) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onStartLocalGame: () => void;
  onOpenRules: () => void;
}

const PREVIEW_BOARD = createInitialBoard();

export function LobbyView({
  initialName,
  initialRoomCode,
  isConnected,
  errorMessage,
  onCreateRoom,
  onJoinRoom,
  onStartLocalGame,
  onOpenRules,
}: LobbyViewProps) {
  const [mode, setMode] = useState<'create' | 'join'>(
    initialRoomCode ? 'join' : 'create',
  );
  const [playerName, setPlayerName] = useState(initialName);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [preferredSide, setPreferredSide] = useState<SidePreference>('random');
  const [timeControlSec, setTimeControlSec] = useState<TimeControlSeconds>(0);

  const handleSubmitCreate = (e: FormEvent) => {
    e.preventDefault();
    onCreateRoom(playerName.trim() || 'Игрок 1', preferredSide, timeControlSec);
  };

  const handleSubmitJoin = (e: FormEvent) => {
    e.preventDefault();
    onJoinRoom(roomCode, playerName.trim() || 'Игрок 2');
  };

  return (
    <main className="max-w-[1160px] mx-auto px-4 sm:px-6 py-8 lg:py-14">
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
        {/* Left: Editorial Headline + Room Setup */}
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#F5EFE6] leading-[1.08] text-balance">
            Русские шашки онлайн с друзьями
          </h1>
          <p className="mt-4 text-base text-[#C9BAA8] leading-relaxed max-w-xl">
            Создайте приватную комнату за пару секунд и отправьте ссылку другу.
            Официальные правила русских шашек, запись ходов и живой чат за одной доской.
          </p>

          {/* Segmented mode tabs */}
          <div className="mt-8 bg-[#211B18] border border-[#F5EFE6]/10 rounded-xl p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#171311] mb-6">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  mode === 'create'
                    ? 'bg-[#2C2420] text-[#F5EFE6]'
                    : 'text-[#B7A99A] hover:text-[#F5EFE6]'
                }`}
              >
                Создать комнату
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  mode === 'join'
                    ? 'bg-[#2C2420] text-[#F5EFE6]'
                    : 'text-[#B7A99A] hover:text-[#F5EFE6]'
                }`}
              >
                Войти по коду
              </button>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mb-5 px-3.5 py-2.5 rounded-lg bg-[#42201C] border border-[#D96B52]/40 text-xs text-[#FFB4A2]"
              >
                {errorMessage}
              </div>
            )}

            {mode === 'create' ? (
              <form onSubmit={handleSubmitCreate} className="space-y-5">
                <div>
                  <label
                    htmlFor="create-name"
                    className="block text-xs font-medium text-[#C9BAA8] mb-1.5"
                  >
                    Ваше имя
                  </label>
                  <input
                    id="create-name"
                    type="text"
                    maxLength={24}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Например, Алексей"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#171311] border border-[#F5EFE6]/15 text-sm text-[#F5EFE6] placeholder-[#8D7F71] focus:outline-none focus:border-[#C88A3B]"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-[#C9BAA8] mb-1.5">
                    Выбор цвета
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { value: 'white', label: 'Белые' },
                        { value: 'random', label: 'Случайно' },
                        { value: 'black', label: 'Чёрные' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPreferredSide(opt.value)}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                          preferredSide === opt.value
                            ? 'bg-[#2E241C] border-[#C88A3B] text-[#F5EFE6]'
                            : 'bg-[#171311] border-[#F5EFE6]/10 text-[#B7A99A] hover:text-[#F5EFE6]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium text-[#C9BAA8] mb-1.5">
                    Контроль времени
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { value: 0, label: 'Без таймера' },
                        { value: 300, label: '5 минут' },
                        { value: 600, label: '10 минут' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTimeControlSec(opt.value)}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                          timeControlSec === opt.value
                            ? 'bg-[#2E241C] border-[#C88A3B] text-[#F5EFE6]'
                            : 'bg-[#171311] border-[#F5EFE6]/10 text-[#B7A99A] hover:text-[#F5EFE6]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isConnected}
                  className="w-full py-3 px-5 rounded-lg bg-[#C88A3B] text-[#171311] font-semibold text-sm hover:bg-[#D79949] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {isConnected ? 'Создать комнату' : 'Подключение к серверу...'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmitJoin} className="space-y-5">
                <div>
                  <label
                    htmlFor="join-code"
                    className="block text-xs font-medium text-[#C9BAA8] mb-1.5"
                  >
                    Код комнаты
                  </label>
                  <input
                    id="join-code"
                    type="text"
                    maxLength={8}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="Например, A7K9M2"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#171311] border border-[#F5EFE6]/15 font-mono text-base tracking-widest uppercase text-[#F5EFE6] placeholder-[#8D7F71] focus:outline-none focus:border-[#C88A3B]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="join-name"
                    className="block text-xs font-medium text-[#C9BAA8] mb-1.5"
                  >
                    Ваше имя
                  </label>
                  <input
                    id="join-name"
                    type="text"
                    maxLength={24}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Например, Мария"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#171311] border border-[#F5EFE6]/15 text-sm text-[#F5EFE6] placeholder-[#8D7F71] focus:outline-none focus:border-[#C88A3B]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isConnected || !roomCode.trim()}
                  className="w-full py-3 px-5 rounded-lg bg-[#C88A3B] text-[#171311] font-semibold text-sm hover:bg-[#D79949] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {isConnected ? 'Войти в комнату' : 'Подключение к серверу...'}
                </button>
              </form>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[#9C8D7E]">
            <span>Бить обязательно</span>
            <span aria-hidden="true">·</span>
            <span>Бой назад разрешён</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onOpenRules}
              className="text-[#E3AF5B] hover:underline whitespace-nowrap"
            >
              Подробнее о правилах
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onStartLocalGame}
              className="text-[#F5EFE6] hover:text-[#E3AF5B] underline-offset-4 hover:underline whitespace-nowrap"
            >
              Вдвоём на одном экране (офлайн)
            </button>
          </div>
        </div>

        {/* Right: Tactile Board Showcase */}
        <div className="hidden sm:block">
          <div className="p-4 rounded-xl bg-[#2A201A] border border-[#F5EFE6]/12 shadow-2xl max-w-[460px] mx-auto">
            <div className="aspect-square w-full grid grid-cols-8 grid-rows-8 rounded-sm overflow-hidden border border-[#140F0C]">
              {PREVIEW_BOARD.map((row, r) =>
                row.map((piece, c) => {
                  const dark = isDarkSquare(r, c);
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`flex items-center justify-center ${
                        dark ? 'bg-[#5E3B24]' : 'bg-[#EFE0C6]'
                      }`}
                    >
                      {piece && (
                        <div
                          className={`w-[76%] h-[76%] rounded-full flex items-center justify-center ${
                            piece.color === 'white'
                              ? 'bg-gradient-to-b from-[#FAF4E8] to-[#DFD0B7] border border-[#B59F7E] shadow-[0_3px_6px_rgba(0,0,0,0.45)]'
                              : 'bg-gradient-to-b from-[#332C28] to-[#171311] border border-[#0D0A09] shadow-[0_3px_6px_rgba(0,0,0,0.55)]'
                          }`}
                        >
                          <div
                            className={`w-[68%] h-[68%] rounded-full border ${
                              piece.color === 'white'
                                ? 'border-[#C4B091]/70'
                                : 'border-[#4D433D]/70'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
