// 설정 목록 아래 버전 줄 (명세 4-24, 2026-11-26). 팀 폰이 최신 판인지 이 줄로 확인한다.
// 예: "버전 1.0.0, 11월 26일 01:30 판". 판 시각이 없으면 버전만
export function versionLabel(version: string, builtAt: Date | null): string {
  if (!version) return '';
  if (!builtAt || Number.isNaN(builtAt.getTime())) return `버전 ${version}`;
  const hh = String(builtAt.getHours()).padStart(2, '0');
  const mm = String(builtAt.getMinutes()).padStart(2, '0');
  return `버전 ${version}, ${builtAt.getMonth() + 1}월 ${builtAt.getDate()}일 ${hh}:${mm} 판`;
}
