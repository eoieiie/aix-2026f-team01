# 회고 / Retrospective (KPT)

## Keep

## Problem

진행하다 생긴 문제. 무엇이 일어났고, 왜 그랬고, 어떻게 했는지 적는다. 해결되지 않은 것은 "남음"으로 둔다.

### 2026-10-27 ~ 10-28 (A, B 작업과 PR 정리, Aninnom)

- 앱이 "연결할 수 없어요"에서 멈췄다.
  - 원인: Supabase 프로젝트에서 Anonymous sign-ins가 꺼져 있어 서버가 익명 로그인을 422 "Anonymous sign-ins are disabled"로 거절했다.
  - 해결: 대시보드 Authentication → Sign In / Providers에서 켜고 저장한 뒤 정상 동작했다. 새 프로젝트를 만들면 이것부터 켠다.
- eoieiie가 Expo 조직에서 로봇 토큰(`EXPO_TOKEN`)을 만들지 못했다.
  - 원인: 초대받은 역할이 Owner가 아니었다.
  - 해결: 조직 Members에서 Owner로 바꿨다.
- 저장소 시크릿과 변수를 Aninnom이 넣을 수 없었다.
  - 원인: 개인 계정 저장소라 Actions 시크릿·변수는 저장소 관리자(eoieiie)만 넣을 수 있다. Aninnom은 push 권한뿐이다.
  - 해결: eoieiie가 넣었다. 토큰은 채팅으로 주고받지 않았다.
- `PROMPTS.md`, `docs/decisions.md`가 다른 PR이 머지될 때마다 충돌했다.
  - 원인: `.gitattributes`의 `merge=union`은 로컬 git에만 적용되고 GitHub PR 머지에는 적용되지 않는다. 여러 PR이 같은 파일 끝에 줄을 붙이면 먼저 머지된 PR 때문에 나머지가 충돌한다.
  - 해결: 매번 `git pull --rebase origin main` 후 `git push --force-with-lease` (team/AGENTS.md 8절). PR이 몰리는 날은 같은 일을 여러 번 한다.
- rebase 뒤 `PROMPTS.md`에 같은 기록 줄이 두 번 남았다.
  - 원인: 아직 머지되지 않은 자기 기록 줄을 고친 커밋을 rebase하면, union 병합이 고치기 전 줄과 고친 뒤 줄을 둘 다 남긴다.
  - 해결: 고치기 전 줄을 지우는 커밋을 더했다. rebase 뒤에는 `git diff origin/main -- PROMPTS.md docs/decisions.md`로 기록 줄이 의도한 것만 들어가는지 본다.
- B PR(#8)에 A의 기록 커밋이 다시 들어가 같은 결정 줄이 두 번 추가될 뻔했다.
  - 원인: B 브랜치를 아직 머지되지 않은 A 브랜치 위에서 시작했다. A를 rebase한 뒤 B를 다시 맞추는 과정에서, A에서 그 줄을 뺀 커밋은 "이미 적용됨"으로 빠지고 줄을 넣은 커밋만 남았다.
  - 해결: 리뷰(Ruty041)에서 잡았고 `git rebase --onto origin/main <그 커밋>`으로 뺐다. 앞 PR이 머지되기 전에 다음 브랜치를 그 위에서 시작하지 않는 것이 안전하다.
- B를 작업하면서 PR이 A 커밋까지 함께 담고 있어 자동 머지를 바로 걸 수 없었다.
  - 원인: 위와 같이 A 위에서 시작한 브랜치라, B가 먼저 승인되면 리뷰받지 않은 A도 같이 합쳐진다.
  - 해결: A가 머지된 뒤에 B의 자동 머지를 걸었다.
- 팀 Supabase는 새 표를 자동으로 공개하지 않게 설정했다.
  - 원인: 보안 설정에서 "Automatically expose new tables"를 껐다.
  - 해결: migration에서 필요한 권한을 직접 준다(`0002_rls.sql`에서 모두 거둔 뒤 읽기만 허용, `0003_rpc.sql`에서 앱이 부르는 함수만 실행 허용). 표나 함수를 더하는 PR은 권한도 같이 적는다.
- 로컬 Supabase가 중간에 끊겼다.
  - 원인: Docker Desktop이 꺼져 있었다.
  - 해결: Docker Desktop을 켜고 `npx supabase start`를 다시 했다.
- B에서 완료 조건을 다시 설명하고 확인받기 전에 AI가 표 파일을 먼저 썼다.
  - 원인: 질문 네 개에 답을 받은 것을 시작 승인으로 여겼다. team/AGENTS.md 10절은 완료 조건을 다시 설명하고 확인받은 뒤 코드를 쓰라고 한다.
  - 해결: 멈추고 완료 조건을 설명해 확인받은 뒤 이어갔다.
- PR 미리보기가 6번째 PR부터 실패했다.
  - 원인: PR마다 `pr-<번호>` 별칭을 새로 만드는데, Expo 무료 플랜은 별칭이 5개까지다(#22 미리보기 로그 "This account has reached the limit of 5 aliases from the Free plan").
  - 해결: 별칭을 쓰지 않고 배포마다 나오는 주소를 PR 댓글에 달도록 고쳤다 (이슈 #23, PR #25). 그래서 미리보기 주소가 커밋마다 바뀌고, 미리보기 안의 초대 링크는 main 주소로 간다.

## Try
