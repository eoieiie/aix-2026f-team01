import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

type InstallPrompt = Event & { prompt: () => Promise<unknown> };

// 설치 신호는 설정 화면이 열리기 전에 올 수 있어 public/index.html에서 먼저 받는다.
function browser() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  return window as Window & { babtiInstallPrompt?: InstallPrompt };
}

function subscribe(listener: () => void) {
  const web = browser();
  web?.addEventListener('babti-install-change', listener);
  return () => web?.removeEventListener('babti-install-change', listener);
}

function canInstall() {
  return Boolean(browser()?.babtiInstallPrompt);
}

export function useWebInstall() {
  return useSyncExternalStore(subscribe, canInstall, () => false) ? showInstall : null;
}

function showInstall() {
  const web = browser();
  const event = web?.babtiInstallPrompt;
  if (!web || !event) return;
  // 설치 창은 누르는 즉시 열고, 이미 쓴 신호는 다시 쓰지 않는다.
  delete web.babtiInstallPrompt;
  void event.prompt().catch(() => undefined);
  web.dispatchEvent(new Event('babti-install-change'));
}
