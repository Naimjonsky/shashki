import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="bg-[#382716] border-b border-[#C88A3B]/40 px-4 py-2 text-xs text-[#F3D19B] flex items-center justify-center gap-2"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Нет интернета · Доступна локальная игра на одном экране</span>
    </div>
  );
}
