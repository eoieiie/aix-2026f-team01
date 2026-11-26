-- 0053 홈 모임 카드의 먹은 음식 줄 (명세 4-3, 2026-11-26 병주 1안 "먹은 음식 줄").
-- 내가 속한 모임마다 그 모임이 같이 먹은 음식(판 결과로 남은 식사 기록)을 최근 순으로 최대 4개 돌려준다.
-- 같은 음식은 한 번만, 가장 최근에 먹은 때로 줄을 세운다. 다른 모임의 기록은 섞이지 않는다.
-- 음식 번호, 이름, 그림 파일 이름만 돌려준다. 그림이 없으면 화면이 음식 번호로 색 동그라미를 그린다.
-- 여러 번 돌려도 같다(create or replace).
create or replace function public.home_group_foods()
returns table (group_id uuid, foods jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  -- src/constants/index.ts의 HOME_PLATE_FOODS와 같은 값
  v_max constant int := 4;
begin
  return query
  with mine as (
    select ms.group_id as gid from public.memberships ms where ms.user_id = v_uid
  ), latest as (
    select m.group_id as gid, m.food_id as fid, max(m.eaten_at) as last_at
    from public.meals m
    join mine on mine.gid = m.group_id
    group by m.group_id, m.food_id
  ), ranked as (
    select l.gid, l.fid, l.last_at,
      row_number() over (partition by l.gid order by l.last_at desc, l.fid desc) as rn
    from latest l
  )
  select mine.gid,
    coalesce(
      jsonb_agg(
        jsonb_build_object('food_id', f.id, 'name', f.name, 'image_path', f.image_path)
        order by r.rn
      ) filter (where f.id is not null),
      '[]'::jsonb
    )
  from mine
  left join ranked r on r.gid = mine.gid and r.rn <= v_max
  left join public.foods f on f.id = r.fid
  group by mine.gid;
end;
$$;

revoke execute on function public.home_group_foods() from public, anon;
grant execute on function public.home_group_foods() to authenticated;
