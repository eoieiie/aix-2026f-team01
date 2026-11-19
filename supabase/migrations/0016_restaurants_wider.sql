-- 0016 식당 서버 넓히기 (명세 4-21, #53 11/16 배정, 2026-11-16)
-- (1) session_restaurants를 끝나지 않은 판(open, voting)에서도 쓴다. 후보 음식 전체가 기준이고 최대 6곳.
--     끝난 판은 0015와 같이 결정된 음식 기준 최대 3곳이다. 투표와 룰렛은 건드리지 않는다.
-- (2) 정문에서 걸어서 몇 분 (3) 지금 영업 중 (4) 밥BTI로 간 모임 N팀 (5) 제휴 식당 사진 칸과 버킷.
-- 네이버, 카카오 지도의 별점과 사진은 가져오지 않는다. 사진은 제휴 식당이 직접 준 것만 우리 버킷에 올린다.
-- 여러 번 돌려도 같은 결과가 되게 썼다(if not exists, drop if exists, or replace, on conflict).

-- (5) 사진 칸. 제휴 식당만, 버킷(restaurant-photos)의 공개 경로로 된 주소만 들어간다. 그 경로가 아닌 주소는 여기서 막힌다(호스트는 보지 않는다)
alter table public.restaurants add column if not exists photo_url text;
alter table public.restaurants drop constraint if exists restaurants_photo_partner;
alter table public.restaurants add constraint restaurants_photo_partner
  check (photo_url is null or partner);
alter table public.restaurants drop constraint if exists restaurants_photo_bucket;
alter table public.restaurants add constraint restaurants_photo_bucket
  check (photo_url is null or photo_url ~ '^https?://[^/]+/storage/v1/object/public/restaurant-photos/[^?#]+$');

-- (5) 사진 버킷. 공개 읽기, 파일 하나 5MB, 그림 파일만.
-- storage.objects에 쓰기 정책을 만들지 않는다. 그래서 앱 사용자(anon, authenticated)는 올리거나 지울 수 없고,
-- 팀이 대시보드(service role)로만 올린다.
-- storage.buckets의 public, allowed_mime_types 칸은 Supabase 버전에 따라 없을 수 있다. 없으면 건너뛰고 알린다
-- (2026-11-16 로컬과 CI 설정(storage-api 없이)에서는 칸이 있어 버킷이 만들어졌다)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    execute $q$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('restaurant-photos', 'restaurant-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
      on conflict (id) do update set
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types
    $q$;
  else
    raise notice 'storage.buckets에 public 칸이 없어 restaurant-photos 버킷을 만들지 않았다';
  end if;
end;
$$;

-- (2) 동네마다 정문 좌표. 지금은 ERICA 하나다(오픈스트리트맵의 정문 차단기, 2026-11-16)
create or replace function public.area_gate(p_area text)
returns table (lat double precision, lng double precision)
language sql immutable set search_path = ''
as $$
  select g.lat, g.lng
  from (values ('erica', 37.2998::double precision, 126.8369::double precision)) as g (area, lat, lng)
  where g.area = p_area
$$;

-- (2) 정문에서 걸어서 몇 분. 직선거리(하버사인) × 1.3(길이 꺾이는 만큼) ÷ 분당 80m, 올림, 최소 1분.
-- 좌표가 없거나 정문을 모르는 동네면 null
create or replace function public.walk_minutes(p_area text, p_lat double precision, p_lng double precision)
returns int
language sql immutable set search_path = ''
as $$
  select greatest(1, ceil(
    2 * 6371000 * asin(sqrt(
      power(sin(radians(p_lat - g.lat) / 2), 2)
      + cos(radians(g.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - g.lng) / 2), 2)
    )) * 1.3 / 80
  ))::int
  from public.area_gate(p_area) g
  where p_lat is not null and p_lng is not null
$$;

-- (3) 지금 영업 중인지. 오픈스트리트맵 opening_hours 표기 중 아래 모양만 읽는다.
--   규칙은 ';'로 나눈다. 규칙 하나 = [요일] 시간들 또는 [요일] off
--   요일: Mo-Fr 같은 묶음, Sa,Su 같은 나열. 요일이 없으면 매일. PH(공휴일)는 알 수 없어 건너뛴다
--   시간: 11:30-15:00, 17:00-21:00 처럼 여러 개. 끝이 시작보다 이르면(11:00-01:00) 다음 날 새벽까지
--   뒤에 온 규칙이 같은 요일의 앞 규칙을 덮는다(오픈스트리트맵 규칙)
-- 영업시간이 없거나 읽지 못하는 모양이면 null. 화면은 null이면 아무것도 보이지 않는다
create or replace function public.is_open_now(p_hours text, p_at timestamptz default now())
returns boolean
language plpgsql stable set search_path = ''
as $$
declare
  c_days constant text[] := array['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  c_rule constant text := '^((Mo|Tu|We|Th|Fr|Sa|Su|PH)(\s*[-,]\s*(Mo|Tu|We|Th|Fr|Sa|Su|PH))*\s+)?'
    || '(off|closed|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$';
  v_local timestamp := p_at at time zone 'Asia/Seoul';
  v_dow int := extract(isodow from v_local)::int;  -- 월 1 ... 일 7
  v_now int := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  v_rules text[];
  v_rule text;
  v_days text;
  v_times text;
  v_part text;
  v_from int;
  v_to int;
  v_covers boolean;
  v_day int;
  v_min int;
  v_today_times text;
  v_range text[];
  v_start int;
  v_end int;
begin
  if p_hours is null or btrim(p_hours) = '' then
    return null;
  end if;
  if btrim(p_hours) = '24/7' then
    return true;
  end if;

  select array_agg(btrim(x)) into v_rules
  from unnest(string_to_array(p_hours, ';')) as x
  where btrim(x) <> '';
  if v_rules is null then
    return null;
  end if;
  foreach v_rule in array v_rules loop
    if v_rule !~ c_rule then
      return null;
    end if;
  end loop;

  -- 오늘(0)과 어제(1)를 본다. 어제 것은 자정을 넘긴 시간대만 걸린다
  for v_back in 0..1 loop
    v_day := ((v_dow - 1 - v_back + 7) % 7) + 1;
    v_min := v_now + v_back * 1440;
    v_today_times := null;

    foreach v_rule in array v_rules loop
      v_times := substring(v_rule from '(off|closed|\d{1,2}:\d{2}.*)$');
      v_days := btrim(left(v_rule, length(v_rule) - length(v_times)));
      if v_days = '' then
        v_covers := true;
      else
        v_covers := false;
        foreach v_part in array string_to_array(replace(v_days, ' ', ''), ',') loop
          if position('PH' in v_part) > 0 then
            continue;
          end if;
          v_from := array_position(c_days, split_part(v_part, '-', 1));
          v_to := coalesce(array_position(c_days, nullif(split_part(v_part, '-', 2), '')), v_from);
          if (v_from <= v_to and v_day between v_from and v_to)
             or (v_from > v_to and (v_day >= v_from or v_day <= v_to)) then
            v_covers := true;
          end if;
        end loop;
      end if;
      if v_covers then
        v_today_times := v_times;
      end if;
    end loop;

    if v_today_times is not null and v_today_times not in ('off', 'closed') then
      foreach v_part in array string_to_array(replace(v_today_times, ' ', ''), ',') loop
        v_range := regexp_match(v_part, '^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$');
        v_start := v_range[1]::int * 60 + v_range[2]::int;
        v_end := v_range[3]::int * 60 + v_range[4]::int;
        if v_end <= v_start then
          v_end := v_end + 1440;
        end if;
        if v_min >= v_start and v_min < v_end then
          return true;
        end if;
      end loop;
    end if;
  end loop;

  return false;
end;
$$;

-- (1)(2)(3)(4)(5) 학교 앞 식당. 돌려주는 칸이 늘어서 지우고 다시 만든다.
-- 끝난 판: 결정된 음식 기준 최대 3곳(0015와 같다). 끝나지 않은 판: 후보 음식 전체 기준 최대 6곳, 후보가 없으면 0행.
-- 못 먹는 사람이 있는 후보(vetoed)도 기준에 넣는다. 0010부터 그런 후보도 찍을 수 있고 룰렛에 들어가서다.
-- 순서: 메뉴가 맞는 곳(가게 이름에 음식 이름이 있거나 대표 메뉴) → 같은 종류 → 같은 조건이면 제휴 → 판마다 섞기
-- food_id: 메뉴가 맞은 음식(여럿이면 먼저 올라온 후보). 종류만 맞으면 null
-- team_count: 그 식당 쿠폰을 받은 서로 다른 판 수. 누가 받았는지는 나가지 않는다
drop function if exists public.session_restaurants(uuid);
create function public.session_restaurants(p_session_id uuid)
returns table (
  id bigint, name text, cuisine text, partner boolean, coupon_text text, match text, my_code text,
  food_id bigint, walk_minutes int, open_now boolean, team_count int, photo_url text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions;
  v_area text;
  v_done boolean;
begin
  select * into v_session from public.sessions s where s.id = p_session_id;
  if not found or not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  v_done := v_session.status = 'done';
  select g.area into v_area from public.groups g where g.id = v_session.group_id;

  return query
  with base as (
    -- 기준 음식: 끝난 판은 결정된 음식 하나, 아니면 후보 전부(먼저 올라온 순)
    select f.id as food_id, f.name as food_name, f.cuisine as food_cuisine, 0::bigint as ord
    from public.foods f
    where v_done and f.id = v_session.decided_food_id
    union all
    select f.id, f.name, f.cuisine, row_number() over (order by c.created_at, c.food_id)
    from public.candidates c
    join public.foods f on f.id = c.food_id
    where not v_done and c.session_id = p_session_id
  ),
  picked as (
    select r.id, r.area, r.name, r.cuisine, r.partner, r.coupon_text, r.lat, r.lng, r.opening_hours, r.photo_url,
      (select b.food_id from base b
       where strpos(r.name, b.food_name) > 0 or b.food_name = any (r.menus)
       order by b.ord limit 1) as menu_food_id
    from public.restaurants r
    where r.area = v_area
      and exists (
        select 1 from base b
        where strpos(r.name, b.food_name) > 0 or b.food_name = any (r.menus)
           or (b.food_cuisine is not null and r.cuisine = b.food_cuisine)
      )
  )
  select p.id, p.name, p.cuisine, p.partner,
    case when p.partner then p.coupon_text end,
    case when p.menu_food_id is not null then 'menu' else 'cuisine' end,
    (select c.code from public.coupon_claims c
     where c.session_id = p_session_id and c.restaurant_id = p.id and c.user_id = v_uid),
    p.menu_food_id,
    public.walk_minutes(p.area, p.lat, p.lng),
    public.is_open_now(p.opening_hours),
    (select count(distinct c.session_id)::int from public.coupon_claims c where c.restaurant_id = p.id),
    case when p.partner then p.photo_url end
  from picked p
  order by
    (p.menu_food_id is not null) desc,
    p.partner desc,
    md5(p_session_id::text || p.id::text)
  limit case when v_done then 3 else 6 end;
end;
$$;

revoke execute on function public.session_restaurants(uuid), public.area_gate(text),
  public.walk_minutes(text, double precision, double precision), public.is_open_now(text, timestamptz)
  from public, anon;
grant execute on function public.session_restaurants(uuid) to authenticated;
