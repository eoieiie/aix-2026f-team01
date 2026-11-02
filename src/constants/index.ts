// 규칙에 쓰는 숫자는 이 파일 하나에 모은다 (spec.md 3절 4번).
// 서버에도 같은 값이 있으면 둘이 같은지 테스트한다.

// 4-2, 4-5
export const GROUP_NAME_MAX = 40;
export const DISPLAY_NAME_MAX = 20;
export const INVITE_CODE_LENGTH = 6;

// 4-4
export const COPIED_TOAST_MS = 2500;

// 4-6
export const RECENT_MEALS_LIMIT = 5;

// 4-7, 4-9
export const FOOD_SEARCH_LIMIT = 6;
export const PITCH_MAX = 60;

// 4-11
export const MAX_VOTES_PER_PERSON = 2;

// 4-12
export const ROULETTE_SPIN_MS = 3600;
export const ROULETTE_TURNS = 5;
export const ROULETTE_RESULT_FALLBACK_MS = 4000;
export const ROULETTE_LABEL_MAX = 7;

// 홈 모임 카드 (docs/design.md 1절)
export const HOME_RECENT_FOODS = 3;
export const PERSON_DOTS_MAX = 3;

// 룰렛 결과 순간 (docs/design.md 순간 1). 원판이 멈추고 쉬는 시간, 주황이 번지는 시간, 글자가 나타나는 시간
export const RESULT_MOMENT_PAUSE_MS = 300;
export const RESULT_MOMENT_FLOOD_MS = 450;
export const RESULT_MOMENT_TEXT_MS = 200;
