import { Platform } from 'react-native';

// 웹 첫 방문은 소개부터 (명세 4-30, 2026-11-26).
// 웹에서 로그인 기록이 없는 사람이 루트(/)를 열면 익명 계정을 만들기 전에 /about으로 보낸다.
// 소개의 "바로 시작하기"를 누르면 표시를 남겨 그때부터 앱으로 들어간다(다시 소개로 튕기지 않음).
// 초대 링크(/g/코드)와 다른 주소는 지금처럼 바로 간다. 네이티브 앱은 바뀌지 않는다

// "바로 시작하기"를 눌렀다는 표시
export const STARTED_KEY = 'babti:started';
// supabase-js가 웹에서 로그인을 남기는 이름 (sb-<프로젝트>-auth-token)
const SESSION_KEY = /^sb-.+-auth-token$/;

type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>;

function webStorage(): KeyStore | null {
  if (Platform.OS !== 'web') return null;
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    // 저장소를 막은 브라우저는 지금처럼 바로 앱으로 간다
    return null;
  }
}

export function hasLoginRecord(store: KeyStore): boolean {
  if (store.getItem(STARTED_KEY)) return true;
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && SESSION_KEY.test(k)) return true;
  }
  return false;
}

export function isFirstWebVisit(pathname: string | null | undefined, store: KeyStore | null = webStorage()): boolean {
  if (!store) return false;
  const path = (pathname ?? '').replace(/\/+$/, '') || '/';
  if (path !== '/') return false;
  return !hasLoginRecord(store);
}

// 소개의 "바로 시작하기"에서 부른다
export function markStarted(store: KeyStore | null = webStorage()) {
  try {
    store?.setItem(STARTED_KEY, '1');
  } catch {
    // 남기지 못해도 이번 열기에는 익명 계정이 생겨 다음부터 로그인 기록으로 들어간다
  }
}
