# 프로젝트명 / Project Name

> 한 줄 소개 — 누구의 어떤 문제를 해결하는가
> One line — whose problem does this solve?

**배포 URL / Live URL:** (13주차에 작성 / add in Week 13)

## 1. 문제 정의 / Problem Definition
- 사용자 / Users:
- 상황 / Situation:
- 페인포인트 / Pain point:
- 성공 기준 / Success criteria:

## 2. 사용자 확인 / User Validation
인터뷰 3명 요지 / Summary of three interviews (원문: [`docs/interviews.md`](docs/interviews.md), 이슈 #44):
1. 채식을 등록하니 고기가 든 후보가 다 지워져서 왜 빠지는지 몰랐다. 그래서 후보를 지우지 않고 "못 먹는 사람이 있어요"로 알리게 바꿨다 (PR #59)
2. 친구가 고르는 중에 먼저 돌려버렸다, 아무거나 먹어도 되는 사람이 누를 칸이 있으면 좋겠다. 그래서 정한 인원이 다 골라야 돌리기가 켜지고 "아무거나 괜찮아요"를 넣었다 (PR #59)
3. 검색칸에 음식 이름만 쓰고 고르지 않았다. 그래서 목록에 없는 메뉴도 적어 올리고, 엔터로도 올라가게 했다 (0008, PR #59)

세 사람 모두 "딱히 먹고 싶은 게 없을 때 고르기 어렵다"고 했다. 설문 78명 중 76.9%도 "아무거나" 때문에 고민한 적이 있다 ([`docs/survey-result.md`](docs/survey-result.md)).

## 3. 실행 방법 / How to Run
Node 버전은 `.nvmrc`를 따른다 (`nvm use`).

```bash
npm install
cp .env.example .env
npx expo start --web
```

`.env`에 Supabase 주소와 공개 키를 채워야 로그인된다. 비어 있으면 "연결할 수 없어요" 화면이 뜬다.
필요한 환경변수 / Required environment variables: `.env.example` 참고

폴더 / Folders:

| 폴더 | 두는 것 |
|---|---|
| `src/app/` | 화면. 파일 이름이 주소가 된다 (expo-router). `supabase`를 import하지 않는다 |
| `src/components/` | 화면 조각. `supabase`를 import하지 않는다 |
| `src/hooks/` | 화면이 부르는 데이터 훅 (TanStack Query) |
| `src/api/` | Supabase 호출. 클라이언트는 `src/api/supabase.ts` 하나 |
| `src/constants/` | 규칙에 쓰는 숫자 (`index.ts` 하나) |
| `tailwind.config.js` | 색 토큰. 화면에는 색 이름만 쓴다 |

화면 폴더에서 `supabase`나 `src/api`를 import하면 린트가 실패한다 (`eslint.config.js`).

검사 / Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:web` (PR마다 GitHub Actions가 같은 순서로 돈다)

## 4. 아키텍처 / Architecture
![architecture](docs/architecture.png)

- 표현 계층 / Presentation:
- 로직 계층 / Logic:
- 데이터 계층 / Data:

## 5. 기술 스택과 선택 이유 / Tech Stack and Rationale

## 6. 팀 구성 / Team
| 이름 Name | 담당 영역 Area | 주요 이슈 Issues |
|---|---|---|
|  |  |  |

## 7. 라이선스 / License
MIT — 선택 이유 / Why:
