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
// 목록에 없는 메뉴를 직접 적을 때 이름 길이 (4-9)
export const FOOD_NAME_MAX = 20;
export const PITCH_MAX = 60;

// 4-11
export const MAX_VOTES_PER_PERSON = 2;

// 4-6, 4-12 먹을 인원수. 이 수만큼 골라야 방장이 돌릴 수 있다. 서버 0009와 같은 범위
export const HEADCOUNT_MIN = 1;
export const HEADCOUNT_MAX = 20;

// 4-19 아이디로 이어 쓰기. 아이디 모양은 4-14 아이디와 같다(영어 소문자, 숫자, 밑줄 3~16자)
// 이메일을 받지 않으려고 서버에는 "아이디@babti.invalid"로 저장한다. .invalid는 어디로도 메일이 가지 않는 예약 주소다
export const LOGIN_EMAIL_DOMAIN = 'babti.invalid';
export const PASSWORD_MIN = 6;

// 4-14
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 16;
export const QUIZ_LENGTH = 8;

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
