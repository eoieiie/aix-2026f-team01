-- 0012 식단은 재료로만 본다 (2026-11-12 결정, 명세 4-7, 4-9)
-- 전에는 음식에 짝 표시(halal_ok, veg_ok, vegan_ok)가 없으면 걸렸다. 그래서 할랄이나 채식을 고르면 거의 모든 후보에
-- "못 먹는 사람이 있어요"가 붙었다. 이제 식단을 재료 묶음으로 바꿔서 그 재료가 든 음식만 걸린다.
--   할랄: 돼지고기 / 채식: 돼지고기, 소고기, 닭고기, 해산물 / 비건: 채식 + 유제품 (달걀은 0007에서 태그가 생기면 더한다)
-- 투표 화면 위 안내도 "돼지고기 못 먹는 사람이 있어요"처럼 재료로만 보인다.
-- 함께 고침: refresh_vetoes가 걸린 후보의 표를 지우던 것을 뺀다. 0010부터 걸린 후보도 찍을 수 있어서,
-- 사람이 새로 들어올 때 이미 찍은 표가 사라지면 안 된다.

create or replace function public.diet_ingredients(p_tag text) returns text[]
language sql immutable set search_path = ''
as $$
  select case p_tag
    when 'halal' then array['pork']
    when 'vegetarian' then array['pork', 'beef', 'chicken', 'seafood']
    when 'vegan' then array['pork', 'beef', 'chicken', 'seafood', 'dairy']
    else array[p_tag]
  end
$$;

create or replace function public.restriction_blocks(
  p_food_id bigint, p_food_tags text[], p_tag text, p_restricted_food_id bigint
) returns boolean
language sql immutable set search_path = ''
as $$
  select case
    when p_restricted_food_id is not null then p_restricted_food_id = p_food_id
    else p_food_tags && public.diet_ingredients(p_tag)
  end
$$;

create or replace function public.refresh_vetoes(p_session_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.candidates c
  set vetoed = exists (
    select 1
    from public.session_participants sp
    join public.restrictions r on r.user_id = sp.user_id
    join public.foods f on f.id = c.food_id
    where sp.session_id = c.session_id
      and public.restriction_blocks(f.id, f.tags, r.tag, r.food_id)
  )
  where c.session_id = p_session_id;
end;
$$;

-- 투표 화면 위 안내: 후보에 실제로 걸리는 재료와, 음식을 직접 고른 경우 그 음식 이름. 누가 적었는지는 없다
create or replace function public.session_cant_eat(p_session_id uuid)
returns table (tag text, food_name text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_session_member(p_session_id) then
    raise exception 'not_member';
  end if;
  return query
  select x.tag, x.food_name from (
    select distinct ing as tag, null::text as food_name
    from public.session_participants sp
    join public.restrictions r on r.user_id = sp.user_id and r.tag is not null
    join public.candidates c on c.session_id = sp.session_id
    join public.foods f on f.id = c.food_id
    cross join lateral unnest(public.diet_ingredients(r.tag)) as ing
    where sp.session_id = p_session_id and ing = any (f.tags)
    union
    select distinct null::text, rf.name
    from public.session_participants sp
    join public.restrictions r on r.user_id = sp.user_id and r.food_id is not null
    join public.candidates c on c.session_id = sp.session_id and c.food_id = r.food_id
    join public.foods rf on rf.id = r.food_id
    where sp.session_id = p_session_id
  ) x
  order by 1, 2;
end;
$$;

-- 진행 중인 판은 새 규칙으로 다시 판정한다
do $$
declare s record;
begin
  for s in select id from public.sessions where status <> 'done' loop
    perform public.refresh_vetoes(s.id);
  end loop;
end $$;

revoke execute on function public.diet_ingredients(text) from public, anon;
