-- 0020 먹고 나서 카페 (명세 4-23, 2026-11-19)
-- 결과 뒤 "이 메뉴 파는 학교 앞" 아래에 카페 최대 3곳. 제휴가 먼저(이름 옆 "광고", 쿠폰은 0015 claim_coupon 그대로), 나머지는 정문에서 가까운 순.
-- 데이터: 0017과 같은 공공데이터 일반음식점 원본(상록구 사동 영업/정상 651곳, 2026-11-16 받음)에서 업태 "기타", "라이브카페" 중
-- 이름에 커피, 카페, 도넛, 디저트, 베이커리, 제과, 빵, tea, 와플, 빙수, 쿠키, 케이크, 로스터가 든 곳과 학생회 제휴 목록에 있는 카페 이름,
-- 정문(37.2998, 126.8369) 1.2km 안 17곳. 좌표 변환은 0017, 0018과 같다(밀플랜비로 오픈스트리트맵과 2m 안 대조).
-- 카페 대부분은 "휴게음식점"이라 이 원본에 없다. 휴게음식점 조회서비스는 활용 신청 뒤 더한다.
-- 이름에 음식 이름(foods)이 든 카페는 넣지 않았다. 그래서 카페는 session_restaurants(이름, 대표 메뉴, 종류로 고름)에 섞이지 않는다.
-- 제휴(partner)는 모두 false. 사장님 동의를 받으면 scripts/partner-on.sql로 켠다.

alter table public.restaurants drop constraint if exists restaurants_cuisine_check;
alter table public.restaurants add constraint restaurants_cuisine_check
  check (cuisine is null or cuisine in ('korean', 'chinese', 'japanese', 'western', 'asian', 'cafe'));

insert into public.restaurants (name, cuisine, menus, lat, lng, phone, opening_hours, source_id) values
  ('레이지그라운드(LAZYGROUND)', 'cafe', array[]::text[], 37.2999742, 126.8381509, '031-509-0401', null, 'localdata/5550000-101-2018-00173'),
  ('데이롱 안산한대점 커피앤하이볼', 'cafe', array[]::text[], 37.299526, 126.8384311, null, null, 'localdata/5550000-101-2025-00194'),
  ('트라이뽀티(TriBoTea)', 'cafe', array[]::text[], 37.2992659, 126.8388095, null, null, 'localdata/5550000-101-2022-00117'),
  ('더스크커피랩(Dusk coffee lab)', 'cafe', array[]::text[], 37.3013611, 126.8375152, null, null, 'localdata/5550000-101-2024-00003'),
  ('신디도넛(CINDYDONUT)', 'cafe', array[]::text[], 37.3016584, 126.8379529, '031-406-5508', null, 'localdata/5550000-101-2022-00103'),
  ('시저', 'cafe', array[]::text[], 37.3011023, 126.8393952, '031-502-7825', null, 'localdata/5550000-101-2005-00466'),
  ('이스턴문(EasternMoon)', 'cafe', array[]::text[], 37.3006852, 126.839842, null, null, 'localdata/5550000-101-2020-00297'),
  ('코이노니아', 'cafe', array[]::text[], 37.302076, 126.8386952, '031-410-7749', null, 'localdata/5550000-101-2021-00168'),
  ('아로하', 'cafe', array[]::text[], 37.3029577, 126.8367734, null, null, 'localdata/5550000-101-2013-00094'),
  ('카페마이로케이션(cafemylocation)', 'cafe', array[]::text[], 37.3000006, 126.8408747, '031-480-4595', null, 'localdata/5550000-101-2012-00169'),
  ('헤세드카페', 'cafe', array[]::text[], 37.3029585, 126.8374292, '031-406-2691', null, 'localdata/5550000-101-2021-00024'),
  ('오쏘커피(OSSO COFFEE)', 'cafe', array[]::text[], 37.301099, 126.8406493, '031-419-2495', null, 'localdata/5550000-101-2011-00238'),
  ('카페미올루(cafe miolo)', 'cafe', array[]::text[], 37.3020364, 126.8416625, null, null, 'localdata/5550000-101-2025-00190'),
  ('디캔바스', 'cafe', array[]::text[], 37.303627, 126.8455349, null, null, 'localdata/5550000-101-2022-00158'),
  ('메가엠지씨커피 상록구청점', 'cafe', array[]::text[], 37.3018826, 126.8473914, '031-406-7770', null, 'localdata/5550000-101-2012-00162'),
  ('카페,돌체(Cafe'' Dolce)', 'cafe', array[]::text[], 37.3057318, 126.8453382, '031-417-3734', null, 'localdata/5550000-101-2018-00201'),
  ('키미케이크(Kimi cake)', 'cafe', array[]::text[], 37.2965806, 126.8480953, null, null, 'localdata/5550000-101-2024-00010')
on conflict (source_id) do update set
  name = excluded.name, cuisine = excluded.cuisine, menus = excluded.menus, lat = excluded.lat, lng = excluded.lng, phone = excluded.phone;

-- 결과가 나온 판의 학교 앞 카페 최대 3곳. 같은 판 사람만. 돌려주는 칸은 session_restaurants와 같은 이름을 쓴다
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
  select r.id, r.name, r.partner,
    case when r.partner then r.coupon_text end,
    (select c.code from public.coupon_claims c
     where c.session_id = p_session_id and c.restaurant_id = r.id and c.user_id = v_uid),
    r.lat, r.lng
  from public.restaurants r
  where r.area = v_area and r.cuisine = 'cafe'
  order by
    r.partner desc,
    -- 정문에서 가까운 순(평면 근사, 1km 안이라 순서만 맞으면 된다). 좌표가 없으면 맨 뒤
    case when r.lat is null or r.lng is null then 1 else 0 end,
    power(coalesce(r.lat, 0) - 37.2998, 2) + power((coalesce(r.lng, 0) - 126.8369) * 0.794, 2),
    r.id
  limit 3;
end;
$$;

revoke execute on function public.session_cafes(uuid) from public, anon;
grant execute on function public.session_cafes(uuid) to authenticated;
