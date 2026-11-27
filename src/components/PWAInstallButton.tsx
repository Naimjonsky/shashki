import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C88A3B]/45 text-xs font-medium text-[#E3AF5B] hover:bg-[#C88A3B]/10 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Установить</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C88A3B]/45 text-xs font-medium text-[#E3AF5B] hover:bg-[#C88A3B]/10 transition-colors whitespace-nowrap shrink-0"
        >
          <Share className="w-3.5 h-3.5" />
          <span>На экран</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl bg-[#211B18] border border-[#F5EFE6]/15 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F5EFE6]/10">
                <h3
                  id="ios-install-title"
                  className="font-display text-xl font-bold text-[#F5EFE6]"
                >
                  Установка на iPhone и iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Закрыть инструкцию"
                  className="p-1.5 rounded-lg text-[#B7A99A] hover:text-[#F5EFE6]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm text-[#D4C6B6] list-decimal list-inside">
                <li>
                  Нажмите кнопку <strong className="text-[#F5EFE6]">«Поделиться»</strong> на
                  панели Safari.
                </li>
                <li>
                  Прокрутите вниз и выберите{' '}
                  <strong className="text-[#F5EFE6]">«На экран „Домой“»</strong>.
                </li>
                <li>
                  Нажмите <strong className="text-[#F5EFE6]">«Добавить»</strong> в правом верхнем
                  углу.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#C88A3B] text-[#171311] text-sm font-semibold hover:bg-[#D79949] transition-colors"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
