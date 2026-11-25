-- 가게 칸 바로잡기 (명세 4-26, 2026-11-25). 여러 번 돌려도 같다
-- 1. 그림: 가게 이름과 대표 메뉴에서 음식을 찾는 낱말 표를 넓힌다. 그래도 못 찾으면 종류의 대표 음식으로 가지 않고 null
--    (한식 103곳이 모두 비빔밥 그림이던 것. 화면은 옅은 면에 종류 이름 한 단어를 그린다)
-- 2. 카페 그림: food-images 버킷 cafe/ 아래 세 장(커피, 빵, 디저트)을 이름 낱말로 고른다
-- 3. "광고"와 제휴 먼저는 혜택 문구가 있는 제휴 가게만. restaurants.partner 값은 그대로 둔다
-- 4. 이름에서 확실히 찾은 음식은 메뉴가 빈 가게의 대표 메뉴로, 종류가 빈 가게 1곳, 공공데이터에서 확실히 맞은 주소 1곳

-- 낱말 → 기본 음식 이름(foods의 기본 40개에 있는 것만). 긴 낱말이 먼저 맞는다
create or replace function public.shop_food_word(p_text text)
returns text
language sql immutable set search_path = ''
as $$
  select w.food from (values
    ('돈가스', '돈까스'),
    ('핏짜', '피자'),
    ('버거', '햄버거'),
    ('부찌', '부대찌개'),
    ('제육', '제육볶음'),
    ('삼겹', '삼겹살'),
    ('짜장', '짜장면'),
    ('스시', '초밥'),
    ('통닭', '치킨'),
    ('순두부', '순두부찌개'),
    ('쌀국수', '쌀국수'),
    ('볶음찌개', '김치찌개'),
    ('국밥', '돼지국밥'),
    ('순대', '돼지국밥'),
    ('수제비', '칼국수'),
    ('냉면', '물냉면'),
    ('막국수', '물냉면'),
    ('반점', '짜장면'),
    ('중화', '짜장면'),
    ('홍콩', '짜장면'),
    ('닭강정', '치킨'),
    ('페리카나', '치킨'),
    ('교촌', '치킨'),
    ('굽네', '치킨'),
    ('bbq', '치킨'),
    ('bhc', '치킨'),
    ('호식이', '치킨'),
    ('처갓집', '치킨'),
    ('네네', '치킨'),
    ('뼈해장', '감자탕'),
    ('부대', '부대찌개'),
    ('마라', '마라탕'),
    ('분식', '떡볶이'),
    ('떡볶', '떡볶이'),
    ('김가네', '김밥'),
    ('카츠', '돈까스'),
    ('경양식', '돈까스'),
    ('멘야', '라멘'),
    ('비엣', '쌀국수'),
    ('베트남', '쌀국수'),
    ('화덕', '피자'),
    ('맘스터치', '햄버거'),
    ('롯데리아', '햄버거'),
    ('고기', '삼겹살'),
    ('정육', '삼겹살'),
    ('돼지', '삼겹살'),
    ('갈비살', '삼겹살'),
    ('김치찜', '김치찌개'),
    ('찌개', '김치찌개'),
    ('청국장', '된장찌개'),
    ('된장', '된장찌개'),
    ('삼계', '삼계탕'),
    ('백숙', '삼계탕'),
    ('닭한마리', '삼계탕'),
    ('곰탕', '설렁탕'),
    ('설렁', '설렁탕'),
    ('솥밥', '비빔밥'),
    ('보리밥', '비빔밥'),
    ('비빔', '비빔밥'),
    ('덮밥', '규동'),
    ('파스타', '토마토 파스타'),
    ('스파게티', '토마토 파스타'),
    ('포케', '샐러드'),
    ('서브웨이', '샌드위치'),
    ('토스트', '샌드위치'),
    ('타이', '팟타이'),
    ('태국', '팟타이'),
    ('커리', '인도 커리'),
    ('카레', '인도 커리'),
    ('인도', '인도 커리'),
    ('네팔', '인도 커리'),
    ('탄두리', '인도 커리'),
    ('샤슬릭', '케밥'),
    ('터키', '케밥')
  ) as w (word, food)
  where strpos(lower(coalesce(p_text, '')), w.word) > 0
  order by char_length(w.word) desc, w.word
  limit 1
$$;

-- 가게 그림으로 쓸 음식. 대표 메뉴 이름 → 대표 메뉴 낱말 → 가게 이름에 든 음식 이름 → 가게 이름 낱말. 못 찾으면 null.
-- 카페는 음식 그림 대신 shop_cafe_image를 쓴다(토스트, 샌드위치 가게만 샌드위치 그림)
create or replace function public.shop_thumb_food(p_name text, p_menus text[], p_cuisine text)
returns bigint
language sql stable set search_path = ''
as $$
  with ok as (
    select f.id, f.name from public.foods f where f.image_path is not null and not f.custom
  )
  select case when p_cuisine = 'cafe' then
    (select ok.id from ok
     where ok.name = '샌드위치' and (strpos(p_name, '토스트') > 0 or strpos(p_name, '샌드위치') > 0)
     order by ok.id limit 1)
  else coalesce(
    (select ok.id from ok join unnest(p_menus) with ordinality as m (name, ord) on m.name = ok.name
     order by m.ord, ok.id limit 1),
    (select ok.id from ok join unnest(p_menus) with ordinality as m (name, ord) on ok.name = public.shop_food_word(m.name)
     order by m.ord, ok.id limit 1),
    (select ok.id from ok where strpos(p_name, ok.name) > 0
     order by char_length(ok.name) desc, ok.id limit 1),
    (select ok.id from ok where ok.name = public.shop_food_word(p_name)
     order by ok.id limit 1)
  ) end
$$;

-- 카페 그림(food-images 버킷 안 경로). 빵집 낱말이면 빵, 디저트 낱말이면 디저트, 나머지는 커피
create or replace function public.shop_cafe_image(p_name text)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when lower(coalesce(p_name, '')) ~ '(베이커리|베이크|빵|제과|도넛|도너츠|파리바게뜨|뚜레쥬르|브레드|bakery|베이글|크로플|와플)' then 'cafe/bread.webp'
    when lower(coalesce(p_name, '')) ~ '(빙수|아이스크림|디저트|케이크|설빙|배스킨|젤라또|마카롱|dessert|cake)' then 'cafe/dessert.webp'
    else 'cafe/coffee.webp'
  end
$$;

-- 화면에 "광고"를 붙이고 먼저 줄 세우는 가게: 제휴이면서 혜택 문구가 있다.
-- 혜택이 없는데 광고 표시가 붙으면 가게와의 관계를 잘못 알린다 (docs/decisions.md 2026-11-25)
create or replace function public.shop_has_offer(p_partner boolean, p_coupon_text text)
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(p_partner, false) and coalesce(btrim(p_coupon_text), '') <> ''
$$;

-- 가게 목록. partner 칸은 "혜택이 있는 제휴"(shop_has_offer)를 내보낸다
create or replace function public.shop_list()
returns table (
  id bigint, name text, cuisine text, partner boolean, coupon_text text,
  walk_minutes int, open_now boolean, photo_path text, thumb_food_id bigint, thumb_image text,
  lat double precision, lng double precision, menus text[]
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_area text;
begin
  select g.area into v_area
  from public.memberships m
  join public.groups g on g.id = m.group_id
  where m.user_id = v_uid
  order by m.joined_at desc
  limit 1;
  v_area := coalesce(v_area, 'erica');

  return query
  select r.id, r.name, r.cuisine, o.offer,
    case when o.offer then r.coupon_text end,
    w.minutes,
    public.is_open_now(r.opening_hours),
    (select p.path from public.shop_photos p where p.restaurant_id = r.id order by p.sort, p.id limit 1),
    t.food_id,
    coalesce(
      (select f.image_path from public.foods f where f.id = t.food_id),
      case when r.cuisine = 'cafe' then public.shop_cafe_image(r.name) end),
    r.lat, r.lng, r.menus
  from public.restaurants r
  cross join lateral (select public.shop_thumb_food(r.name, r.menus, r.cuisine) as food_id) t
  cross join lateral (select public.walk_minutes(r.area, r.lat, r.lng) as minutes) w
  cross join lateral (select public.shop_has_offer(r.partner, r.coupon_text) as offer) o
  where r.area = v_area
  order by o.offer desc, w.minutes nulls last, r.name, r.id;
end;
$$;

-- 가게 상세. 0032와 같고 partner와 그림만 바뀐다
create or replace function public.shop_detail(p_restaurant_id bigint) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.restaurants;
  v_food bigint;
  v_visits int;
  v_offer boolean;
begin
  perform public.require_uid();
  select * into r from public.restaurants x where x.id = p_restaurant_id;
  if not found then
    raise exception 'not_found';
  end if;
  v_food := public.shop_thumb_food(r.name, r.menus, r.cuisine);
  v_offer := public.shop_has_offer(r.partner, r.coupon_text);
  select count(distinct coalesce(c.session_id::text, c.id::text))::int into v_visits
  from public.coupon_claims c
  where c.restaurant_id = r.id and c.redeemed_at is not null;

  return jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'cuisine', r.cuisine,
    'partner', v_offer,
    'coupon_text', case when v_offer then r.coupon_text end,
    'address', r.address,
    'phone', r.phone,
    'opening_hours', r.opening_hours,
    'licensed_year', extract(year from r.licensed_on)::int,
    'menus', to_jsonb(r.menus),
    'walk_minutes', public.walk_minutes(r.area, r.lat, r.lng),
    'open_now', public.is_open_now(r.opening_hours),
    'lat', r.lat,
    'lng', r.lng,
    'photos', coalesce(
      (select jsonb_agg(jsonb_build_object('path', p.path, 'credit', p.credit) order by p.sort, p.id)
       from public.shop_photos p where p.restaurant_id = r.id),
      '[]'::jsonb),
    'thumb_food_id', v_food,
    'thumb_image', coalesce(
      (select f.image_path from public.foods f where f.id = v_food),
      case when r.cuisine = 'cafe' then public.shop_cafe_image(r.name) end),
    'visits', case when v_visits >= 5 then v_visits end
  );
end;
$$;

-- 먹고 나서 카페(0020). 혜택이 있는 제휴만 먼저, "광고"도 그 가게만
create or replace function public.session_cafes(p_session_id uuid)
returns table (id bigint, name text, partner boolean, coupon_text text, my_code text, lat double precision, lng double precision)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions;
  v_area text;
begin
  select * into v_session from public.sessions s where s.id = p_session_id;
  if not found or not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  if v_session.status <> 'done' then
    raise exception 'not_done';
  end if;
  select g.area into v_area from public.groups g where g.id = v_session.group_id;

  return query
  select r.id, r.name, public.shop_has_offer(r.partner, r.coupon_text),
    case when public.shop_has_offer(r.partner, r.coupon_text) then r.coupon_text end,
    (select c.code from public.coupon_claims c
     where c.session_id = p_session_id and c.restaurant_id = r.id and c.user_id = v_uid),
    r.lat, r.lng
  from public.restaurants r
  where r.area = v_area and r.cuisine = 'cafe'
  order by
    public.shop_has_offer(r.partner, r.coupon_text) desc,
    -- 정문에서 가까운 순(평면 근사, 1km 안이라 순서만 맞으면 된다). 좌표가 없으면 맨 뒤
    case when r.lat is null or r.lng is null then 1 else 0 end,
    power(coalesce(r.lat, 0) - 37.2998, 2) + power((coalesce(r.lng, 0) - 126.8369) * 0.794, 2),
    r.id
  limit 3;
end;
$$;

-- 이 메뉴 파는 학교 앞(0015, 0016). 혜택이 있는 제휴만 먼저, "광고"도 그 가게만
create or replace function public.session_restaurants(p_session_id uuid)
returns table (id bigint, name text, cuisine text, partner boolean, coupon_text text, match text, my_code text,
  food_id bigint, walk_minutes integer, open_now boolean, team_count integer, photo_url text)
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
      public.shop_has_offer(r.partner, r.coupon_text) as offer,
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
  select p.id, p.name, p.cuisine, p.offer,
    case when p.offer then p.coupon_text end,
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
    p.offer desc,
    md5(p_session_id::text || p.id::text)
  limit case when v_done then 3 else 6 end;
end;
$$;

revoke execute on function public.shop_food_word(text), public.shop_cafe_image(text), public.shop_has_offer(boolean, text),
  public.shop_thumb_food(text, text[], text), public.shop_list(), public.shop_detail(bigint),
  public.session_cafes(uuid), public.session_restaurants(uuid)
  from public, anon;
grant execute on function public.shop_list(), public.shop_detail(bigint),
  public.session_cafes(uuid), public.session_restaurants(uuid) to authenticated;

-- 가게 이름에 음식 이름이 그대로 있어 확실한 것만 대표 메뉴로 채운다. 메뉴가 이미 있으면 건드리지 않는다
update public.restaurants r set menus = v.menus
from (values
  ('node/8431229418', '최고집 칼국수', array['칼국수']),
  ('node/8440228543', '별장보쌈칼국수', array['칼국수']),
  ('node/12851077441', '행복한짬뽕', array['짬뽕']),
  ('localdata/5550000-101-2014-00010', '언니네화덕핏짜', array['피자']),
  ('localdata/5550000-101-2010-00251', '오늘도부찌안산한대점', array['부대찌개']),
  ('localdata/5550000-101-1999-00411', '통돌이삼겹', array['삼겹살']),
  ('localdata/5550000-101-2024-00025', '하루삼겹', array['삼겹살']),
  ('localdata/5550000-101-2007-00273', '88제육', array['제육볶음'])
) as v (source_id, name, menus)
where r.source_id = v.source_id and r.name = v.name and coalesce(cardinality(r.menus), 0) = 0;

-- 종류가 비어 있던 가게(오픈스트리트맵). 이름이 칼국수집이라 한식
update public.restaurants set cuisine = 'korean'
where source_id = 'node/8431229418' and name = '최고집 칼국수' and cuisine is null;

-- 주소가 없던 오픈스트리트맵 가게 중 공공데이터 일반음식점과 이름이 같고 50m 안인 곳.
-- 남월: 같은 건물(성안길 81, 1층)에 "남월 쌀국수 안산한양대 본점"과 "남월 한양대점" 두 건이 있어 건물 주소만 넣는다
update public.restaurants set address = '경기도 안산시 상록구 성안길 81, 1층 (사동)'
where source_id = 'node/8431229417' and name = '남월' and address is null;
