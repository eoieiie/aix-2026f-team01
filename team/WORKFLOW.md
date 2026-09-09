# 협업 방식 / Workflow

> **잠정본이다.** 6주차 활동지(`docs/week-06.md`)에서 브랜치 이름·커밋 메시지·브랜치 보호를
> 정식으로 정한다. 그때까지 이 문서로 굴리고, 6주차에 확정한 뒤 이 문서를 갱신한다.

관련 문서 — 팀 규칙 요약은 [`docs/team-rules.md`](../docs/team-rules.md),
AI에게 주는 공통 컨텍스트는 [`team/AGENTS.md`](AGENTS.md).

---

## 1. 일의 단위

- 모든 작업은 **Issue 1개**에서 시작한다.
- Issue에는 **무엇을 만들지(명세)**와 **끝났다고 인정할 조건(완료 조건)**이 있어야 한다.
- **완료 조건이 없는 PR은 리뷰하지 않는다.**

## 2. 브랜치

```
종류/이슈번호-영문요약
```

예 — `feat/12-memo-search`, `docs/7-week-03`, `fix/21-search-empty-query`

- `main`에 **직접 push하지 않는다.**
- 브랜치는 **일이 끝나면 지운다.** 개인 브랜치를 상시로 두지 않는다 — 오래 살아 있을수록 `main`과 벌어져 나중에 충돌이 커진다.

## 3. 커밋 메시지

```
종류: 내용
```

내용은 한국어로 쓴다. 예 — `docs: 2주차 활동지 작성`

| 종류 | 언제 |
| :-- | :-- |
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서만 변경 |
| `refactor` | 동작은 그대로, 구조만 정리 |
| `test` | 테스트 추가·수정 |
| `chore` | 설정·부수 작업 |

- 여섯 개를 넘기지 않는다. 종류가 많을수록 "이건 뭘로 쓰지"에서 멈춘다.
- **한 커밋 = 한 가지 변경.** 여러 개를 섞으면 나중에 되돌릴 수 없다.
- 이슈와 엮을 때는 제목 끝에 `(#12)`, PR 본문에 `Closes #12`를 쓴다. 머지되면 이슈가 자동으로 닫힌다.

## 4. 리뷰

- **처음 리뷰는 작성자의 다음 순번 사람**이 맡는다. 자리에 없으면 그다음 순번으로 넘어간다.
- 순번 — 1 황병주 → 2 이혁준 → 3 이학준 → 4 이재곤 → 1
- **팀장이라고 기본으로 리뷰하지 않는다.**
- 승인 **1개**를 받으면 머지한다. **자기 PR을 자기가 승인해서 머지하지 않는다.**
- 리뷰하다가 **작동 원리가 이해되지 않는 부분이 있으면 반려**한다. 올린 사람이 설명하지 못하면 승인하지 않는다.
- 검토 중인 PR이 쌓여 있으면, 새 작업을 시작하기 전에 리뷰부터 비운다.

## 5. 작업 순서

작업을 시작할 때:

```bash
git switch main && git pull && git switch -c 종류/이슈번호-요약
```

올릴 때:

```bash
git add <파일> && git commit -m "종류: 내용"
```

```bash
git push -u origin 브랜치이름
```

push하면 저장소 상단에 `Compare & pull request` 버튼이 뜬다. PR을 열고 리뷰를 받는다.

머지된 뒤에는 **반드시**:

```bash
git switch main && git pull
```

## 6. 자주 막히는 곳

| 증상 | 해결 |
| :-- | :-- |
| `git push`에서 비밀번호를 물음 | 계정 비밀번호가 아니라 **Personal Access Token**. GitHub → Settings → Developer settings → Personal access tokens → Tokens(classic) → `repo` 체크 후 발급 |
| 브랜치를 안 만들고 `main`에서 작업함 | `git stash && git switch -c 종류/이슈번호-요약 && git stash pop` |
| `not a git repository` | 저장소 폴더 밖이다. `cd`로 저장소 안으로 들어간다 |
| 내 로컬이 낡음 | `git switch main && git pull` |

## 7. 문서를 어디에 두는가

| 무엇 | 어디 |
| :-- | :-- |
| 주차 활동지 | `docs/week-NN.md` |
| 팀 규칙 요약 | `docs/team-rules.md` |
| 팀원 정보 | `docs/members.md` |
| 협업 방식 · AI 공통 컨텍스트 | `team/` |
| AI 판단 기록 | `PROMPTS.md` (저장소 루트) |
| 팀 단위 윤리 판단 | `ETHICS.md` (저장소 루트) |

외부 문서 도구(Notion 등)를 쓰지 않는다. 도구를 늘리면 우리가 한 일의 증거가 흩어진다.
