// 로그인 없이 여는 주소 (명세 4-24, 4-30). 이 주소를 열기만 해서는 익명 계정을 만들지 않는다.
// 소개, 처리방침, 약관, 문의는 앱스토어 심사와 처음 온 사람이 계정 없이 읽는 글이다. 서버에 묻는 것이 없다
export const PUBLIC_PATHS = ['/about', '/privacy', '/terms', '/support'] as const;

export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.replace(/\/+$/, '') || '/';
  return (PUBLIC_PATHS as readonly string[]).includes(path);
}
