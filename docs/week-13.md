# 13주차 활동지 / Week 13 Worksheet

**배포와 문서화 / Deployment and documentation**

- 작성일 / Date: 2026-11-26
- 참여자 / Present: 이학준
- 결과보고서 / Report chapter: 7장 검증과 실행 환경
- 최종 반영 / Feeds into: 제출물 ② ③ / Submissions ② ③

---

## 실행 방식 / How it runs

로컬 실행 / 배포 중 무엇인가, 그 이유는?
*Local run or deployed? Why?*

배포한다. 초대 링크나 QR을 받은 사람은 설치와 가입 없이 웹에서 이름만 적고 들어와야 하고(명세 4-5), 발표장에서 청중이 QR로 바로 참여해야 해서 노트북 로컬 실행만으로는 시연할 수 없다.

- 웹: main에 합치면 GitHub Actions가 EAS Hosting에 올린다
- 설치한 앱: 같은 단계에서 `eas update`로 보낸다(expo-updates). 아이폰은 TestFlight, 안드로이드는 설치 파일
- 서버: Supabase(Postgres, Realtime, 익명 로그인) 무료 요금제. 멈추지 않게 GitHub Actions가 매일 한 번 요청한다
- 로컬 실행도 된다. README 3절대로 `npm install`, `.env` 채우기, `npx expo start --web`. 개발할 때와 아래 "README만으로 실행" 확인에 쓴다

## 공개 URL (선택·가점) / Public URL (optional, bonus)

- https://babti.expo.app
- PR마다 웹 미리보기 주소가 PR 댓글로 달린다(명세 8절). 리뷰어는 그 주소에서 눌러 보고 승인한다

## 비밀 정보 처리 / Secret handling

- [x] 환경변수 분리 Env vars (`.env`, 이름만 `.env.example`. AI 키는 Supabase Secrets에만)
- [x] .gitignore (`.env`, `*.p8`, `*.jks`, `*.pem`, `*.key`)
- [x] 커밋 이력에 키 없음 No key in history (2026-11-25, 모든 브랜치 405개 커밋과 배포된 웹 번들을 패턴으로 찾음. 웹 번들에는 공개용 `anon` 키만. [`docs/security.md`](security.md) 2절 5번)

## 타 팀원 PC에서 README만으로 실행 / Ran elsewhere using README only

- [x] 성공 Success (설치부터 웹 실행까지). 보완 Fixes: 아래 4개, 2026-11-28 README 3절에 반영

2026-11-26, 이학준 노트북(Windows 10, Node 없는 처음 상태)에서 README 3절만 보고 해 봤다. 저장소는 main `cf86e68`을 새로 받았다. 설치와 실행은 됐고, `.env`에 넣을 키를 받는 곳에서 멈췄다. 키를 받은 사람만 이어서 할 수 있어서 "성공"은 체크하지 않는다.

| 단계 | 결과 |
|---|---|
| Node | README에는 "`.nvmrc`를 따른다(`nvm use`)"만 있다. `nvm`이 없어서 `winget install OpenJS.NodeJS.24`로 깔았다(v24.22.3) |
| `npm install` | 됐다. 경고만 있었다 |
| `cp .env.example .env` | PowerShell에서 됐다 |
| `npx expo start --web` | 됐다. 처음 묶는 데 약 50초, http://localhost:8081 에서 소개 화면(`/about`)이 떴다 |
| 키 채우기 | 멈췄다. Supabase 주소와 공개 키를 어디서 받는지 README에 없다. 대시보드 권한이 없는 팀원은 팀에게 받아야 한다 |
| 키가 빈 채로 "바로 시작하기" | README는 "연결할 수 없어요" 화면이 뜬다고 하지만, 빨간 오류 화면(`MissingEnvError: EXPO_PUBLIC_SUPABASE_URL이(가) 비어 있다`)이 떴다 |

보완할 것
1. Node 설치법: Node가 없는 PC에서 무엇을 깔지 한 줄(예: nodejs.org에서 24 LTS, 또는 `nvm install`)
2. 키 받는 곳: "Supabase 주소와 공개(anon) 키는 팀원(Aninnom, eoieiie)에게 개인 메시지로 받는다"처럼 누구에게 받는지
3. `EXPO_PUBLIC_WEB_BASE`: README 본문에 없다. `https://babti.expo.app`을 넣는다고 적는다
4. 키가 빈 경우: README 문장과 실제 동작이 다르다. 화면을 "연결할 수 없어요"로 바꾸거나 README 문장을 실제에 맞춘다

## README 완성도 / README completeness

2026-11-26 main(aa4a4ee)의 `README.md` 기준.

- [x] 문제정의 Problem — 1절. 상황, 페인포인트(설문 78명 숫자), 성공 기준
- [x] 사용자 Users — 1절 사용자, 2절 인터뷰 3명 요지와 고친 것
- [x] 실행방법 How to run — 3절. Node 버전(`.nvmrc` 24), `npm install`, `.env`, `npx expo start --web`, 검사와 DB 테스트
- [x] 아키텍처 Architecture — 4절. 그림과 mermaid, 세 계층, 규칙을 서버에 둔 이유
- [x] 팀원 Team — 6절. 다만 담당 칸이 11/12 무렵에 머물러 있다(예: Ruty041의 투표 화면 추천 칸 PR #81, Aninnom의 식당 서버 PR #78과 데이터셋 문서가 없다). 제출 전에 각자 한 줄씩 고친다

---

> 수업 종료 시 커밋하세요 / Commit this at the end of class
> `git add docs/week-13.md && git commit -m "docs: 13주차 활동지 작성"`
