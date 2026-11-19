-- 0021 먹고 나서 카페 늘리기와 제휴 카페 켜기 (2026-11-19, 4-23, docs/demo.md 3)
-- 1) 학생회 제휴 목록에서 고른 방문 후보 카페 중 0020에 없던 9곳을 넣는다. 공공데이터 일반음식점에 없는 휴게음식점이라
--    위치는 카카오맵에서 가게를 찾아 좌표를 옮겨 적었다(이름과 위치만, 리뷰·사진·평점은 가져오지 않음). source_id 'partner/영문이름'
-- 2) 오픈스트리트맵 amenity=cafe/ice_cream, shop=bakery 중 이름이 있는 곳(ODbL)
-- 3) 사장님 동의(병주 확인 11/19)에 따라 방문 후보 카페를 제휴로 켠다. 쿠폰 문구는 사장님과 정한 뒤 scripts/partner-on.sql로 넣는다(지금은 비움)
-- 0018 좌표와 카카오 좌표 대조: 신디도넛 1m, 오쏘커피 3m, 코이노니아(코이노커피) 3m

insert into public.restaurants (name, cuisine, menus, lat, lng, source_id) values
  ('이삭토스트 안산한양대점', 'cafe', array[]::text[], 37.3006725, 126.8382711, 'partner/isaac-toast'),
  ('코지홀리데이', 'cafe', array[]::text[], 37.2995483, 126.8385347, 'partner/cozy-holiday'),
  ('썬더커피', 'cafe', array[]::text[], 37.30136, 126.8393524, 'partner/thunder-coffee'),
  ('묵커피바', 'cafe', array[]::text[], 37.3016984, 126.8391201, 'partner/muk-coffee-bar'),
  ('삐노누아', 'cafe', array[]::text[], 37.2989117, 126.8390084, 'partner/pinot-noir'),
  ('모모커피 안산한양대점', 'cafe', array[]::text[], 37.2999558, 126.8381415, 'partner/momo-coffee'),
  ('떼드떼 한양대점', 'cafe', array[]::text[], 37.3018184, 126.8382353, 'partner/tete-a-tete'),
  ('오멜트', 'cafe', array[]::text[], 37.3018548, 126.841189, 'partner/omelt'),
  ('오얏리커피', 'cafe', array[]::text[], 37.3015128, 126.8371942, 'partner/oyatri-coffee'),
  ('파리바게뜨', 'cafe', array[]::text[], 37.3006324, 126.8383357, 'node/5087674522'),
  ('종이꽃 coffee', 'cafe', array[]::text[], 37.3094912, 126.8378887, 'node/7777172285'),
  ('하늘 정원', 'cafe', array[]::text[], 37.3014427, 126.8437062, 'node/7798016186'),
  ('아이스크림 스탠드', 'cafe', array[]::text[], 37.3093163, 126.8344536, 'node/7837139586'),
  ('카페모리아', 'cafe', array[]::text[], 37.3006872, 126.8383015, 'node/8431229017'),
  ('위너', 'cafe', array[]::text[], 37.3018455, 126.8383275, 'node/8431229019'),
  ('카페드림', 'cafe', array[]::text[], 37.2978071, 126.8343458, 'node/8678532528'),
  ('한양베이커리 에리카점', 'cafe', array[]::text[], 37.2956994, 126.8371569, 'node/12851082391')
on conflict (source_id) do update set name = excluded.name, lat = excluded.lat, lng = excluded.lng;

-- 공공데이터 이름을 가게가 쓰는 이름으로
update public.restaurants set name = '신디도넛' where source_id = 'localdata/5550000-101-2022-00103';
update public.restaurants set name = '레이지그라운드' where source_id = 'localdata/5550000-101-2018-00173';
update public.restaurants set name = '트라이뽀티' where source_id = 'localdata/5550000-101-2022-00117';
update public.restaurants set name = '이스턴문' where source_id = 'localdata/5550000-101-2020-00297';
update public.restaurants set name = '오쏘커피' where source_id = 'localdata/5550000-101-2011-00238';
update public.restaurants set name = '코이노커피' where source_id = 'localdata/5550000-101-2021-00168';
update public.restaurants set name = '시저커피' where source_id = 'localdata/5550000-101-2005-00466';
update public.restaurants set name = '카페 디캔바스' where source_id = 'localdata/5550000-101-2022-00158';

update public.restaurants set partner = true
where cuisine = 'cafe' and (source_id like 'partner/%' or source_id in ('localdata/5550000-101-2018-00173', 'localdata/5550000-101-2022-00117', 'localdata/5550000-101-2022-00103', 'localdata/5550000-101-2005-00466', 'localdata/5550000-101-2020-00297', 'localdata/5550000-101-2021-00168', 'localdata/5550000-101-2011-00238', 'localdata/5550000-101-2022-00158', 'localdata/5550000-101-2013-00094'));
