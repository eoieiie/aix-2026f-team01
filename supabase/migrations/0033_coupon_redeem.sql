-- 0033 쿠폰 받는 길 둘, 쿠폰함, 직원 확인 (명세 4-27, 2026-11-25)
-- 병주: "한눈에 누가 쿠폰 쓰고 했는지 알려줘". 0015는 "쿠폰 받기"까지만 남겼다. 가게에서 실제로 쓴 것까지 남긴다.
-- (1) 받는 길 둘: 판 결과에서 받기(source 'session', 지금 방식 그대로), 가게 화면에서 받기(source 'shop', 한 사람이 한 가게에서 하루 1장).
-- (2) 쿠폰함: my_coupons. 받은 지 24시간 안에만 쓸 수 있다.
-- (3) 직원 확인: redeem_coupon. 가게에 비밀번호 4자리가 있으면 맞아야 한다. 쓴 시각이 남고 다시 못 쓴다.
--     판에서 받은 쿠폰은 한 팀에 하나라서, 한 사람이 확인하면 같은 판에서 받은 그 가게 쿠폰이 모두 쓴 것이 된다.
-- (4) 가게 비밀번호와 사장님 주소 토큰은 shop_private에 따로 둔다. 식당 표는 로그인한 사람 누구나 읽어서 거기에 두면 안 된다.
-- 여러 번 돌려도 같은 결과가 되게 썼다.

alter table public.coupon_claims alter column session_id drop not null;
alter table public.coupon_claims add column if not exists source text not null default 'session';
alter table public.coupon_claims drop constraint if exists coupon_claims_source_check;
alter table public.coupon_claims add constraint coupon_claims_source_check
  check ((source = 'session' and session_id is not null) or (source = 'shop' and session_id is null));
-- 받은 날(한국 날짜). 가게 화면에서 받는 쿠폰의 "하루 1장"에 쓴다
alter table public.coupon_claims add column if not exists claim_day date;
-- 받을 때의 혜택 문구. 가게가 나중에 혜택을 바꿔도 받은 쿠폰은 그대로다
alter table public.coupon_claims add column if not exists benefit text;
-- 같이 간 인원. 판에서 받으면 그 판에 들어온 사람 수, 가게 화면에서 받으면 1
alter table public.coupon_claims add column if not exists party_size int not null default 1;
alter table public.coupon_claims drop constraint if exists coupon_claims_party_size_check;
alter table public.coupon_claims add constraint coupon_claims_party_size_check check (party_size between 1 and 50);
-- 가게 비밀번호를 틀린 횟수. 정한 횟수를 넘으면 그 쿠폰은 잠긴다
alter table public.coupon_claims add column if not exists pin_fails int not null default 0;

create unique index if not exists coupon_claims_shop_daily
  on public.coupon_claims (restaurant_id, user_id, claim_day) where source = 'shop';
create index if not exists coupon_claims_restaurant_time on public.coupon_claims (restaurant_id, claimed_at);

-- 가게 비밀번호(직원 확인용 숫자 4자리)와 사장님 현황 주소의 토큰. 정책도 권한도 주지 않아서 서버 함수만 읽는다.
-- 넣고 바꾸는 것은 팀이 scripts/partner-on.sql로 한다
create table if not exists public.shop_private (
  restaurant_id bigint primary key references public.restaurants (id) on delete cascade,
  staff_pin text check (staff_pin is null or staff_pin ~ '^[0-9]{4}$'),
  owner_token text unique check (owner_token is null or char_length(owner_token) >= 32),
  updated_at timestamptz not null default now()
);
alter table public.shop_private enable row level security;
revoke all on public.shop_private from anon, authenticated;

-- 쿠폰 규칙 숫자. 앱 상수(src/constants)와 같은지 jest가 확인한다
--   COUPON_VALID_HOURS: 받은 뒤 쓸 수 있는 시간
--   PIN_MAX_TRIES: 가게 비밀번호를 틀릴 수 있는 횟수
--   SHOP_STATS_MIN: 가게 통계에서 분포(시간대, 메뉴)와 "다녀간 팀"을 보이는 최소 팀 수
create or replace function public.coupon_rule(p_name text) returns int
language sql immutable set search_path = ''
as $$
  select ('{"COUPON_VALID_HOURS": 24, "PIN_MAX_TRIES": 5, "SHOP_STATS_MIN": 5}'::jsonb ->> p_name)::int
$$;

-- 판 결과에서 쿠폰 받기(0015). 같은 이름과 인자라 예전 앱도 그대로 쓴다. 받을 때의 혜택과 인원을 같이 남긴다
create or replace function public.claim_coupon(p_session_id uuid, p_restaurant_id bigint) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions;
  v_shop public.restaurants;
  v_code text;
  v_people int;
begin
  select * into v_session from public.sessions s where s.id = p_session_id;
  if not found or not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  if v_session.status <> 'done' then
    raise exception 'not_done';
  end if;
  select r.* into v_shop
  from public.restaurants r
  join public.groups g on g.id = v_session.group_id and g.area = r.area
  where r.id = p_restaurant_id and r.partner;
  if not found then
    raise exception 'not_partner';
  end if;
  select greatest(1, least(50, count(*)))::int into v_people
  from public.session_participants sp where sp.session_id = p_session_id;
  v_code := public.coupon_code(p_session_id, p_restaurant_id);
  insert into public.coupon_claims (restaurant_id, session_id, user_id, code, source, claim_day, benefit, party_size)
  values (p_restaurant_id, p_session_id, v_uid, v_code, 'session',
    (now() at time zone 'Asia/Seoul')::date, v_shop.coupon_text, v_people)
  on conflict (session_id, restaurant_id, user_id) do nothing;
  return v_code;
end;
$$;

-- 가게 화면에서 쿠폰 받기. 한 사람이 한 가게에서 하루(한국 날짜) 1장. 다시 누르면 오늘 받은 쿠폰을 돌려준다(이미 썼어도 새로 주지 않는다)
create or replace function public.claim_shop_coupon(p_restaurant_id bigint) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_shop public.restaurants;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_id uuid;
begin
  select * into v_shop from public.restaurants r where r.id = p_restaurant_id;
  if not found or not v_shop.partner or v_shop.coupon_text is null then
    raise exception 'not_partner';
  end if;
  insert into public.coupon_claims (restaurant_id, session_id, user_id, code, source, claim_day, benefit, party_size)
  values (p_restaurant_id, null, v_uid,
    upper(substr(md5(v_uid::text || ':' || p_restaurant_id::text || ':' || v_day::text), 1, 6)),
    'shop', v_day, v_shop.coupon_text, 1)
  on conflict (restaurant_id, user_id, claim_day) where source = 'shop' do nothing
  returning id into v_id;
  if v_id is null then
    select c.id into v_id from public.coupon_claims c
    where c.restaurant_id = p_restaurant_id and c.user_id = v_uid and c.source = 'shop' and c.claim_day = v_day;
  end if;
  return v_id;
end;
$$;

-- 쿠폰함: 내가 받은 쿠폰(최근 60일, 100장까지). 쓴 쿠폰과 지난 쿠폰도 온다. 화면이 나눠 보인다
create or replace function public.my_coupons()
returns table (
  id uuid, restaurant_id bigint, shop_name text, benefit text, code text, source text, session_id uuid,
  claimed_at timestamptz, expires_at timestamptz, redeemed_at timestamptz, pin_required boolean, tries_left int
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  return query
  select c.id, c.restaurant_id, r.name, coalesce(c.benefit, r.coupon_text), c.code, c.source, c.session_id,
    c.claimed_at,
    c.claimed_at + make_interval(hours => public.coupon_rule('COUPON_VALID_HOURS')),
    c.redeemed_at,
    exists (select 1 from public.shop_private s where s.restaurant_id = c.restaurant_id and s.staff_pin is not null),
    greatest(0, public.coupon_rule('PIN_MAX_TRIES') - c.pin_fails)
  from public.coupon_claims c
  join public.restaurants r on r.id = c.restaurant_id
  where c.user_id = v_uid and c.claimed_at > now() - interval '60 days'
  order by c.claimed_at desc
  limit 100;
end;
$$;

-- 직원 확인. 돌려주는 값: {"ok": true, "redeemed_at": …} 또는 {"ok": false, "reason": "wrong_pin" | "locked", "tries_left": n}.
-- 비밀번호가 틀리면 예외를 던지지 않고 값을 돌려준다. 예외를 던지면 틀린 횟수가 저장되지 않는다(되돌려진다).
-- 남의 쿠폰(not_yours), 이미 쓴 쿠폰(already_used), 지난 쿠폰(expired)은 예외다
create or replace function public.redeem_coupon(p_claim_id uuid, p_pin text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  c public.coupon_claims;
  v_pin text;
  v_max int := public.coupon_rule('PIN_MAX_TRIES');
  v_now timestamptz := now();
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
    if c.pin_fails >= v_max then
      return jsonb_build_object('ok', false, 'reason', 'locked', 'tries_left', 0);
    end if;
    if p_pin is null or p_pin <> v_pin then
      update public.coupon_claims set pin_fails = pin_fails + 1 where id = c.id;
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

revoke execute on function public.coupon_rule(text), public.claim_shop_coupon(bigint), public.my_coupons(),
  public.redeem_coupon(uuid, text) from public, anon;
grant execute on function public.claim_shop_coupon(bigint), public.my_coupons(), public.redeem_coupon(uuid, text)
  to authenticated;
