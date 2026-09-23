# 4주차 활동지 / Week 4 Worksheet

**주제 선택과 요구 명세 / Choosing a problem & writing the spec**

- 작성일 / Date: 2026/09/23
- 참여자 / Present: 황병주 이재곤 이학준 이혁준 

---

## ① 주제 선택 / Choosing one problem

투표

밥-> 2
킥보드-> 4
엘베-> 0

| 항목 Item       | 내용                                |
| ------------- | --------------------------------- |
| 선택한 주제 Chosen | 킥보드 통합 플랫폼                        |
| 선택 근거 Why     | 회사도 많고 앱도 다 달라서 위치 식별과 기종 선택이 어려움 |

## ② 성공 기준 가져오기 / Success criteria from Week 3

| 3주차 성공 기준 원문 Original (Week 3)    | 모호한 표현 Vague words |
| --------------------------------- | ------------------ |
| *(예시) 학생들이 과제 제출 현황을 쉽게 확인할 수 있다* | *쉽게, 확인할 수 있다*     |
| 한눈에 모든 회사의 기종과 위치를 확인하고 사용 가능     | 한눈에                |

## ③ Acceptance Criteria

최소 정상 경로 2개 + 실패 경로 1개. **판정 방법** 칸이 비면 아직 명세가 아닙니다.
At least two normal paths + one failure path. If "How to check" is empty, it is not yet a spec.

| #    | 경로 Path    | EARS 문장 Sentence                                                    | 판정 방법 How to check                                                    |
| ---- | ---------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| *예시* | *정상*       | *WHEN 학생이 과제 목록을 열면 THE 시스템은 SHALL 과목별 미제출 과제를 마감일 순으로 표시한다*        | *미제출 과제 3건을 만든 뒤 목록을 열어 마감일 순으로 나오는지 확인*                              |
| AC-1 | 정상 Normal  | WHEN 킥보드 이용자가 플랫폼 지도를 보면 THE 플랫폼 시스템은 SHALL 주변 모든 킥보드의 기종과 위치를 표시한다 | 판정방법: 플랫폼을 켜서 최소 다른 브랜드의 킥보드 5종이 모두 지도에 표시되는지 확인                      |
| AC-2 | 정상 Normal  | WHEN  사용자가 플랫폼 사용 시 THE 플랫폼은 SHALL 해당 킥보드 회사의 결제 시스템으로 사용자를 이동시킨다   | 2번 판정방법 각기다른 3종의 킥보드를 정하고 해당 킥보드 선택 시 각 킥보드에 맞는 브랜드의 결제시스템으로 이동되는지 확인 |
| AC-3 | 실패 Failure | IF 사용자가 운전면허 등록을 안 했을 시 THEN THE플랫폼 어플은 SHALL 면허 확인을 필수로 요구한다       | 무면허 사용자가 대여 시도 시 면허 확인을 유도하는지 확인                                      |

> 확인할 동작이 더 있으면 AC-4부터 행을 추가해 쓰십시오.
> If there are more behaviors to check, add rows from AC-4.

- [ ] 이번 활동에서 AI를 사용했다면 `PROMPTS.md`에 기록했습니다 / Logged any AI use in `PROMPTS.md`

---

> 수업 종료 시 커밋하세요 / Commit this at the end of class
> `git add docs/week-04.md && git commit -m "docs: 4주차 활동지 작성"`
