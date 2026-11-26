-- 0024 AI 재료 추정 다시 묻기 (2026-11-21, 명세 4-22)
-- 0023은 pending이면 다시 묻지 않아서, 함수가 중간에 죽으면 그 이름은 계속 낱말 표만 썼다.
-- 마지막으로 물은 시각(ai_tried_at)을 남기고, pending 또는 failed가 10분 넘게 지났으면 다시 "물어봐"를 돌려준다.
-- 하루 상한(AI_DAILY_MAX)은 그대로 센다.

alter table public.foods add column if not exists ai_tried_at timestamptz;

create or replace function public.ai_ingredient_request(p_food_id bigint) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_food public.foods;
  v_cache public.ai_ingredient_cache;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_calls int;
begin
  select * into v_food from public.foods where id = p_food_id;
  if v_food.id is null or not v_food.custom then
    raise exception 'not_custom_food';
  end if;
  if not exists (
    select 1 from public.candidates c
    join public.session_participants sp on sp.session_id = c.session_id and sp.user_id = v_uid
    where c.food_id = p_food_id
  ) then
    raise exception 'not_participant';
  end if;
  if v_food.ai_status = 'done' then
    return jsonb_build_object('action', 'skip', 'reason', 'done');
  end if;

  select * into v_cache from public.ai_ingredient_cache where name_key = public.ai_name_key(v_food.name);
  if v_cache.name_key is not null then
    perform public.ai_ingredient_apply(p_food_id, v_cache.tags, v_cache.notes, v_cache.model);
    return jsonb_build_object('action', 'cached');
  end if;
  -- 묻는 중이거나 실패한 지 10분이 안 됐으면 다시 묻지 않는다. 10분이 지나면 다시 묻는다
  -- (함수가 중간에 죽어 pending으로 남거나, 무료 등급이 바빠 failed가 된 이름이 영영 낱말 표만 쓰지 않게)
  if v_food.ai_status in ('pending', 'failed') and v_food.ai_tried_at > now() - interval '10 minutes' then
    return jsonb_build_object('action', 'skip', 'reason', v_food.ai_status);
  end if;

  insert into public.ai_usage (day, calls) values (v_day, 1)
  on conflict (day) do update set calls = public.ai_usage.calls + 1
  returning calls into v_calls;
  if v_calls > public.app_limit('AI_DAILY_MAX') then
    return jsonb_build_object('action', 'skip', 'reason', 'daily_limit');
  end if;

  update public.foods set ai_status = 'pending', ai_tried_at = now() where id = p_food_id;
  return jsonb_build_object('action', 'ask', 'name', v_food.name);
end;
$$;
