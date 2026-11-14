-- 0014 비건 묶음에 달걀, 직접 적은 메뉴의 달걀 낱말 (명세 4-7, 4-9, 이슈 #39)
-- 0007에서 달걀(egg) 재료 태그를 더했다. 여기는 0012 뒤에 들어가야 하는 것만 둔다.
-- 0007은 새 DB에서 0008~0013보다 먼저 들어가서, 0012가 만드는 diet_ingredients를 거기서 고치면 0012가 덮어쓴다.
-- 여러 번 넣어도 같은 결과가 나오게 썼다(or replace, on conflict).

-- 식단은 재료 묶음으로 본다(0012). 비건에 달걀을 더한다. 채식은 달걀을 먹는 쪽으로 둔다(0012와 같음)
create or replace function public.diet_ingredients(p_tag text) returns text[]
language sql immutable set search_path = ''
as $$
  select case p_tag
    when 'halal' then array['pork']
    when 'vegetarian' then array['pork', 'beef', 'chicken', 'seafood']
    when 'vegan' then array['pork', 'beef', 'chicken', 'seafood', 'dairy', 'egg']
    else array[p_tag]
  end
$$;

revoke execute on function public.diet_ingredients(text) from public, anon;

-- 직접 적은 메뉴의 재료 짐작(0008)에 달걀 낱말을 더한다. 기본 음식 이름이 든 메뉴(예: "치즈김밥")는 그 음식의 태그를 받아서 따로 넣지 않는다
insert into public.food_keywords (keyword, tags) values
  ('계란', '{egg}'), ('달걀', '{egg}'), ('에그', '{egg}'), ('오므', '{egg}'), ('마요', '{egg}')
on conflict (keyword) do nothing;

-- 진행 중인 판은 새 묶음으로 다시 판정한다
do $$
declare s record;
begin
  for s in select id from public.sessions where status <> 'done' loop
    perform public.refresh_vetoes(s.id);
  end loop;
end $$;
