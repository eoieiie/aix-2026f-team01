-- 0022 제휴 카페 9곳의 위치를 공공데이터로 바꾸기 (2026-11-20)
-- 0021은 이 9곳의 좌표를 카카오맵 검색 결과에서 옮겨 적었다. 지도 서비스 약관상 애매해서(명세 1절, 우리팀 점검 11/20)
-- 공공데이터 LOCALDATA 파일(행정안전부 식품_휴게음식점, 식품_제과점영업, 경기 안산시, 2026-11-20 받음, 이용허락범위 제한 없음)의 좌표로 바꾼다.
-- 좌표 변환은 0017/0018과 같다(EPSG:5174 → WGS84). 카카오 좌표와 차이 0~11m.
-- source_id도 'localdata/관리번호'로 바꿔 출처가 남게 한다. 이름(가게가 쓰는 이름)과 제휴 여부는 그대로.

update public.restaurants set lat = 37.3007098, lng = 126.8383815, source_id = 'localdata/5550000-104-2004-00011' where source_id = 'partner/isaac-toast';
update public.restaurants set lat = 37.30136, lng = 126.8393647, source_id = 'localdata/5550000-104-2018-00036' where source_id = 'partner/thunder-coffee';
update public.restaurants set lat = 37.2989507, lng = 126.8390275, source_id = 'localdata/5550000-104-2013-00062' where source_id = 'partner/pinot-noir';
update public.restaurants set lat = 37.2999742, lng = 126.8381509, source_id = 'localdata/5550000-104-2016-00111' where source_id = 'partner/momo-coffee';
update public.restaurants set lat = 37.3018155, lng = 126.838235, source_id = 'localdata/5550000-104-2013-00098' where source_id = 'partner/tete-a-tete';
update public.restaurants set lat = 37.301516, lng = 126.8371935, source_id = 'localdata/5550000-104-2020-00087' where source_id = 'partner/oyatri-coffee';
update public.restaurants set lat = 37.3016879, lng = 126.8391265, source_id = 'localdata/5550000-104-2021-00119' where source_id = 'partner/muk-coffee-bar';
update public.restaurants set lat = 37.3018552, lng = 126.8412194, source_id = 'localdata/5550000-121-2024-00002' where source_id = 'partner/omelt';
update public.restaurants set lat = 37.2995787, lng = 126.8385624, source_id = 'localdata/5550000-104-2013-00057' where source_id = 'partner/cozy-holiday';  -- 공공 자료에 좌표가 비어 있어, 공공 자료의 도로명주소(학사2길 2-1)를 오픈스트리트맵 Nominatim으로 찾은 건물 좌표
