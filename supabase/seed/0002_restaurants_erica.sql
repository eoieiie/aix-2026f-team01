-- 학교 앞(ERICA, 37.2967,126.8355 반경 1.2km) 식당. 오픈스트리트맵에서 2026-11-16에 받았다. © OpenStreetMap contributors (ODbL)
-- 0015 migration에도 같은 줄이 있다. 여러 번 넣어도 같다(on conflict)
-- 최고집 칼국수, 별장보쌈칼국수, 행복한짬뽕의 종류와 대표 메뉴는 0040에서 채운 값과 같게 둔다(2026-11-25)
-- 업태나 태그로 짐작한 메뉴는 menus_guess에 둔다(0051). menus는 가게 이름에 근거가 있는 것만
insert into public.restaurants (name, cuisine, menus, menus_guess, lat, lng, phone, opening_hours, source_id) values
  ('페리카나', 'western', array[]::text[], array['치킨']::text[], 37.2971681, 126.8483608, null, null, 'node/4629296699'),
  ('피자스쿨', 'western', array['피자']::text[], array[]::text[], 37.3010652, 126.8393899, null, 'Mo-Su 10:00-22:00', 'node/5087674523'),
  ('남월', 'asian', array[]::text[], array['쌀국수']::text[], 37.3013792, 126.8383726, null, null, 'node/8431229417'),
  ('최고집 칼국수', 'korean', array['칼국수']::text[], array[]::text[], 37.3029306, 126.839149, null, null, 'node/8431229418'),
  ('통돼지볶음찌개', 'korean', array[]::text[], array[]::text[], 37.294174, 126.8426769, '+82 31 408 2292', null, 'node/8440212275'),
  ('우리옥 (목포뻘낙지)', 'korean', array[]::text[], array[]::text[], 37.2940912, 126.8445537, '+82 31 437 0021', 'Mo-Su 10:00-22:00', 'node/8440212302'),
  ('용대리황태촌', 'korean', array[]::text[], array[]::text[], 37.2940418, 126.8433976, '+82 31 407 2196', 'Mo-Su 10:00-21:00', 'node/8440212306'),
  ('영덕해물탕', 'korean', array[]::text[], array[]::text[], 37.3038747, 126.843724, '+82 31 415 7776', 'Mo-Su 10:00-24:00', 'node/8440212310'),
  ('어담추어매운탕', 'korean', array[]::text[], array[]::text[], 37.2942399, 126.844028, '+82 31 408 7789', null, 'node/8440212315'),
  ('댕이골낙지마을', 'korean', array[]::text[], array[]::text[], 37.2940548, 126.8440551, '+82 31 407 7631', 'Mo-Su 11:00-01:00', 'node/8440221430'),
  ('대부흑염소', 'korean', array[]::text[], array[]::text[], 37.2942527, 126.8443106, '+82 31 438 1021', null, 'node/8440221433'),
  ('구곡산장', 'korean', array[]::text[], array[]::text[], 37.293845, 126.843726, '+82 31 419 5292', null, 'node/8440221445'),
  ('상록한정식', 'korean', array[]::text[], array[]::text[], 37.290787, 126.829853, '+82 31 500 4455', 'Mo-Su 11:30-22:00', 'node/8440228536'),
  ('산골송어', 'korean', array[]::text[], array[]::text[], 37.2938218, 126.8443666, '+82 31 419 3735', null, 'node/8440228538'),
  ('별장보쌈칼국수', 'korean', array['칼국수']::text[], array[]::text[], 37.2938327, 126.8434503, '+82 31 419 5900', 'Mo-Fr 11:30-15:00, 17:00-21:00; Sa 11:30-16:00; Su off', 'node/8440228543'),
  ('무교뻘낙지', 'korean', array[]::text[], array[]::text[], 37.2937581, 126.8429996, '+82 31 408 7305', null, 'node/8440228547'),
  ('참치바라기', 'korean', array[]::text[], array[]::text[], 37.3029587, 126.8393201, '+82 31 407 5766', null, 'node/9093011773'),
  ('앤의식탁', 'western', array[]::text[], array[]::text[], 37.3010889, 126.838603, '+82 31 407 5360', null, 'node/9093011774'),
  ('에비수', 'japanese', array[]::text[], array[]::text[], 37.30026, 126.8402915, '+82 31 502 3012', null, 'node/9093016164'),
  ('투파인드피터한양대점', 'western', array[]::text[], array[]::text[], 37.3015045, 126.8398252, null, null, 'node/9093016535'),
  ('삼수갑산', 'korean', array[]::text[], array[]::text[], 37.2944409, 126.8425988, null, null, 'node/9093016549'),
  ('도스마스', 'western', array[]::text[], array[]::text[], 37.2997663, 126.8385095, null, 'Mo-Su 10:00-23:00', 'node/12690791889'),
  ('밀플랜비 한양대에리카점', 'western', array[]::text[], array[]::text[], 37.30024, 126.8392894, null, 'Mo-Su 12:00-22:00', 'node/12690793441'),
  ('이모네', 'korean', array[]::text[], array[]::text[], 37.2911899, 126.8361814, null, null, 'node/12851077437'),
  ('카바레식당', 'asian', array[]::text[], array['인도 커리']::text[], 37.3011005, 126.8374271, null, null, 'node/12851077440'),
  ('행복한짬뽕', 'chinese', array['짬뽕']::text[], array[]::text[], 37.2984916, 126.8386436, null, 'Mo-Fr 10:30-20:00; Sa,Su,PH off', 'node/12851077441')
on conflict (source_id) do update set
  name = excluded.name, cuisine = excluded.cuisine, menus = excluded.menus, menus_guess = excluded.menus_guess, lat = excluded.lat, lng = excluded.lng,
  phone = excluded.phone, opening_hours = excluded.opening_hours;
