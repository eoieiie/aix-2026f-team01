-- 발표 화면과 같은 시연 자료를 기존 사용자 계정에 넣기 (2026-11-26, 명세 4-32). 팀만 Supabase 대시보드 SQL Editor에서 쓴다.
-- 12/9 시상 뒤 scripts/demo-seed-restore.sql로 한 번에 되돌린다.
-- 하는 일
--   0. 지난번 팀장 한 사람에게 넣은 시연 모임을 지운다(가상 인물 원본 계정은 원본 모임만 남는다)
--   1. 로그인하지 않는 시연용 친구 다섯(민준, 서연, 지호, 하린, 도윤)을 만든다. 모든 시연 모임이 이 한 벌을 같이 쓴다
--   2. 대상 계정을 정해 demo_seed에 'targets'로 남긴다(한 번만. 기준은 아래 targets 절)
--   3. 대상 계정의 예전 모임 구성원 줄을 demo_hidden_memberships로 옮긴다(판, 식사 기록, 직접 적은 메뉴는 그대로).
--      이미 나간 모임의 식사도 숨김 표에 was_member false로 적어 프로필 숫자에서 뺀다
--   4. 대상 계정마다 따로 모임 셋("점심 메이트" 4명, "스터디 저녁" 3명, "AIX 과제" 5명)과 끝난 판, 식사 기록, 진행 중인 판 하나를 넣는다
-- 대상 계정의 이름, 아바타, 단과대, 취향, 못 먹는 것은 건드리지 않는다. 넣은 행은 모두 demo_seed에 남는다. 여러 번 돌려도 같다.

do $seed$
declare
  c_friend uuid[] := array[
    '00000000-0000-4000-8000-990000000301', '00000000-0000-4000-8000-990000000302', '00000000-0000-4000-8000-990000000303',
    '00000000-0000-4000-8000-990000000304', '00000000-0000-4000-8000-990000000305']::uuid[];
  c_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_mj uuid := c_friend[1]; v_sy uuid := c_friend[2]; v_jh uuid := c_friend[3]; v_hr uuid := c_friend[4]; v_dy uuid := c_friend[5];
  t record; g record; s record;
  v_gid uuid; v_sid uuid; v_meal uuid; v_code text; v_name text; v_members uuid[]; v_second uuid; v_food bigint; v_other bigint;
begin
  -- 0. 지난번(팀장 한 사람) 시연 모임
  if exists (select 1 from public.demo_seed d where d.kind = 'seed' and d.table_name = 'groups' and d.note = '팀장용 점심 메이트') then
    delete from public.groups x using public.demo_seed d
    where d.kind = 'seed' and d.table_name = 'groups' and d.row_id = x.id::text;
    delete from public.demo_seed d where d.kind = 'seed';
  end if;

  -- 1. 시연용 친구(로그인하지 않는 계정). 민준, 서연, 지호는 원본 가상 인물의 성향 답과 아바타를 그대로 쓴다
  insert into auth.users (instance_id, id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', true, '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(c_friend) u
  on conflict (id) do nothing;
  insert into public.profiles (user_id, display_name, quiz_answers, axes, avatar_food_id)
  select f.uid, f.name, coalesce(o.quiz_answers, f.quiz), coalesce(o.axes, f.axes), coalesce(o.avatar_food_id, f.avatar)
  from (values
    (v_mj, '민준', 'babti_demo_mj', null::jsonb, null::jsonb, null::bigint),
    (v_sy, '서연', 'babti_demo_sy', null, null, null),
    (v_jh, '지호', 'babti_demo_jh', null, null, null),
    (v_hr, '하린', null, '["B","A","B","A","A","B","A","A"]', '{"lead":0,"spicy":0,"korean":-1,"explore":1}', 16),
    (v_dy, '도윤', null, '["A","B","B","A","B","A","A","B"]', '{"lead":1,"spicy":1,"korean":0,"explore":0}', 9)
  ) f (uid, name, src, quiz, axes, avatar)
  left join public.profiles o on o.handle = f.src
  on conflict (user_id) do nothing;
  insert into public.restrictions (user_id, tag)
  select v_sy, 'seafood' where not exists (select 1 from public.restrictions r where r.user_id = v_sy and r.tag = 'seafood');
  insert into public.demo_seed (table_name, row_id, kind, note)
  select 'profiles', u::text, 'seed', '시연용 친구' from unnest(c_friend) u
  on conflict (table_name, row_id) do nothing;

  -- 2. 대상: 실제 사람 폰으로 보이는 계정. 처음 한 번만 정하고 그 뒤에는 그대로 쓴다
  if not exists (select 1 from public.demo_seed d where d.table_name = 'targets') then
    insert into public.demo_seed (table_name, row_id, kind)
    with used as (
      select user_id from public.memberships union select user_id from public.meal_participants
      union select user_id from public.votes union select user_id from public.session_participants
    ),
    base as (
      select u.user_id, p.handle, au.is_anonymous,
        greatest(au.last_sign_in_at, (select max(x.updated_at) from auth.sessions x where x.user_id = u.user_id)) as last_seen
      from used u join auth.users au on au.id = u.user_id left join public.profiles p on p.user_id = u.user_id
      where coalesce(p.handle, '') not like 'babti\_demo%' and coalesce(p.handle, '') not ilike '%review%'
        and coalesce(p.display_name, '') not like 'zz\_%' and coalesce(p.handle, '') not like 'zz\_%'
        and u.user_id::text not like '00000000-0000-4000-8000-99%'
        and not exists (select 1 from public.demo_seed d where d.table_name = 'profiles' and d.row_id = u.user_id::text)
        and (coalesce(p.display_name, '') not in ('병주', '황병주') or p.handle = 'eoieiie')   -- 팀장 시험 계정은 본인 계정 하나만
    )
    select 'targets', b.user_id::text, 'mark' from base b
    where b.handle = 'eoieiie' or not b.is_anonymous or (
      exists (select 1 from public.memberships m join public.groups x on x.id = m.group_id      -- 시험 이름 모임에만 있는 계정 제외
              where m.user_id = b.user_id and x.name !~* '점검|확인|시험|테스트|test|리뷰|now|new|live')
      and (select count(*) from public.meal_participants mp where mp.user_id = b.user_id) >= 1   -- 식사 1끼 이상
      and exists (select 1 from public.memberships m where m.user_id = b.user_id                 -- 다른 사람과 같은 모임
                  and (select count(*) from public.memberships m2 where m2.group_id = m.group_id) >= 2)
      and b.last_seen >= timestamptz '2026-11-09 00:00+09');                                     -- 11/9 이후 접속
  end if;

  for t in
    select d.row_id::uuid as uid, coalesce(nullif(p.display_name, ''), '나') as name
    from public.demo_seed d left join public.profiles p on p.user_id = d.row_id::uuid
    where d.table_name = 'targets'
    order by d.id
  loop
    -- 3. 예전 모임 숨기기
    insert into public.demo_hidden_memberships (group_id, user_id, display_name, joined_at)
    select m.group_id, m.user_id, m.display_name, m.joined_at from public.memberships m
    where m.user_id = t.uid and not public.is_demo_group(m.group_id)
    on conflict do nothing;
    delete from public.memberships m
    where m.user_id = t.uid and not public.is_demo_group(m.group_id);
    -- 이미 나간 모임의 식사도 프로필 숫자에 섞이지 않게 숨김 표에 적는다(구성원 줄은 만들지 않는다)
    insert into public.demo_hidden_memberships (group_id, user_id, display_name, was_member)
    select distinct ml.group_id, t.uid, t.name, false
    from public.meal_participants mp join public.meals ml on ml.id = mp.meal_id
    where mp.user_id = t.uid and not public.is_demo_group(ml.group_id)
    on conflict do nothing;

    -- 4. 모임 셋
    for g in
      select * from (values
        ('점심 메이트', 3, array[v_mj, v_sy, v_jh]),
        ('스터디 저녁', 2, array[v_mj, v_sy]),
        ('AIX 과제', 1, array[v_mj, v_jh, v_hr, v_dy])
      ) x (gname, ord, friends)
    loop
      if exists (select 1 from public.demo_seed d where d.table_name = 'groups' and d.note = 'v2 ' || t.uid || ' ' || g.gname) then
        continue;
      end if;
      loop
        select string_agg(substr(c_alphabet, 1 + floor(random() * 32)::int, 1), '') into v_code
        from generate_series(1, public.app_limit('INVITE_CODE_LENGTH'));
        begin
          insert into public.groups (name, invite_code, created_by, area, created_at)
          values (g.gname, v_code, t.uid, 'erica', timestamptz '2026-11-05 10:00+09' + make_interval(mins => g.ord))
          returning id into v_gid;
          exit;
        exception when unique_violation then
        end;
      end loop;
      insert into public.demo_seed (table_name, row_id, note) values ('groups', v_gid::text, 'v2 ' || t.uid || ' ' || g.gname);

      v_name := case when exists (select 1 from public.profiles p where p.user_id = any (g.friends) and p.display_name = t.name)
                     then t.name || ' (나)' else t.name end;
      insert into public.memberships (group_id, user_id, display_name, joined_at)
      values (v_gid, t.uid, v_name, timestamptz '2026-11-05 10:00+09' + make_interval(mins => g.ord));
      insert into public.memberships (group_id, user_id, display_name, joined_at)
      select v_gid, p.user_id, p.display_name, timestamptz '2026-11-05 10:05+09' + make_interval(mins => g.ord)
      from public.profiles p where p.user_id = any (g.friends);
      insert into public.demo_seed (table_name, row_id)
      select 'memberships', v_gid || '/' || m.user_id from public.memberships m where m.group_id = v_gid;
      v_members := array_prepend(t.uid, g.friends);
      v_second := g.friends[2];

      -- 끝난 판과 식사 기록. 최근 3주에 고르게, 모임마다 다른 음식
      for s in
        select x.at, f.id as food_id, o.id as other_id
        from (values
          ('점심 메이트', '2026-11-06 12:10+09', '비빔밥', '김치찌개'), ('점심 메이트', '2026-11-09 12:10+09', '김치찌개', '돈까스'),
          ('점심 메이트', '2026-11-12 12:10+09', '돈까스', '비빔밥'), ('점심 메이트', '2026-11-16 12:10+09', '비빔밥', '돈까스'),
          ('점심 메이트', '2026-11-19 12:10+09', '돈까스', '김치찌개'), ('점심 메이트', '2026-11-23 12:10+09', '김치찌개', '비빔밥'),
          ('점심 메이트', '2026-11-26 12:10+09', '돈까스', '비빔밥'),
          ('스터디 저녁', '2026-11-07 18:40+09', '제육볶음', '치킨'), ('스터디 저녁', '2026-11-11 18:40+09', '떡볶이', '제육볶음'),
          ('스터디 저녁', '2026-11-14 18:40+09', '치킨', '떡볶이'), ('스터디 저녁', '2026-11-18 18:40+09', '제육볶음', '떡볶이'),
          ('스터디 저녁', '2026-11-24 18:40+09', '떡볶이', '치킨'),
          ('AIX 과제', '2026-11-10 13:00+09', '초밥', '마라탕'), ('AIX 과제', '2026-11-13 13:00+09', '마라탕', '쌀국수'),
          ('AIX 과제', '2026-11-17 13:00+09', '쌀국수', '짜장면'), ('AIX 과제', '2026-11-21 13:00+09', '짜장면', '초밥')
        ) p (gname, at_text, food, other)
        cross join lateral (select p.at_text::timestamptz as at) x
        join lateral (select y.id from public.foods y where y.name = p.food and not y.custom order by y.id limit 1) f on true
        join lateral (select y.id from public.foods y where y.name = p.other and not y.custom order by y.id limit 1) o on true
        where p.gname = g.gname
        order by x.at
      loop
        v_sid := gen_random_uuid();
        insert into public.sessions (id, group_id, host_user_id, status, decided_food_id, decided_at, created_at, expected_count, vote_limit, allow_repeat)
        values (v_sid, v_gid, t.uid, 'done', s.food_id, s.at, s.at - interval '15 minutes', cardinality(v_members), 2, false);
        insert into public.demo_seed (table_name, row_id) values ('sessions', v_sid::text);
        insert into public.session_participants (session_id, user_id, voted, joined_at)
        select v_sid, u, true, s.at - interval '14 minutes' from unnest(v_members) u;
        insert into public.candidates (session_id, food_id, proposed_by, created_at) values
          (v_sid, s.food_id, v_mj, s.at - interval '12 minutes'),
          (v_sid, s.other_id, v_second, s.at - interval '11 minutes');
        insert into public.votes (session_id, user_id, food_id, created_at)
        select v_sid, u, s.food_id, s.at - interval '5 minutes' from unnest(v_members) u
        union all select v_sid, v_second, s.other_id, s.at - interval '5 minutes';
        perform public.refresh_vetoes(v_sid);
        insert into public.meals (group_id, session_id, food_id, eaten_at) values (v_gid, v_sid, s.food_id, s.at)
        returning id into v_meal;
        insert into public.demo_seed (table_name, row_id) values ('meals', v_meal::text);
        insert into public.meal_participants (meal_id, user_id) select v_meal, u from unnest(v_members) u;
      end loop;

      -- 진행 중인 판(점심 메이트, 투표 단계): 발표 7장처럼 비빔밥, 돈까스, 김치찌개(해산물 못 먹는 사람이 있어요), 세 사람은 이미 고름
      if g.gname = '점심 메이트' then
        v_sid := gen_random_uuid();
        insert into public.sessions (id, group_id, host_user_id, status, created_at, expected_count, vote_limit, allow_repeat)
        values (v_sid, v_gid, t.uid, 'voting', now(), 4, 2, false);
        insert into public.demo_seed (table_name, row_id, note) values ('sessions', v_sid::text, 'open');
        insert into public.session_participants (session_id, user_id, voted) values
          (v_sid, v_mj, true), (v_sid, v_sy, true), (v_sid, v_jh, true), (v_sid, t.uid, false);
        insert into public.candidates (session_id, food_id, proposed_by, created_at)
        select v_sid, f.id, p.uid, now() + make_interval(secs => p.n)
        from (values ('비빔밥', v_mj, 1), ('돈까스', v_sy, 2), ('김치찌개', v_jh, 3)) p (food, uid, n)
        join lateral (select y.id from public.foods y where y.name = p.food and not y.custom order by y.id limit 1) f on true;
        insert into public.votes (session_id, user_id, food_id)
        select v_sid, p.uid, f.id
        from (values (v_mj, '비빔밥'), (v_mj, '돈까스'), (v_sy, '돈까스'), (v_sy, '비빔밥'), (v_jh, '돈까스'), (v_jh, '김치찌개')) p (uid, food)
        join lateral (select y.id from public.foods y where y.name = p.food and not y.custom order by y.id limit 1) f on true;
        perform public.refresh_vetoes(v_sid);
      end if;
    end loop;
  end loop;

  -- 판과 식사에 딸린 행도 한 줄씩 남긴다(표 이름과 행 id)
  insert into public.demo_seed (table_name, row_id)
  select 'session_participants', sp.session_id || '/' || sp.user_id from public.session_participants sp
  join public.demo_seed d on d.kind = 'seed' and d.table_name = 'sessions' and d.row_id = sp.session_id::text
  union all
  select 'candidates', c.session_id || '/' || c.food_id from public.candidates c
  join public.demo_seed d on d.kind = 'seed' and d.table_name = 'sessions' and d.row_id = c.session_id::text
  union all
  select 'votes', v.session_id || '/' || v.user_id || '/' || v.food_id from public.votes v
  join public.demo_seed d on d.kind = 'seed' and d.table_name = 'sessions' and d.row_id = v.session_id::text
  union all
  select 'meal_participants', mp.meal_id || '/' || mp.user_id from public.meal_participants mp
  join public.demo_seed d on d.kind = 'seed' and d.table_name = 'meals' and d.row_id = mp.meal_id::text
  on conflict (table_name, row_id) do nothing;
end;
$seed$;

-- 넣은 것 세기
select table_name, kind, count(*) from public.demo_seed group by 1, 2 order by 1, 2;
select count(*) as 숨긴_구성원_줄, count(distinct group_id) as 숨긴_모임, count(distinct user_id) as 숨긴_계정 from public.demo_hidden_memberships;
-- 팀 시연용 공유 모임: 팀장(아이디 eoieiie)의 "AIX 과제". 초대 링크 https://babti.expo.app/g/<코드>
select g.invite_code from public.groups g join public.profiles p on p.user_id = g.created_by
where p.handle = 'eoieiie' and g.name = 'AIX 과제' and public.is_demo_group(g.id);
