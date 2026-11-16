-- 0015 결과 뒤 학교 앞 식당, 제휴 식당 광고와 쿠폰 (명세 4-21, #67 안건, 2026-11-16)
-- 결과가 나온 판에서만 "이 메뉴 파는 학교 앞 식당"을 최대 3곳 돌려준다. 투표와 룰렛은 그대로다.
-- 폰 위치는 쓰지 않는다. 모임마다 동네(area)를 두고 지금은 ERICA 하나(기본값)다.
-- 수익 구조 가설 중 둘을 실제로 만든다: 제휴 식당(partner)은 같은 조건이면 위로 오고 앱이 "광고"를 붙인다.
-- 제휴 식당 쿠폰은 "쿠폰 받기"를 누른 기록(coupon_claims)으로 앱이 데려온 팀 수를 센다. 사장님 확인(redeemed_at)은 다음 단계.
-- 앱 안에서 돈은 받지 않는다. 식당 목록은 오픈스트리트맵(© OpenStreetMap contributors, ODbL)에서 받았다(2026-11-16).
-- 여러 번 돌려도 같은 결과가 되게 썼다(if not exists, or replace, on conflict).

alter table public.groups add column if not exists area text not null default 'erica';

create table if not exists public.restaurants (
  id bigint generated always as identity primary key,
  area text not null default 'erica',
  name text not null,
  -- foods.cuisine과 같은 값. 모르면 null
  cuisine text check (cuisine is null or cuisine in ('korean', 'chinese', 'japanese', 'western', 'asian')),
  -- 대표 메뉴(foods.name). 오픈스트리트맵 종류로 짐작했다. 제휴 식당은 직접 넣는다
  menus text[] not null default '{}',
  lat double precision,
  lng double precision,
  phone text,
  opening_hours text,
  source_id text unique,
  partner boolean not null default false,
  coupon_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_claims (
  id uuid primary key default gen_random_uuid(),
  restaurant_id bigint not null references public.restaurants (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  claimed_at timestamptz not null default now(),
  -- 사장님이 확인한 때. 다음 단계에서 쓴다
  redeemed_at timestamptz,
  unique (session_id, restaurant_id, user_id)
);

alter table public.restaurants enable row level security;
alter table public.coupon_claims enable row level security;
revoke all on public.restaurants, public.coupon_claims from anon, authenticated;
grant select on public.restaurants, public.coupon_claims to authenticated;

drop policy if exists restaurants_select on public.restaurants;
create policy restaurants_select on public.restaurants for select to authenticated using (true);
drop policy if exists coupon_claims_select on public.coupon_claims;
create policy coupon_claims_select on public.coupon_claims for select to authenticated
  using (user_id = (select auth.uid()));

insert into public.restaurants (name, cuisine, menus, lat, lng, phone, opening_hours, source_id) values
  ('페리카나', 'western', array['치킨']::text[], 37.2971681, 126.8483608, null, null, 'node/4629296699'),
  ('피자스쿨', 'western', array['피자']::text[], 37.3010652, 126.8393899, null, 'Mo-Su 10:00-22:00', 'node/5087674523'),
  ('남월', 'asian', array['쌀국수']::text[], 37.3013792, 126.8383726, null, null, 'node/8431229417'),
  ('최고집 칼국수', null, array[]::text[], 37.3029306, 126.839149, null, null, 'node/8431229418'),
  ('통돼지볶음찌개', 'korean', array[]::text[], 37.294174, 126.8426769, '+82 31 408 2292', null, 'node/8440212275'),
  ('우리옥 (목포뻘낙지)', 'korean', array[]::text[], 37.2940912, 126.8445537, '+82 31 437 0021', 'Mo-Su 10:00-22:00', 'node/8440212302'),
  ('용대리황태촌', 'korean', array[]::text[], 37.2940418, 126.8433976, '+82 31 407 2196', 'Mo-Su 10:00-21:00', 'node/8440212306'),
  ('영덕해물탕', 'korean', array[]::text[], 37.3038747, 126.843724, '+82 31 415 7776', 'Mo-Su 10:00-24:00', 'node/8440212310'),
  ('어담추어매운탕', 'korean', array[]::text[], 37.2942399, 126.844028, '+82 31 408 7789', null, 'node/8440212315'),
  ('댕이골낙지마을', 'korean', array[]::text[], 37.2940548, 126.8440551, '+82 31 407 7631', 'Mo-Su 11:00-01:00', 'node/8440221430'),
  ('대부흑염소', 'korean', array[]::text[], 37.2942527, 126.8443106, '+82 31 438 1021', null, 'node/8440221433'),
  ('구곡산장', 'korean', array[]::text[], 37.293845, 126.843726, '+82 31 419 5292', null, 'node/8440221445'),
  ('상록한정식', 'korean', array[]::text[], 37.290787, 126.829853, '+82 31 500 4455', 'Mo-Su 11:30-22:00', 'node/8440228536'),
  ('산골송어', 'korean', array[]::text[], 37.2938218, 126.8443666, '+82 31 419 3735', null, 'node/8440228538'),
  ('별장보쌈칼국수', 'korean', array[]::text[], 37.2938327, 126.8434503, '+82 31 419 5900', 'Mo-Fr 11:30-15:00, 17:00-21:00; Sa 11:30-16:00; Su off', 'node/8440228543'),
  ('무교뻘낙지', 'korean', array[]::text[], 37.2937581, 126.8429996, '+82 31 408 7305', null, 'node/8440228547'),
  ('참치바라기', 'korean', array[]::text[], 37.3029587, 126.8393201, '+82 31 407 5766', null, 'node/9093011773'),
  ('앤의식탁', 'western', array[]::text[], 37.3010889, 126.838603, '+82 31 407 5360', null, 'node/9093011774'),
  ('에비수', 'japanese', array[]::text[], 37.30026, 126.8402915, '+82 31 502 3012', null, 'node/9093016164'),
  ('투파인드피터한양대점', 'western', array[]::text[], 37.3015045, 126.8398252, null, null, 'node/9093016535'),
  ('삼수갑산', 'korean', array[]::text[], 37.2944409, 126.8425988, null, null, 'node/9093016549'),
  ('도스마스', 'western', array[]::text[], 37.2997663, 126.8385095, null, 'Mo-Su 10:00-23:00', 'node/12690791889'),
  ('밀플랜비 한양대에리카점', 'western', array[]::text[], 37.30024, 126.8392894, null, 'Mo-Su 12:00-22:00', 'node/12690793441'),
  ('이모네', 'korean', array[]::text[], 37.2911899, 126.8361814, null, null, 'node/12851077437'),
  ('카바레식당', 'asian', array['인도 커리']::text[], 37.3011005, 126.8374271, null, null, 'node/12851077440'),
  ('행복한짬뽕', 'chinese', array[]::text[], 37.2984916, 126.8386436, null, 'Mo-Fr 10:30-20:00; Sa,Su,PH off', 'node/12851077441')
on conflict (source_id) do update set
  name = excluded.name, cuisine = excluded.cuisine, menus = excluded.menus, lat = excluded.lat, lng = excluded.lng,
  phone = excluded.phone, opening_hours = excluded.opening_hours;

-- 판마다 같은 식당에는 같은 짧은 코드. 모임이 같이 보여 준다
create or replace function public.coupon_code(p_session_id uuid, p_restaurant_id bigint) returns text
language sql immutable set search_path = ''
as $$
  select upper(substr(md5(p_session_id::text || ':' || p_restaurant_id::text), 1, 6))
$$;

-- 결과가 나온 판의 음식을 파는 학교 앞 식당 최대 3곳.
-- 순서: 메뉴가 맞는 곳(가게 이름에 음식 이름이 있거나 대표 메뉴) → 같은 종류 → 같은 조건이면 제휴 → 판마다 섞기
create or replace function public.session_restaurants(p_session_id uuid)
returns table (id bigint, name text, cuisine text, partner boolean, coupon_text text, match text, my_code text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions;
  v_food public.foods;
  v_area text;
begin
  select * into v_session from public.sessions s where s.id = p_session_id;
  if not found or not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  if v_session.status <> 'done' or v_session.decided_food_id is null then
    raise exception 'not_done';
  end if;
  select * into v_food from public.foods f where f.id = v_session.decided_food_id;
  select g.area into v_area from public.groups g where g.id = v_session.group_id;

  return query
  select r.id, r.name, r.cuisine, r.partner,
    case when r.partner then r.coupon_text end,
    case when strpos(r.name, v_food.name) > 0 or v_food.name = any (r.menus) then 'menu' else 'cuisine' end,
    (select c.code from public.coupon_claims c
     where c.session_id = p_session_id and c.restaurant_id = r.id and c.user_id = v_uid)
  from public.restaurants r
  where r.area = v_area
    and (strpos(r.name, v_food.name) > 0 or v_food.name = any (r.menus)
         or (v_food.cuisine is not null and r.cuisine = v_food.cuisine))
  order by
    (strpos(r.name, v_food.name) > 0 or v_food.name = any (r.menus)) desc,
    r.partner desc,
    md5(p_session_id::text || r.id::text)
  limit 3;
end;
$$;

-- 제휴 식당 쿠폰 받기. 한 사람이 한 판에서 한 식당 쿠폰을 한 번 받는다. 다시 누르면 같은 코드
create or replace function public.claim_coupon(p_session_id uuid, p_restaurant_id bigint) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions;
  v_code text;
begin
  select * into v_session from public.sessions s where s.id = p_session_id;
  if not found or not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  if v_session.status <> 'done' then
    raise exception 'not_done';
  end if;
  if not exists (
    select 1 from public.restaurants r
    join public.groups g on g.id = v_session.group_id and g.area = r.area
    where r.id = p_restaurant_id and r.partner
  ) then
    raise exception 'not_partner';
  end if;
  v_code := public.coupon_code(p_session_id, p_restaurant_id);
  insert into public.coupon_claims (restaurant_id, session_id, user_id, code)
  values (p_restaurant_id, p_session_id, v_uid, v_code)
  on conflict (session_id, restaurant_id, user_id) do nothing;
  return v_code;
end;
$$;

revoke execute on function public.coupon_code(uuid, bigint), public.session_restaurants(uuid),
  public.claim_coupon(uuid, bigint) from public, anon;
grant execute on function public.session_restaurants(uuid), public.claim_coupon(uuid, bigint) to authenticated;
