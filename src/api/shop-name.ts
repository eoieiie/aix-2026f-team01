// 가게 이름에서 지점 꼬리를 뗀다 (2026-11-25 병주 "저렇게 잘리는 부분 없으면 좋겠음").
// 예: "이삭토스트 안산한양대점" → "이삭토스트", "대홍훠궈샤브샤브(한양대점)" → "대홍훠궈샤브샤브".
// 꼬리는 지역이나 학교 이름(안산, 한양대, 에리카, 한대, 사동, 상록수, 직영, 본)으로 시작해 "점"으로 끝나는 말이다.
// "보배반점"의 "반점"처럼 이름 자체인 것은 그대로 둔다. 떼고 나서 두 글자보다 짧으면 원래 이름.
// 목록, 결과 줄, 가게 상세 제목에만 쓴다. 지도 링크와 찾기는 원래 이름을 쓴다
const PLACE = '(?:안산|한양대|한양|에리카|한대|사동|상록수?|직영|본)';
const TAIL_PAREN = new RegExp(`\\s*\\(\\s*[^()]*${PLACE}[^()]*점\\s*\\)\\s*$`);
const TAIL_WORD = new RegExp(`\\s*${PLACE}[가-힣A-Za-z0-9]*점\\s*$`);

export function shortShopName(name: string): string {
  const short = name.replace(TAIL_PAREN, '').replace(TAIL_WORD, '').trim();
  return short.length >= 2 ? short : name;
}
