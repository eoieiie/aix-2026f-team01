// 온보딩 8문항과 네 축 (spec.md 4-14, 5절 "축 점수").
// 문항 원칙: 성향을 묻지 말고 상황을 준다. 두 답이 다 괜찮아 보여야 한다. 추상어 대신 음식 이름을 쓴다.
// 2026-11-15 리뷰(PR #70, Ruty041) 반영: 1번 새 메뉴가 맵지 않게, 4번 답을 음식 이름으로, 5번 돼지고기 없는 짝으로.
// 순서는 서버 점수 계산과 같아야 한다: 1·2 탐험↔반복, 3·4 매운맛↔순한맛, 5·6 한식↔외국음식, 7·8 주도↔수용. A가 앞 글자 쪽

export type AxisKey = 'explore' | 'spicy' | 'korean' | 'lead';

export const AXES: {
  key: AxisKey;
  front: string;
  back: string;
  frontLine: string;
  backLine: string;
}[] = [
  {
    key: 'explore',
    front: '탐',
    back: '반',
    frontLine: '새 메뉴 먼저',
    backLine: '먹던 게 좋아',
  },
  {
    key: 'spicy',
    front: '매',
    back: '순',
    frontLine: '맵게 먹어요',
    backLine: '순하게 먹어요',
  },
  {
    key: 'korean',
    front: '한',
    back: '외',
    frontLine: '한식이 좋아',
    backLine: '외국 음식이 좋아',
  },
  {
    key: 'lead',
    front: '주',
    back: '수',
    frontLine: '내가 정해요',
    backLine: '정하면 따라가요',
  },
];

export type QuizAnswer = 'A' | 'B';

// 축마다 두 문항(i*2, i*2+1). 두 답이 갈리면(점수 0) 두 번째 문항을 따른다.
// 전에는 0이면 앞 글자라 한 축에서 앞 글자가 75%였다 (PR #70 리뷰, 2026-11-15 명세 고침)
export function tieBreak(axisIndex: number, answers: readonly QuizAnswer[] | null | undefined): boolean | null {
  const a = answers?.[axisIndex * 2 + 1];
  return a === 'A' ? true : a === 'B' ? false : null;
}

export const QUIZ: { situation: string; a: string; b: string }[] = [
  {
    situation: '처음 가 본 분식집 메뉴판에 크림 떡볶이가 있다',
    a: '크림 떡볶이',
    b: '늘 먹던 떡볶이',
  },
  {
    situation: '자주 가는 국밥집에 들깨 순대국이 새로 나왔다',
    a: '들깨 순대국',
    b: '늘 먹던 순대국',
  },
  { situation: '야식으로 라면을 끓인다', a: '불닭볶음면', b: '짜파게티' },
  { situation: '닭갈비집에서 고른다', a: '매운 철판 닭갈비', b: '간장 닭갈비' },
  {
    situation: '시험 끝난 날 저녁',
    a: '된장찌개 백반',
    b: '토마토 파스타',
  },
  {
    situation: '편의점에서 점심을 고른다',
    a: '삼각김밥이랑 컵라면',
    b: '샌드위치랑 커피',
  },
  {
    situation: '넷이서 10분째 메뉴가 안 정해진다',
    a: '"국밥 가자" 먼저 말한다',
    b: '누가 정하면 따라간다',
  },
  {
    situation: '단톡방에 "점심 뭐 먹지?"가 올라왔다',
    a: '가고 싶은 가게를 먼저 올린다',
    b: '올라온 것 중에 고른다',
  },
];
