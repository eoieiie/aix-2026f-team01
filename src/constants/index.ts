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
// 4-22 AI 재료 추정 하루 호출 상한. 넘으면 낱말 표만 쓴다(서버 0023)
export const AI_DAILY_MAX = 200;
export const PITCH_MAX = 60;

// 4-11
export const MAX_VOTES_PER_PERSON = 2;

// 4-20 식사 기록을 판에 다시 쓰기. 며칠 안에 먹었으면 후보 카드에 알린다, 단골 칩 개수, 빈 판에서 한 번에 채우는 개수
export const RECENT_EATEN_DAYS = 14;
export const GROUP_FAVORITES_MAX = 3;
export const QUICK_FILL_COUNT = 3;

// 4-15 하단 탭(#41, 4-26, 4-31). 화면 아래에 떠 있는 흰 알약(2026-11-26). 양옆은 화면 여백 16만큼 띄운다.
// 알약 높이, 지금 화면 칸의 옅은 주황 원 지름, 안전 영역 위로 띄우는 거리
export const TAB_BAR_HEIGHT = 64;
export const TAB_DOT_SIZE = 44;
export const TAB_BAR_GAP = 8;
// 탭 화면이 목록 아래를 비우는 높이. 알약(64) + 띄움(8) + 홈 표시줄(34) + 마지막 카드가 알약 위로 다 올라올 여유(24) = 130.
// 목록은 알약 뒤로 지나가고, 끝까지 내리면 마지막 줄이 알약 위로 올라온다. 프로필은 여기에 안전 영역을 더 비운다
export const TAB_BAR_SPACE = 130;

// 4-21 투표 화면 추천 칸. 서버가 주는 최대 6곳 중 내 취향으로 고르는 수
export const VOTE_RESTAURANTS_SHOWN = 3;

// 4-26 가게 탭. 목록 칸 왼쪽 그림 크기, 판 결과의 식당 줄 그림 크기
export const SHOP_THUMB_SIZE = 72;
export const SHOP_ROW_THUMB_SIZE = 56;

// 4-27 쿠폰. 받은 뒤 쓸 수 있는 시간, 가게 비밀번호 자릿수와 틀릴 수 있는 횟수. 서버 0033 coupon_rule과 같은 값
export const COUPON_VALID_HOURS = 24;
export const STAFF_PIN_LENGTH = 4;
export const PIN_MAX_TRIES = 5;

// 4-28 가게 통계에서 시간대와 메뉴 분포, "다녀간 팀"을 보이는 최소 팀 수. 서버 0033 coupon_rule과 같은 값
export const SHOP_STATS_MIN = 5;

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
// 홈 모임 카드 오른쪽 아래의 먹은 음식 줄. 서버 home_group_foods(0053)의 v_max와 같은 값
export const HOME_PLATE_FOODS = 4;
export const PERSON_DOTS_MAX = 3;

// 룰렛 결과 순간 (docs/design.md 순간 1). 원판이 멈추고 쉬는 시간, 주황이 번지는 시간, 글자가 나타나는 시간
export const RESULT_MOMENT_PAUSE_MS = 300;
export const RESULT_MOMENT_FLOOD_MS = 450;
export const RESULT_MOMENT_TEXT_MS = 200;
