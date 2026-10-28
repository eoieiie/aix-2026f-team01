# 협업 방식 / Workflow

AI가 지키는 작업 규칙이다. 사람이 따라 할 순서와 AI에게 넣을 말은 [`team/README.md`](README.md), 팀 규칙은 [`docs/team-rules.md`](../docs/team-rules.md), AI 공통 규약은 [`team/AGENTS.md`](AGENTS.md).

## 1. 일의 단위

- 모든 작업은 GitHub 이슈 하나에서 시작한다. 이슈에는 만들 것과 완료 조건이 있다.
- 1단계 담당은 이슈에 있다 (`docs/spec.md` 10절 표에 번호).

## 2. 브랜치와 커밋

- 브랜치: `종류/이슈번호-영문요약`. 예: `feat/13-home-screen`, `fix/23-preview-alias-limit`
- 커밋: `종류: 내용`, 내용은 한국어. 한 커밋에 한 가지만 바꾼다.
- 종류는 `feat` 새 기능, `fix` 버그, `docs` 문서, `refactor` 동작은 그대로 구조만, `test` 테스트, `chore` 설정. 이 여섯 개만 쓴다.
- `main`에는 직접 push할 수 없다 (GitHub 보호 규칙). 머지된 브랜치는 지운다.
- 커밋과 PR에 AI 공동저자 줄이나 "Generated with" 줄을 넣지 않는다. 커밋은 그 사람 계정으로 찍힌다.

## 3. PR과 리뷰

- 첫 커밋을 올리면 바로 draft PR을 연다 (`gh pr create --draft`). 일찍 열어야 팀이 중간 화면을 미리보기로 본다.
- 완료 조건을 다 채우면 PR 본문을 `.github/pull_request_template.md` 양식대로 채운다. `Closes #이슈번호`, 동작 원리, 미리보기에서 눌러 볼 순서, 기록이 들어간다.
- 기록(PROMPTS 한 줄, 팀 결정이면 decisions 한 줄)은 PR 본문에만 적고 `PROMPTS.md`, `docs/decisions.md`는 고치지 않는다. 매주 활동지 PR에서 한 번에 옮긴다 (`team/AGENTS.md` 8절).
- 그다음 `gh pr ready`, 리뷰어 지정, `gh pr merge <번호> --auto --merge`. 승인 1개가 붙으면 GitHub가 합친다.
- 리뷰어는 작성자의 다음 순번이다. 황병주 → 이혁준 → 이학준 → 이재곤 → 황병주. 자리에 없으면 그다음.
- 자기 PR은 자기가 승인하지 않는다. 쌓인 리뷰가 있으면 새 작업보다 리뷰를 먼저 한다.
- 리뷰어는 미리보기에서 완료 조건을 눌러 보고 동작 원리를 읽는다. 이해가 안 되면 댓글로 묻고 반려한다.
- PR은 작게 나눈다. 화면 하나나 완료 조건 한두 개씩.

## 4. 화면을 자주 본다

사람은 코드가 아니라 화면으로 확인한다. 그래서 바뀐 화면이 바로 보여야 한다.

| 누가 | 어디서 | 언제 바뀌나 |
| :-- | :-- | :-- |
| 작업하는 사람 | 노트북의 웹 미리보기 (`npx expo start --web`) | AI가 파일을 고치는 즉시 |
| 팀 전체, 리뷰어 | PR 댓글의 미리보기 주소 | push하고 몇 분 뒤. 댓글이 새 주소로 바뀐다. draft일 때도 돈다 |
| 누구나 | https://babti.expo.app | PR이 머지되고 1분쯤 뒤 |

- 작업을 시작하면 AI가 노트북 웹 미리보기를 띄운다. `.env`에 Supabase 주소와 공개 키가 있어야 로그인된다.
- 완료 조건 하나를 끝낼 때마다 커밋하고 push한다. 몰아서 올리면 팀이 중간 화면을 못 본다.
- PR 미리보기가 실패하면 노트북에서 본다. AI에게 "PR #번호를 내 노트북에서 띄워줘"라고 하면 `gh pr checkout <번호>`, `npm install`, `npx expo start --web` 순서로 연다. 다 보면 원래 브랜치로 돌아간다.
- PR 미리보기 안의 초대 링크는 https://babti.expo.app 으로 간다.
- 문서(`.md`, `docs/`)만 바꾼 PR과 머지에서는 CI, 미리보기, 웹 배포가 돌지 않는다. 화면이 그대로라서다.

## 5. 막혔을 때

| 증상 | 할 일 |
| :-- | :-- |
| PR이 충돌로 표시됨 | AI에게 "충돌 풀어". 자기 브랜치에서 `git pull --rebase origin main` 뒤 `git push --force-with-lease`. 기록 파일이 충돌하면 양쪽 줄을 다 살린다 |
| 미리보기 댓글이 안 달림 | Actions 탭의 Preview web 실패 로그를 AI에게 붙여넣는다 |
| 내 노트북이 낡음 | AI에게 "main 최신으로 받아줘" |

## 6. 어디에 무엇이

| 무엇 | 어디 |
| :-- | :-- |
| 무엇을 만드는지 | `docs/spec.md` |
| 할 일과 담당 | GitHub 이슈 |
| 팀 결정 | `docs/decisions.md` (주 1회 활동지 PR에서 줄 추가) |
| AI 판단 기록 | `PROMPTS.md` (주 1회 활동지 PR에서 줄 추가) |
| 팀 단위 윤리 판단 | `ETHICS.md` |
| 주차 활동지 | `docs/week-NN.md` |
| 팀 규칙 | `docs/team-rules.md` |
