-- 13주차 보안 점검에서 나온 것을 고친다 (docs/security.md). 여러 번 돌려도 같다
-- 1. 로그인 역할에 남아 있던 표 권한(TRUNCATE, TRIGGER, REFERENCES, MAINTAIN)을 거둔다. 앞으로 만드는 표도 같다
-- 2. 초대 코드 추측: 틀린 코드를 사람마다 1시간에 20번까지만 받는다
-- 3. 신고 반복: 같은 글은 하루에 한 번만 남기고, 한 사람이 하루 20번까지
-- 4. 직원 확인 비밀번호: 쿠폰 한 장마다 5번(0033)에 더해, 한 사람이 한 가게에 하루 5번, 한 가게에 하루 20번 틀리면 그날은 잠근다
-- 5. 앱이 부르지 않는 도우미 함수를 바깥에서 못 부르게 한다
-- 6. 운영 서버에서 차단 표(blocks) 읽기 권한이 빠져 있어 판 화면이 차단한 사람 글을 못 가렸다. 정책(내 차단만)대로 읽기를 연다

-- 1. 표와 함수 권한. 운영 서버는 이미 이렇지만, 새 프로젝트(로컬 포함)가 새 표와 함수를 바로 열어 두는 설정이어도 같게 만든다
--    로그인 안 한 역할(anon): 표는 하나도 못 읽고, 함수는 사장님 현황(owner_board)만
--    로그인한 역할(authenticated): 표는 정책이 허락한 읽기만. 쓰기는 모두 서버 함수로
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('revoke all on public.%I from anon', t.relname);
    execute format('revoke insert, update, delete, truncate, trigger, references, maintain on public.%I from authenticated', t.relname);
  end loop;
  for t in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname <> 'owner_board' loop
    execute format('revoke execute on function %s from anon', t.f);
  end loop;
end $$;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, trigger, references, maintain on tables from authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- 보안 상한 (숫자는 docs/security.md 표와 같다)
create or replace function public.security_rule(p_name text) returns int
language sql immutable set search_path = ''
as $$
  select ('{"INVITE_MISS_MAX": 20, "INVITE_MISS_WINDOW_MIN": 60, "REPORTS_DAILY_MAX": 20, "PIN_USER_SHOP_DAILY": 5, "PIN_SHOP_DAILY": 20}'::jsonb ->> p_name)::int
$$;
revoke execute on function public.security_rule(text) from public, anon, authenticated;

-- 2. 초대 코드를 틀린 기록. 사람 기록이라 계정을 지우면 같이 지워진다. 하루 지난 줄은 지운다
create table if not exists public.invite_misses (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists invite_misses_user_at on public.invite_misses (user_id, at);
alter table public.invite_misses enable row level security;
revoke all on public.invite_misses from anon, authenticated;

create or replace function public.invite_guard(p_uid uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.invite_misses m
      where m.user_id = p_uid
        and m.at > now() - make_interval(mins => public.security_rule('INVITE_MISS_WINDOW_MIN')))
     >= public.security_rule('INVITE_MISS_MAX') then
    raise exception 'too_many_tries';
  end if;
end;
$$;

create or replace function public.invite_miss(p_uid uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.invite_misses where at < now() - interval '1 day';
  insert into public.invite_misses (user_id) values (p_uid);
end;
$$;
revoke execute on function public.invite_guard(uuid), public.invite_miss(uuid) from public, anon, authenticated;

-- 틀린 코드는 오류를 던지지 않고 빈 결과를 돌려준다(오류를 던지면 틀린 기록까지 되돌려진다).
-- 앱은 빈 결과를 "모임을 찾을 수 없어요"로 보여 준다(src/api/invite.ts)
create or replace function public.get_group_by_code(p_code text)
returns table (group_id uuid, name text, is_member boolean)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  perform public.invite_guard(v_uid);
  return query
    select g.id, g.name, exists (
      select 1 from public.memberships m where m.group_id = g.id and m.user_id = v_uid
    )
    from public.groups g
    where g.invite_code = upper(btrim(coalesce(p_code, '')));
  if not found then
    perform public.invite_miss(v_uid);
  end if;
end;
$$;

create or replace function public.join_group(p_code text, p_display_name text default null)
returns table (group_id uuid, open_session_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_group_id uuid;
  v_display_name text;
begin
  perform public.invite_guard(v_uid);
  select g.id into v_group_id from public.groups g where g.invite_code = upper(btrim(coalesce(p_code, '')));
  if v_group_id is null then
    perform public.invite_miss(v_uid);
    return;
  end if;

  if not exists (
    select 1 from public.memberships m where m.group_id = v_group_id and m.user_id = v_uid
  ) then
    v_display_name := public.resolve_display_name(v_uid, p_display_name);
    begin
      insert into public.memberships (group_id, user_id, display_name)
      values (v_group_id, v_uid, v_display_name);
    exception when unique_violation then
      raise exception 'name_taken';
    end;
  end if;

  return query
    select v_group_id, (
      select s.id from public.sessions s
      where s.group_id = v_group_id and s.status <> 'done'
    );
end;
$$;

-- 3. 신고 반복
create index if not exists reports_reporter_at on public.reports (reporter, created_at);
create or replace function public.report_content(p_kind text, p_reason text, p_group_id uuid,
  p_session_id uuid default null, p_food_id bigint default null, p_user_id uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := public.require_uid();
  v_target uuid;
  v_content text;
begin
  if not exists (select 1 from public.memberships where group_id = p_group_id and user_id = v_uid) then
    raise exception 'not_member';
  end if;
  if p_kind in ('pitch', 'custom_food') then
    select c.proposed_by, case when p_kind = 'pitch' then c.pitch else f.name end
    into v_target, v_content
    from public.candidates c
    join public.sessions s on s.id = c.session_id
    join public.foods f on f.id = c.food_id
    where c.session_id = p_session_id and c.food_id = p_food_id and s.group_id = p_group_id;
  elsif p_kind = 'group_name' then
    select created_by, name into v_target, v_content from public.groups where id = p_group_id;
  elsif p_kind = 'member_name' then
    select user_id, display_name into v_target, v_content
    from public.memberships where group_id = p_group_id and user_id = p_user_id;
  else
    raise exception 'bad_report';
  end if;
  if v_content is null then
    raise exception 'report_target_not_found';
  end if;
  -- 0042: 같은 사람이 같은 글을 하루에 여러 번 신고하면 한 번만 남긴다. 하루 상한을 넘으면 거절한다
  if exists (
    select 1 from public.reports r
    where r.reporter = v_uid and r.kind = p_kind and r.group_id is not distinct from p_group_id
      and r.session_id is not distinct from p_session_id and r.food_id is not distinct from p_food_id
      and r.target_user is not distinct from v_target and r.created_at > now() - interval '24 hours'
  ) then
    return;
  end if;
  if (select count(*) from public.reports r
      where r.reporter = v_uid and r.created_at > now() - interval '24 hours') >= public.security_rule('REPORTS_DAILY_MAX') then
    raise exception 'too_many_reports';
  end if;
  insert into public.reports (reporter, target_user, kind, reason, group_id, session_id, food_id, content)
  values (v_uid, v_target, p_kind, p_reason, p_group_id, p_session_id, p_food_id, left(v_content, 200));
end;
$function$;

-- 4. 직원 확인 비밀번호 틀린 기록. 사람 기록이라 계정을 지우면 같이 지워진다
create table if not exists public.pin_misses (
  restaurant_id bigint not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists pin_misses_shop_at on public.pin_misses (restaurant_id, at);
alter table public.pin_misses enable row level security;
revoke all on public.pin_misses from anon, authenticated;

create or replace function public.redeem_coupon(p_claim_id uuid, p_pin text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  c public.coupon_claims;
  v_pin text;
  v_max int := public.coupon_rule('PIN_MAX_TRIES');
  v_now timestamptz := now();
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  select * into c from public.coupon_claims x where x.id = p_claim_id for update;
  if not found or c.user_id <> v_uid then
    raise exception 'not_yours';
  end if;
  if c.redeemed_at is not null then
    raise exception 'already_used';
  end if;
  if c.claimed_at + make_interval(hours => public.coupon_rule('COUPON_VALID_HOURS')) < v_now then
    raise exception 'expired';
  end if;
  select s.staff_pin into v_pin from public.shop_private s where s.restaurant_id = c.restaurant_id;
  if v_pin is not null then
    -- 쿠폰 한 장(0033), 한 사람과 한 가게(오늘), 한 가게(오늘) 가운데 하나라도 다 쓰면 잠근다
    if c.pin_fails >= v_max
       or (select count(*) from public.pin_misses m
           where m.restaurant_id = c.restaurant_id and m.user_id = v_uid and m.at >= v_day_start)
          >= public.security_rule('PIN_USER_SHOP_DAILY')
       or (select count(*) from public.pin_misses m
           where m.restaurant_id = c.restaurant_id and m.at >= v_day_start)
          >= public.security_rule('PIN_SHOP_DAILY') then
      return jsonb_build_object('ok', false, 'reason', 'locked', 'tries_left', 0);
    end if;
    if p_pin is null or p_pin <> v_pin then
      update public.coupon_claims set pin_fails = pin_fails + 1 where id = c.id;
      delete from public.pin_misses where at < now() - interval '2 days';
      insert into public.pin_misses (restaurant_id, user_id) values (c.restaurant_id, v_uid);
      return jsonb_build_object('ok', false,
        'reason', case when c.pin_fails + 1 >= v_max then 'locked' else 'wrong_pin' end,
        'tries_left', greatest(0, v_max - c.pin_fails - 1));
    end if;
  end if;
  if c.session_id is not null then
    update public.coupon_claims set redeemed_at = v_now
    where session_id = c.session_id and restaurant_id = c.restaurant_id and redeemed_at is null;
  else
    update public.coupon_claims set redeemed_at = v_now where id = c.id;
  end if;
  return jsonb_build_object('ok', true, 'redeemed_at', v_now);
end;
$$;

-- 5. 앱이 부르지 않는 도우미 함수 (보안 점검 anon_security_definer와 같은 뜻의 정리)
revoke execute on function public.ai_clean_tags(text[]), public.ai_name_key(text), public.blocked_words(),
  public.has_blocked_word(text), public.reject_blocked_words() from public, anon, authenticated;

-- 6. 차단 표 읽기. 정책 blocks_select_own(0027)이 내 줄만 보이게 한다
grant select on public.blocks to authenticated;

notify pgrst, 'reload schema';
