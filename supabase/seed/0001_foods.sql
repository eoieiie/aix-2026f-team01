-- [제안] 기본 음식 40개 (4-9). 목록과 태그는 팀 검토 전 초안이다.
-- 재료 태그: spicy seafood pork beef chicken wheat dairy nuts egg
-- 태그 원칙(4-7, 0045에서 고침): 대부분 가게의 기본 레시피면 확실(tags), 가게마다 다르면 약함(soft_tags, 0045). 애매하다고 확실로 올리지 않는다. 김치가 든 음식은 젓갈 때문에 해산물을 붙인다.
-- 식단 짝 표시: halal_ok veg_ok vegan_ok. 0012부터 판정에는 쓰지 않는다(식단은 재료 묶음으로 본다). 고기가 든 음식에는 halal_ok를 붙이지 않는다
-- 이미 서버에 들어간 음식은 0007_restrictions_cleanup.sql이 같은 값으로 고친다. 여기를 고치면 거기도 같이 고친다
insert into public.foods (name, name_en, tags, cuisine) values
  ('김치찌개', 'Kimchi stew', array['spicy','pork','seafood'], 'korean'),
  ('된장찌개', 'Soybean paste stew', array['seafood'], 'korean'),
  ('부대찌개', 'Army stew', array['spicy','pork','wheat'], 'korean'),
  ('순두부찌개', 'Soft tofu stew', array['spicy','seafood','egg'], 'korean'),
  ('김치볶음밥', 'Kimchi fried rice', array['spicy','seafood','egg'], 'korean'),
  ('비빔밥', 'Bibimbap', array['spicy','egg'], 'korean'),
  ('불고기', 'Bulgogi', array['beef'], 'korean'),
  ('제육볶음', 'Spicy stir-fried pork', array['spicy','pork'], 'korean'),
  ('삼겹살', 'Pork belly', array['pork'], 'korean'),
  ('닭갈비', 'Spicy stir-fried chicken', array['spicy','chicken'], 'korean'),
  ('삼계탕', 'Ginseng chicken soup', array['chicken'], 'korean'),
  ('물냉면', 'Cold buckwheat noodles', array['beef','wheat','egg'], 'korean'),
  ('칼국수', 'Knife-cut noodles', array['wheat','seafood'], 'korean'),
  ('돼지국밥', 'Pork and rice soup', array['pork'], 'korean'),
  ('설렁탕', 'Ox bone soup', array['beef','wheat'], 'korean'),
  ('떡볶이', 'Tteokbokki', array['spicy','wheat','seafood'], 'korean'),
  ('김밥', 'Gimbap', array['pork','seafood','wheat','egg'], 'korean'),
  ('콩국수', 'Cold soybean noodles', array['wheat','veg_ok','vegan_ok','halal_ok'], 'korean'),
  ('감자탕', 'Pork bone stew', array['spicy','pork'], 'korean'),
  ('라면', 'Ramyeon', array['spicy','wheat','beef','egg','seafood'], 'korean'),
  ('짜장면', 'Jajangmyeon', array['wheat','pork'], 'chinese'),
  ('짬뽕', 'Jjamppong', array['spicy','wheat','seafood','pork'], 'chinese'),
  ('탕수육', 'Sweet and sour pork', array['pork'], 'chinese'),
  ('마라탕', 'Malatang', array['spicy','beef','nuts'], 'chinese'),
  ('초밥', 'Sushi', array['seafood'], 'japanese'),
  ('돈까스', 'Pork cutlet', array['pork','wheat','egg'], 'japanese'),
  ('우동', 'Udon', array['wheat','seafood'], 'japanese'),
  ('라멘', 'Ramen', array['pork','wheat','egg'], 'japanese'),
  ('규동', 'Beef rice bowl', array['beef'], 'japanese'),
  ('피자', 'Pizza', array['wheat','dairy'], 'western'),
  ('토마토 파스타', 'Tomato pasta', array['wheat','veg_ok'], 'western'),
  ('크림 파스타', 'Cream pasta', array['wheat','dairy'], 'western'),
  ('햄버거', 'Hamburger', array['beef','wheat','egg'], 'western'),
  ('치킨', 'Fried chicken', array['chicken','wheat'], 'western'),
  ('샐러드', 'Salad', array['veg_ok','halal_ok'], 'western'),
  ('샌드위치', 'Sandwich', array['wheat','dairy','egg'], 'western'),
  ('쌀국수', 'Pho', array['beef','seafood'], 'asian'),
  ('팟타이', 'Pad thai', array['seafood','nuts','egg'], 'asian'),
  ('인도 커리', 'Indian curry', array['dairy'], 'asian'),
  ('케밥', 'Kebab', array['chicken','wheat'], 'asian')
on conflict (name) do nothing;

-- 가게마다 다른 재료(약한 표시)와 확실 태그를 0045 기준 정답 값으로 맞춘다
select public.apply_base_food_levels();
