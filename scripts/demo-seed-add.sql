-- 발표 화면과 같은 시연 자료를 팀장 계정에 넣기 (2026-11-26, 명세 4-32). 팀만 Supabase 대시보드 SQL Editor에서 쓴다.
-- 발표 캡처의 원본(시연용 가상 인물 민준, 서연, 지호와 모임 "점심 메이트", 예시 가게 990001)은 그대로 두고 표시만 한다.
-- 1단계(앱의 정상 함수): 민준 계정이 create_group으로 같은 이름의 새 모임을 만들고, 서연과 지호가 join_group으로 들어온다.
-- 2단계(이 파일): 팀장을 새 모임에 넣고, 원본 모임의 끝난 판과 식사 기록을 팀장이 함께한 것으로 복사하고, 진행 중인 판 하나를 연다.
-- 넣은 행은 모두 public.demo_seed에 kind 'seed'로 남는다. 지우기: scripts/demo-seed-remove.sql
-- 여러 번 돌려도 같다(이미 복사한 판은 건너뛴다). 맨 위 세 값만 바꾼다.

do $seed$
declare
  v_leader uuid := (select p.user_id from public.profiles p where p.handle = 'eoieiie');   -- 팀장 아이디
  v_new uuid := (select g.id from public.groups g where g.invite_code = 'CGYMWE');        -- 1단계에서 만든 새 모임
  v_mj uuid := (select p.user_id from public.profiles p where p.handle = 'babti_demo_mj');
  v_sy uuid := (select p.user_id from public.profiles p where p.handle = 'babti_demo_sy');
  v_jh uuid := (select p.user_id from public.profiles p where p.handle = 'babti_demo_jh');
  v_src uuid;
  v_leader_name text;
  s record;
  v_sid uuid;
  v_meal uuid;
  v_open uuid;
begin
  if v_leader is null or v_new is null or v_mj is null then
    raise exception 'missing: leader %, group %, persona %', v_leader, v_new, v_mj;
  end if;
  select g.id into v_src from public.groups g
  where g.name = '점심 메이트' and g.created_by = v_mj and g.id <> v_new order by g.created_at limit 1;

  -- 표시만 하는 원본: 가상 인물 세 명, 그들이 만든 원래 모임, 예시 가게
  insert into public.demo_seed (table_name, row_id, kind, note)
  select 'profiles', u::text, 'mark', '시연용 가상 인물' from unnest(array[v_mj, v_sy, v_jh]) u
  on conflict (table_name, row_id) do nothing;
  insert into public.demo_seed (table_name, row_id, kind, note)
  select 'groups', g.id::text, 'mark', '발표 캡처 원본 모임 ' || g.name from public.groups g
  where g.created_by = v_mj and g.id <> v_new
  on conflict (table_name, row_id) do nothing;
  insert into public.demo_seed (table_name, row_id, kind, note)
  select 'restaurants', r.id::text, 'mark', '예시 가게, 시연 모임 구성원에게만 보임' from public.restaurants r where r.id = 990001
  on conflict (table_name, row_id) do nothing;

  -- 새 모임과 구성원
  insert into public.demo_seed (table_name, row_id, kind, note) values ('groups', v_new::text, 'seed', '팀장용 점심 메이트')
  on conflict (table_name, row_id) do nothing;
  select coalesce(p.display_name, '팀장') into v_leader_name from public.profiles p where p.user_id = v_leader;
  insert into public.memberships (group_id, user_id, display_name) values (v_new, v_leader, v_leader_name)
  on conflict do nothing;
  insert into public.demo_seed (table_name, row_id, kind, note)
  select 'memberships', m.group_id || '/' || m.user_id, 'seed', m.display_name from public.memberships m where m.group_id = v_new
  on conflict (table_name, row_id) do nothing;

  -- 원본 모임의 끝난 판과 식사 기록을 같은 날짜로 복사, 팀장도 함께한 것으로
  for s in
    select x.* from public.sessions x
    where x.group_id = v_src and x.status = 'done'
      and not exists (select 1 from public.demo_seed d where d.table_name = 'sessions' and d.note = 'copy ' || x.id)
    order by x.created_at, x.id
  loop
    v_sid := gen_random_uuid();
    insert into public.sessions (id, group_id, host_user_id, status, decided_food_id, decided_at, created_at, expected_count, vote_limit, allow_repeat)
    values (v_sid, v_new, s.host_user_id, 'done', s.decided_food_id, s.decided_at, s.created_at,
      coalesce(s.expected_count, 3) + 1, s.vote_limit, s.allow_repeat);
    insert into public.demo_seed (table_name, row_id, note) values ('sessions', v_sid::text, 'copy ' || s.id);

    insert into public.session_participants (session_id, user_id, voted, joined_at)
    select v_sid, sp.user_id, sp.voted, sp.joined_at from public.session_participants sp where sp.session_id = s.id
    union all select v_sid, v_leader, true, s.created_at + interval '1 minute';
    insert into public.candidates (session_id, food_id, proposed_by, pitch, vetoed, created_at, maybe_tags, ai_checked_at)
    select v_sid, c.food_id, c.proposed_by, c.pitch, c.vetoed, c.created_at, c.maybe_tags, c.ai_checked_at
    from public.candidates c where c.session_id = s.id;
    insert into public.votes (session_id, user_id, food_id, created_at, weight)
    select v_sid, v.user_id, v.food_id, v.created_at, v.weight from public.votes v where v.session_id = s.id
    union all select v_sid, v_leader, s.decided_food_id, coalesce(s.decided_at, s.created_at) - interval '1 minute', 1;

    insert into public.meals (group_id, session_id, food_id, eaten_at)
    select v_new, v_sid, m.food_id, m.eaten_at from public.meals m where m.session_id = s.id
    returning id into v_meal;
    insert into public.demo_seed (table_name, row_id, note) values ('meals', v_meal::text, 'copy of meal in ' || s.id);
    insert into public.meal_participants (meal_id, user_id)
    select v_meal, mp.user_id from public.meal_participants mp join public.meals m on m.id = mp.meal_id where m.session_id = s.id
    union select v_meal, v_leader;
  end loop;

  -- 진행 중인 판 하나(발표 7장: 비빔밥, 돈까스, 김치찌개 후보, 세 사람은 이미 고름). 팀장이 진행자라 투표 열기와 룰렛을 직접 한다
  if not exists (select 1 from public.demo_seed d where d.table_name = 'sessions' and d.note = 'open session') then
    v_open := gen_random_uuid();
    insert into public.sessions (id, group_id, host_user_id, status, created_at, expected_count, vote_limit, allow_repeat)
    values (v_open, v_new, v_leader, 'open', now(), 4, 2, false);
    insert into public.demo_seed (table_name, row_id, note) values ('sessions', v_open::text, 'open session');
    insert into public.session_participants (session_id, user_id, voted) values
      (v_open, v_mj, true), (v_open, v_sy, true), (v_open, v_jh, true), (v_open, v_leader, false);
    insert into public.candidates (session_id, food_id, proposed_by, created_at)
    select v_open, f.id, p.uid, now() + make_interval(secs => p.n)
    from (values ('비빔밥', v_mj, 1), ('돈까스', v_sy, 2), ('김치찌개', v_jh, 3)) p (food, uid, n)
    join lateral (select x.id from public.foods x where x.name = p.food and not x.custom order by x.id limit 1) f on true;
    insert into public.votes (session_id, user_id, food_id)
    select v_open, p.uid, f.id
    from (values (v_mj, '비빔밥'), (v_mj, '돈까스'), (v_sy, '돈까스'), (v_sy, '비빔밥'), (v_jh, '돈까스'), (v_jh, '김치찌개')) p (uid, food)
    join lateral (select x.id from public.foods x where x.name = p.food and not x.custom order by x.id limit 1) f on true;
    perform public.refresh_vetoes(v_open);
  end if;
  -- 판과 식사에 딸린 행도 한 줄씩 남긴다(표 이름과 행 id)
  insert into public.demo_seed (table_name, row_id, note)
  select 'session_participants', sp.session_id || '/' || sp.user_id, null from public.session_participants sp
  join public.demo_seed d on d.kind = 'seed' and d.table_name = 'sessions' and d.row_id = sp.session_id::text
  union all
  select 'candidates', c.session_id || '/' || c.food_id, null from public.candidates c
  join public.demo_seed d on d.kind = 'seed' and d.table_name = 'sessions' and d.row_id = c.session_id::text
  union all
  select 'votes', v.session_id || '/' || v.user_id || '/' || v.food_id, null from public.votes v
  join public.demo_seed d on d.kind = 'seed' and d.table_name = 'sessions' and d.row_id = v.session_id::text
  union all
  select 'meal_participants', mp.meal_id || '/' || mp.user_id, null from public.meal_participants mp
  join public.demo_seed d on d.kind = 'seed' and d.table_name = 'meals' and d.row_id = mp.meal_id::text
  on conflict (table_name, row_id) do nothing;
end;
$seed$;

-- 넣은 것 세기
select table_name, kind, count(*) from public.demo_seed group by 1, 2 order by 1, 2;
