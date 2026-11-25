-- 이름으로 종류가 분명한데 다르게 들어간 가게 바로잡기 (명세 4-26, 2026-11-25). 여러 번 돌려도 같다
-- 기준: 이름에 한식 낱말(감자탕, 국밥, 찌개, 칼국수, 냉면, 순대, 보쌈, 족발, 백반, 한정식)이 있는데 한식이 아닌 곳,
-- 중식 낱말(짬뽕, 짜장, 마라, 탕수육)이 있는데 중식이 아닌 곳, 그 밖에 이름이 음식 종류를 그대로 말하는 곳(라멘, 파스타).
-- 새 종류는 같은 이름 음식의 foods.cuisine과 같다(감자탕 korean, 짬뽕과 마라탕 chinese, 라멘 japanese, 토마토 파스타 western).
-- 원본 키(source_id)와 이름이 둘 다 맞는 줄만 고친다. 빈 DB에는 이 가게들이 없어 아무 일도 하지 않는다.
-- 고치지 않은 것: 김기룽쟝족발덮밥(대만식 족발덮밥이라 중식 그대로), 봉구스밥버거(밥버거는 한식 그대로)

update public.restaurants r set cuisine = v.cuisine, menus = coalesce(v.menus, r.menus)
from (values
  ('localdata/5550000-101-2002-00145', '원조감자탕 일미집 안산한양대점', 'korean', null::text[]),
  ('localdata/5550000-101-2023-00114', '도야짬뽕안산한양대점', 'chinese', null::text[]),
  ('localdata/5550000-101-2021-00079', '홍성마라미방', 'chinese', null::text[]),
  ('localdata/5550000-101-2006-00273', '홍성마라미방', 'chinese', null::text[]),
  -- 양식으로 잘못 들어가며 붙은 대표 메뉴 "치킨"을 뺀다
  ('localdata/5550000-101-2007-00311', '탕화쿵푸마라탕 한양대에리카점', 'chinese', '{마라탕}'::text[]),
  -- 중식으로 잘못 들어가며 붙은 짜장면, 짬뽕, 탕수육을 뺀다
  ('localdata/5550000-101-2007-00271', '파앤피파스타하우스', 'western', '{토마토 파스타}'::text[]),
  ('localdata/5550000-101-2010-00034', '오빈라멘 한양대에리카점', 'japanese', null::text[])
) as v(source_id, name, cuisine, menus)
where r.source_id = v.source_id and r.name = v.name
  and (r.cuisine is distinct from v.cuisine or (v.menus is not null and r.menus is distinct from v.menus));
