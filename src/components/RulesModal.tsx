import { X } from 'lucide-react';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export function RulesModal({ open, onClose }: RulesModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-[#211B18] border border-[#F5EFE6]/15 p-6 shadow-2xl max-h-[85vh] overflow-y-auto club-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#F5EFE6]/10">
          <h2 id="rules-modal-title" className="font-display text-2xl font-bold text-[#F5EFE6]">
            Правила русских шашек
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть правила"
            className="p-2 rounded-lg text-[#B7A99A] hover:text-[#F5EFE6] hover:bg-[#F5EFE6]/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm leading-relaxed text-[#D4C6B6]">
          <div>
            <h3 className="font-semibold text-[#F5EFE6]">1. Начало партии и ход</h3>
            <p className="mt-1">
              Партия ведётся на тёмных клетках доски 8×8. Первыми всегда ходят белые.
              Простая шашка ходит по диагонали вперёд на одну свободную клетку.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-[#F5EFE6]">2. Обязательное взятие</h3>
            <p className="mt-1">
              Бить шашки соперника обязательно. Простая шашка рубит как вперёд, так и назад,
              перепрыгивая через шашку соперника на свободную клетку за ней. Если после
              взятия можно рубить дальше, серия взятий продолжается за один ход.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-[#F5EFE6]">3. Дамка</h3>
            <p className="mt-1">
              Достигнув последней горизонтали, шашка превращается в дамку. Если превращение
              произошло во время боя и есть дальнейшее взятие, шашка продолжает бой уже
              по правилам дамки. Дамка ходит и рубит по диагонали на любое количество
              свободных клеток.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-[#F5EFE6]">4. Завершение партии</h3>
            <p className="mt-1">
              Побеждает игрок, уничтоживший все шашки соперника или лишивший его
              возможных ходов. Также партия может завершиться сдачей, истечением времени
              или ничьей по соглашению сторон.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#F5EFE6]/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#C88A3B] text-[#171311] text-sm font-semibold hover:bg-[#D79949] transition-colors"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
