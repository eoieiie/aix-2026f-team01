-- 0054 폐업한 가게를 가게 탭과 결과 목록에서 숨긴다 (2026-11-26 병주 확인).
-- 목록 함수는 모임의 동네(area)에 맞는 가게만 읽는다. 폐업한 가게는 area를 'closed'로 바꿔 목록에서 빼고 행은 지우지 않는다.
-- 지우지 않는 이유: 기록이 남고, 다시 열면 area를 'erica'로 되돌리기만 하면 된다.
-- 대상 둘과 근거:
--   카바레식당 (node/12851077440): 공공데이터 안산시 상록구 휴게음식점 관리번호 5550000-104-2017-00137이 영업상태 폐업, 폐업일자 2025-09-01
--   레이지그라운드 (localdata/5550000-101-2018-00173): 공공데이터 일반음식점에는 아직 영업/정상(갱신 2025-12-15)이지만 병주가 직접 폐업을 확인했다
-- 이 가게에 걸린 것: 학생회 제휴는 연결(restaurant_id)만 끊고 공지 행은 남긴다. 쿠폰 받은 기록, 사진, 가게 비밀번호 행은 건드리지 않는다(적용 때 모두 0건).
-- 레이지그라운드는 제휴(partner) 표시가 켜져 있었다. 다시 열 때 필요하면 partner를 true로 되돌린다(쿠폰 문구는 비어 있었다).
-- 여러 번 돌려도 같다.

update public.restaurants
set area = 'closed', partner = false, coupon_text = null
where source_id in ('node/12851077440', 'localdata/5550000-101-2018-00173')
  and (area <> 'closed' or partner or coupon_text is not null);

update public.council_benefits cb
set restaurant_id = null
from public.restaurants r
where cb.restaurant_id = r.id and r.area = 'closed';

notify pgrst, 'reload schema';
