-- 0007 못 먹는 것 정리 (명세 4-7, 이슈 #39, 2026-11-02 결정 #35)
-- 1. 이유(알레르기, 안 먹어요, 신념)를 받지 않는다. 건강 정보와 종교에 맞닿은 정보라 저장하지 않고, 이미 저장된 이유는 지운다
-- 2. 재료 태그에 달걀(egg)을 더한다. 흔한 알레르기인데 음식 지정으로만 피할 수 있었다
-- 3. 기본 음식의 태그를 4-7 원칙대로 고친다. 흔히 들어가면 붙이고, 애매하면 "못 먹을 수 있다" 쪽으로 붙인다
--
-- 순서: 번호는 0007이지만 실제 서버에는 0008~0013 뒤에 들어간다. 새 DB(테스트)에서는 그 앞에 들어간다.
-- 그래서 0008~0013이 다시 만드는 것(diet_ingredients, refresh_vetoes, food_keywords 등)은 여기서 건드리지 않는다.
-- 비건 묶음에 달걀을 더하는 것과 낱말 표의 달걀은 0014에 있다.
-- 여러 번 넣어도 같은 결과가 나오게 썼다(if exists, or replace).

-- 1. 이유 칸을 없앤다 ------------------------------------------------------

alter table public.restrictions drop column if exists kind;

-- 돌려주는 칸이 바뀌어서 지우고 다시 만든다
drop function if exists public.get_my_restrictions();
create function public.get_my_restrictions()
returns table (tag text, food_id bigint)
language sql stable security definer set search_path = ''
as $$
  select r.tag, r.food_id
  from public.restrictions r
  where r.user_id = public.require_uid()
  order by r.id
$$;

-- 전체를 바꾼다. 빈 배열이면 전부 해제. 내가 참여한 진행 중인 판의 후보를 다시 판정한다.
-- p_items 예: [{"tag":"seafood"},{"food_id":3}]. 이 PR 전의 앱이 보내는 "kind"는 받지만 쓰지 않는다
create or replace function public.set_my_restrictions(p_items jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_items';
  end if;

  -- 하나라도 잘못되면 지운 것까지 되돌려 예전 값을 그대로 둔다
  begin
    delete from public.restrictions where user_id = v_uid;

    insert into public.restrictions (user_id, tag, food_id)
    select v_uid, item ->> 'tag', (item ->> 'food_id')::bigint
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item;
  exception
    when check_violation or unique_violation or foreign_key_violation
      or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_items';
  end;

  for v_session_id in
    select s.id from public.sessions s
    join public.session_participants sp on sp.session_id = s.id
    where sp.user_id = v_uid and s.status <> 'done'
    order by s.id
    for update of s
  loop
    perform public.refresh_vetoes(v_session_id);
  end loop;
end;
$$;

revoke execute on function public.get_my_restrictions(), public.set_my_restrictions(jsonb) from public, anon;
grant execute on function public.get_my_restrictions(), public.set_my_restrictions(jsonb) to authenticated;

-- 2. 달걀 태그 --------------------------------------------------------------

-- 재료 9개. 앱 상수(src/constants/restrictions.ts)와 같아야 한다 (restrictions.test.ts)
create or replace function public.ingredient_tags() returns text[]
language sql immutable set search_path = ''
as $$ select array['spicy','seafood','pork','beef','chicken','wheat','dairy','nuts','egg'] $$;

-- 3. 기본 음식 태그 ---------------------------------------------------------
-- 이미 서버에 들어간 음식을 고친다. 새 DB에서는 아직 음식이 없어 아무것도 바뀌지 않고, seed(0001_foods.sql)가 같은 값을 넣는다.
-- 이름으로 찾는다. 이름은 유일하고, 직접 적은 메뉴는 같은 이름이면 이 음식으로 올라가서(0008) 겹치지 않는다.
-- 고친 이유는 PR 본문 표에 있다. 김치는 젓갈이 들어가서 김치가 든 음식에는 해산물을 붙인다.
-- 고기가 든 음식에는 halal_ok를 붙이지 않는다(할랄 방식인지는 식당마다 다르다). 짝 표시는 0012부터 판정에 쓰지 않는다

update public.foods f set tags = v.tags
from (values
  ('김치찌개', array['spicy','pork','seafood']),
  ('부대찌개', array['spicy','pork','beef','wheat','dairy','seafood']),
  ('순두부찌개', array['spicy','seafood','egg']),
  ('김치볶음밥', array['spicy','pork','seafood','egg']),
  ('비빔밥', array['spicy','beef','egg']),
  ('물냉면', array['beef','wheat','egg']),
  ('설렁탕', array['beef','wheat']),
  ('떡볶이', array['spicy','wheat','seafood','egg']),
  ('김밥', array['pork','seafood','wheat','egg']),
  ('라면', array['spicy','wheat','beef','egg']),
  ('마라탕', array['spicy','beef','wheat','nuts']),
  ('초밥', array['seafood','egg']),
  ('돈까스', array['pork','wheat','egg']),
  ('라멘', array['pork','wheat','egg']),
  ('토마토 파스타', array['wheat','dairy','veg_ok']),
  ('샐러드', array['egg','dairy','veg_ok','halal_ok']),
  ('샌드위치', array['wheat','dairy','pork','egg']),
  ('팟타이', array['seafood','nuts','egg']),
  ('인도 커리', array['spicy','chicken','dairy','wheat']),
  ('케밥', array['chicken','wheat','dairy'])
) as v(name, tags)
where f.name = v.name;

-- 진행 중인 판은 새 태그로 다시 판정한다
do $$
declare s record;
begin
  for s in select id from public.sessions where status <> 'done' loop
    perform public.refresh_vetoes(s.id);
  end loop;
end $$;
