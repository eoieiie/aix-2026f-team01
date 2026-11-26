# 13주차 활동지 / Week 13 Worksheet

**배포와 문서화 / Deployment and documentation**

- 작성일 / Date: 2026-11-26
- 참여자 / Present: 이학준 (README만으로 실행은 확인한 사람을 적는다)
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

- [ ] 성공 Success  → 보완 Fixes:

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
