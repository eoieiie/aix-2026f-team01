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
인터뷰 3명 요지 / Summary of three interviews:
1.
2.
3.

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
