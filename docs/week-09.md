# 9주차 활동지 / Week 9 Worksheet

**개발 착수 / Starting development**

- 작성일 / Date: 2026-10-28
- 참여자 / Present: 황병주 이혁준 이학준 이재곤

---

## ① 착수 점검표 / Start checklist

수업 시작 후 10분 안에 확인합니다. 체크되지 않은 항목이 있으면 그것부터 해결하고 개발을 시작합니다.
*Check within the first 10 minutes. Fix any unchecked item before you start coding.*

- [x] 초기 파일이 저장소에 올라와 있다 / Initial files are in the repository — A 뼈대(PR #6), B 데이터베이스와 서버 규칙(PR #8) 머지
- [x] 7주차 이슈가 GitHub에 등록되어 있고 담당자가 지정되어 있다 / Week 7 issues are on GitHub with owners — 1단계 묶음 A~F 모두 이슈(#5 #7 #13 #14 #18 #12), 마일스톤 "MVP 완료"
- [x] 팀원 모두 같은 환경에서 실행된다 / Everyone can run it in the same environment — CI 통과, 웹 배포 https://babti.expo.app. 네 명 각자 실행은 확인 중
- [x] 브랜치 규칙을 정했다 / Branch rule agreed — `종류/이슈번호-영문요약`, `main` 직접 push 막음, 승인 1개 뒤 자동 머지

---

## ② 개발 일정 / Development schedule

5주차 **작업 순서**와 7주차 **이슈·마일스톤**을 바탕으로 이슈를 주차별로 배치합니다.
*Place your issues week by week, based on the Week 5 work order and Week 7 issues and milestones.*

- 11주차에 MVP가 동작해야 합니다. / Fill backwards from the deadlines.
- 선행 이슈가 끝나기 전에 뒤 이슈를 넣지 않습니다. / Never schedule an issue before the ones it depends on.
- 한 사람에게 몰리지 않았는지 확인합니다. / Check that no one is overloaded.

| 주차 Week | 수업 일정 Class        | 끝낼 이슈 # Issues to close                                                                                 | 담당 Owner                                      |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 9주차     | 개발 착수              | #5 A 뼈대·익명 로그인, #7 B DB·서버 규칙, #9 화면 주소·서버 함수 표, #10 공통 부품, #11 PR 미리보기, #23 미리보기 별칭 한도 수정, #24 팀 규칙 정리 | Aninnom (#5 #7), eoieiie (#9 #10 #11 #23 #24) |
| 10주차    | 막힘 진단 · 데모 시나리오 초안 | #13 C 홈·모임, #14 D 초대·못 먹는 것, #18 E 세션·후보·투표                                                             | GONI1130 (#13), Ruty041 (#14), Aninnom (#18)  |
| 11주차    | **MVP 완료 · 중간 데모** | #12 F 룰렛·식사 기록·3대 확인                                                                                    | eoieiie, GONI1130, Ruty041, Aninnom           |
| 12주차    | 핵심 경로 테스트          |                                                                                                         |                                               |
| 13주차    | **배포 · 실행 패키지**    |                                                                                                         |                                               |

- 선행: D와 E는 C가 끝나기 전에 가짜 데이터로 화면부터 만들고, C가 끝나면 연결한다 (명세 10절). 화면끼리 잇는 주소는 #9에서 미리 정한다. 자세한 내용은 명세 ([`docs/spec.md`](spec.md). A~F는 1단계(MVP)를 나눈 기능 묶음이다. 우리 목표와 1단계 완료 기준은 0·1절, 묶음마다 만드는 것과 완료 조건, 담당은 10절에 있다)
- 몰림: Aninnom이 A, B, E 세 묶음이지만 A와 B는 9주차에 끝나서 10주차에는 E 하나다. 12·13주차는 MVP 뒤에 정한다.

> 일정이 맞지 않으면 기능을 줄입니다. 뺀 기능은 5주차 Won't 목록에 옮깁니다.
> *If it doesn't fit, cut scope and move the feature to your Week 5 Won't list.*

---

## ③ 이번 주 목표 이슈 / This week's issues

| # | 제목 Title | 담당 Owner | 완료 Done |
|---|---|---|---|
| #10 | 공통 화면 부품: 버튼, 카드, 입력칸, 음식 색 동그라미 | eoieiie | [ ] |
| #11 | PR마다 웹 미리보기 배포 | eoieiie | [x] |
| #5 | A. 뼈대, 공통 환경, 익명 로그인 | Aninnom | [x] |
| #7 | B. 데이터베이스와 서버 규칙 | Aninnom | [x] |
| #14 | D. 초대 링크 참여, 못 먹는 것: 가짜 데이터로 화면 착수 | Ruty041 | [ ] |
| PR #6, #8 | A, B 리뷰. B에서 결정 기록이 두 번 들어가는 것을 찾아 수정 요청 | Ruty041 | [x] |
| #13 | C. 홈, 모임 만들기, 모임 화면: 가짜 데이터로 화면 착수 | GONI1130 | [ ] |
| PR #1, #2 | 팀 안내·명세 v1, D 작업 계획 리뷰 | GONI1130 | [x] |

---

## ④ 오늘 진행한 것 / Progress today

- A 머지 (PR #6). 앱을 열면 익명 계정이 생기고, PR마다 검사가 돌고, `main`에 합쳐지면 웹으로 배포된다
- B 머지 (PR #8). 표 11개, 권한, 서버 함수 14개와 규칙 테스트. 리뷰에서 결정 기록이 두 번 들어가는 문제를 잡아 고친 뒤 합침
- PR 미리보기 (PR #19 머지). PR마다 댓글에 웹 미리보기 주소가 달려 화면으로 리뷰한다. Expo Free 플랜 별칭 한도에 걸린 문제는 PR #25에서 고치는 중
- 리뷰 중: 공통 부품(PR #20), 화면 주소·서버 함수 표(PR #21), 팀 규칙·협업 방식 정리(PR #27). 연락은 카카오톡으로 바꿈
- 1단계 묶음 C~F 이슈와 마일스톤 2개(MVP 완료, 실행 패키지) 등록
- 저장소 설정: `main` 보호(승인 1개), 자동 머지, 배포용 시크릿·변수 등록
- [x] 이번 활동에서 AI를 사용했다면 `PROMPTS.md`에 기록했습니다 / Logged any AI use in `PROMPTS.md`

---

> 수업 종료 시 커밋하세요 / Commit this at the end of class
> `git add docs/week-09.md && git commit -m "docs: 9주차 활동지 작성"`
