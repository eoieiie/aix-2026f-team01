-- 0045 기본 메뉴와 낱말 표를 기준 정답에 맞춘다 (명세 4-7, 4-9, 4-22, 2026-11-25)
-- 병주: "괜찮은데 안 괜찮아지는 버그가 있으면 안 됨", "멀티에이전트로 검증"
-- 기준 정답: python/data/consensus.csv. 평가자 두 명(Claude, GPT)이 0/1/2로 따로 매기고 갈린 칸은 판정자가 정했다.
--   사람이 아니라 AI 셋의 합의라 "기준 정답"이다(사람 정답은 사람 확인 기록 ai_feedback으로 쌓는 중).
-- 원칙: 정답 2(대부분 가게의 기본 레시피) = 확실(tags, "못 먹는 사람이 있어요")
--       정답 1(가게나 버전에 따라) = 약함(soft_tags, "들어갈 수 있어요". 후보를 빼거나 투표를 막지 않는다)
--       정답 0 = 표시 없음
-- 기본 메뉴 40개 x 태그 9개 = 360칸 중 고친 칸 23개(17개 메뉴): 확실에서 약함으로 20, 확실로 더함 2, 약함으로 더함 1.
--   정답 0인데 확실이던 칸은 0개였다. 정답 1인데 원래 표시가 없던 칸은 새로 표시하지 않는다(경고가 많아지면 사람이 무시한다).
--   규동 해산물은 정답 2(가쓰오 다시)지만 PR #122의 상식 목록(해산물을 못 먹는 사람에게 규동은 괜찮다)과 부딪혀 약함으로만 더했다. 사람 확인이 필요하다.
-- 바뀐 칸마다 정답 근거 (A = Claude, B = GPT):
-- 부대찌개 seafood: A·B 모두 1: 멸치·참치 일부 / 멸치 육수를 쓰거나 액젓이 든 김치를 넣기도 하지만 사골과 가공육만으로도 끓인다
-- 부대찌개 beef: A·B 모두 1: 다시다·스팸 일부 / 사골 육수나 소고기 맛 조미료를 쓰는 집과 멸치 육수를 쓰는 집이 있다
-- 부대찌개 dairy: A·B 모두 1: 치즈 슬라이스 가게마다 / 슬라이스 치즈를 얹는 버전도 있지만 모든 집에서 기본은 아니다
-- 김치볶음밥 pork: A·B 모두 1: 돼지·스팸 일부 / 햄과 베이컨 및 돼지 다짐육을 넣는 곳이 흔하지만 김치만 볶는 집도 있다
-- 비빔밥 beef: A 2, B 1, 판정 beef=1: 전주식·돌솥은 소고기 고명이 흔하지만 산채비빔밥처럼 없는 것도 흔함
-- 떡볶이 egg: A·B 모두 1: 삶은 달걀 일부 / 삶은 달걀을 추가하거나 아예 넣지 않는 경우가 있어 가게마다 다르다
-- 라면 seafood: A·B 모두 2: 스프 해물 엑기스 / 흔한 매운 제품은 해물 조미료나 다시마 및 멸치 계열 성분을 국물에 쓰는 경우가 많다
-- 탕수육 wheat: A·B 모두 1: 튀김·소스 간장 일부 / 감자 전분만 쓰는 튀김옷이 흔하지만 튀김옷에 밀가루를 섞거나 일반 간장을 곁들이는 집도 있다
-- 마라탕 wheat: A·B 모두 1: 면·당면 일부 / 당면과 쌀면 외에 밀 옥수수면이나 만두를 고르거나 간장 양념을 쓸 수 있다
-- 초밥 egg: A·B 모두 1: 계란초밥 일부 / 모둠에 달걀말이 초밥을 넣거나 마요 소스를 쓰는 구성도 있다
-- 규동 seafood: A 1, B 2, 판정 seafood=2: 규동 양념은 가쓰오 다시를 간장과 섞는 것이 일본식 기본 레시피
-- 피자 pork: A·B 모두 1: 페퍼로니·햄 일부 / 페퍼로니와 베이컨은 흔한 돼지고기 토핑이지만 치즈와 채소 피자도 흔하다
-- 토마토 파스타 dairy: A·B 모두 1: 파르메산 일부 / 파르메산을 갈아 얹거나 버터를 쓰는 집과 안 쓰는 집이 있다
-- 크림 파스타 pork: A 2, B 1, 판정 pork=1: 베이컨 크림 파스타가 흔하지만 버섯·새우 크림 파스타도 흔함
-- 햄버거 dairy: A 2, B 1, 판정 dairy=1: 치즈버거는 흔하지만 불고기버거처럼 치즈가 없는 기본 버거도 흔함
-- 햄버거 egg: A 2, B 1, 판정 egg=2: 국내 버거 대부분이 마요 소스를 쓰고 번에도 달걀이 흔함
-- 샐러드 dairy: A·B 모두 1: 치즈 드레싱 일부 / 치즈를 뿌리거나 요거트 드레싱을 곁들이는 조합도 있다
-- 샐러드 egg: A·B 모두 1: 삶은 달걀 일부 / 삶은 달걀이나 달걀을 쓴 드레싱을 내는 버전이 있다
-- 샌드위치 pork: A·B 모두 1: 햄 기본 / 햄과 베이컨을 넣기도 하지만 달걀이나 닭 버전도 흔하다
-- 인도 커리 spicy: A·B 모두 1: 매운 정도 일부 / 빈달루 등 고추가 많은 커리와 코르마 등 순한 커리가 모두 흔하다
-- 인도 커리 chicken: A 2, B 1, 판정 chicken=1: 치킨 커리가 흔하지만 채소·양고기 커리도 흔해 하나로 안 정해짐
-- 인도 커리 wheat: A 2, B 1, 판정 wheat=1: 커리 자체에는 밀이 거의 없고 난과 밥 중에 고르는 곳이 많음
-- 케밥 dairy: A·B 모두 1: 요거트 소스 일부 / 요거트에 재우거나 요거트 소스를 곁들이기도 하지만 기름과 향신료만 쓰는 버전도 있다
-- 여러 번 넣어도 같게 썼다(if not exists, or replace, 값 덮어쓰기).

alter table public.foods add column if not exists soft_tags text[] not null default '{}';
alter table public.food_keywords add column if not exists soft_tags text[] not null default '{}';
alter table public.foods drop constraint if exists foods_soft_tags_check;
alter table public.foods add constraint foods_soft_tags_check check (soft_tags <@ public.ingredient_tags());
alter table public.food_keywords drop constraint if exists food_keywords_soft_tags_check;
alter table public.food_keywords add constraint food_keywords_soft_tags_check check (soft_tags <@ public.ingredient_tags());

-- 기본 메뉴 40개의 확실과 약함 (이름, 확실, 약함). 식단 짝 표시(veg_ok 등)는 그대로 둔다.
-- seed/0001_foods.sql의 확실 태그와 같아야 한다(restrictions-sweep.test.ts가 본다). seed 끝에서도 이 함수를 부른다
create or replace function public.apply_base_food_levels() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.foods f
  set tags = array(
        select distinct t from unnest(
          array(select x from unnest(f.tags) as x where not (x = any (public.ingredient_tags()))) || v.sure::text[]
        ) as t order by t),
      soft_tags = v.soft::text[]
  from (values
    ('김치찌개', '{pork,seafood,spicy}', '{}'),
    ('된장찌개', '{seafood}', '{}'),
    ('부대찌개', '{pork,spicy,wheat}', '{beef,dairy,seafood}'),  -- 내림 seafood; 내림 beef; 내림 dairy
    ('순두부찌개', '{egg,seafood,spicy}', '{}'),
    ('김치볶음밥', '{egg,seafood,spicy}', '{pork}'),  -- 내림 pork
    ('비빔밥', '{egg,spicy}', '{beef}'),  -- 내림 beef
    ('불고기', '{beef}', '{}'),
    ('제육볶음', '{pork,spicy}', '{}'),
    ('삼겹살', '{pork}', '{}'),
    ('닭갈비', '{chicken,spicy}', '{}'),
    ('삼계탕', '{chicken}', '{}'),
    ('물냉면', '{beef,egg,wheat}', '{}'),
    ('칼국수', '{seafood,wheat}', '{}'),
    ('돼지국밥', '{pork}', '{}'),
    ('설렁탕', '{beef,wheat}', '{}'),
    ('떡볶이', '{seafood,spicy,wheat}', '{egg}'),  -- 내림 egg
    ('김밥', '{egg,pork,seafood,wheat}', '{}'),
    ('콩국수', '{wheat}', '{}'),
    ('감자탕', '{pork,spicy}', '{}'),
    ('라면', '{beef,egg,seafood,spicy,wheat}', '{}'),  -- 더함 seafood
    ('짜장면', '{pork,wheat}', '{}'),
    ('짬뽕', '{pork,seafood,spicy,wheat}', '{}'),
    ('탕수육', '{pork}', '{wheat}'),  -- 내림 wheat
    ('마라탕', '{beef,nuts,spicy}', '{wheat}'),  -- 내림 wheat
    ('초밥', '{seafood}', '{egg}'),  -- 내림 egg
    ('돈까스', '{egg,pork,wheat}', '{}'),
    ('우동', '{seafood,wheat}', '{}'),
    ('라멘', '{egg,pork,wheat}', '{}'),
    ('규동', '{beef}', '{seafood}'),  -- 약하게 더함 seafood
    ('피자', '{dairy,wheat}', '{pork}'),  -- 내림 pork
    ('토마토 파스타', '{wheat}', '{dairy}'),  -- 내림 dairy
    ('크림 파스타', '{dairy,wheat}', '{pork}'),  -- 내림 pork
    ('햄버거', '{beef,egg,wheat}', '{dairy}'),  -- 내림 dairy; 더함 egg
    ('치킨', '{chicken,wheat}', '{}'),
    ('샐러드', '{}', '{dairy,egg}'),  -- 내림 dairy; 내림 egg
    ('샌드위치', '{dairy,egg,wheat}', '{pork}'),  -- 내림 pork
    ('쌀국수', '{beef,seafood}', '{}'),
    ('팟타이', '{egg,nuts,seafood}', '{}'),
    ('인도 커리', '{dairy}', '{chicken,spicy,wheat}'),  -- 내림 spicy; 내림 chicken; 내림 wheat
    ('케밥', '{chicken,wheat}', '{dairy}')  -- 내림 dairy
  ) as v(name, sure, soft)
  where f.name = v.name and not f.custom;
end;
$$;
revoke execute on function public.apply_base_food_levels() from public, anon, authenticated;
do $$ begin perform public.apply_base_food_levels(); end $$;

-- 낱말 표: 같은 기준으로 고친다 (낱말, 확실, 약함). 이름만으로 하나로 안 정해지면 약함
insert into public.food_keywords (keyword, tags, soft_tags) values
    ('갈비', '{}', '{beef,pork}'),        -- 소갈비와 돼지갈비가 둘 다 흔하다(돼지갈비는 "돼지"가 확실로 잡는다)
    ('곱창', '{}', '{beef,pork}'),        -- 소곱창과 돼지곱창이 둘 다 흔하다
    ('막창', '{}', '{beef,pork}'),        -- 돼지막창과 소막창이 둘 다 흔하다
    ('대창', '{beef}', '{pork}'),         -- 대창은 보통 소대창, 돼지대창은 일부
    ('수육', '{pork}', '{beef}'),         -- 수육은 보통 돼지, 소 수육은 일부
    ('함박', '{beef}', '{pork}'),         -- 소고기가 기본이고 돼지고기를 섞는 가게가 있다
    ('버거', '{egg,wheat}', '{beef,dairy}'), -- 치킨버거, 새우버거도 "버거"다. 빵과 마요(달걀)는 기본, 소고기와 치즈는 버거마다(햄버거 정답: 치즈 1, 달걀 2)
    ('탕수육', '{pork}', '{wheat}'),      -- 감자 전분 튀김옷이 흔하다(탕수육 정답: 밀 1)
    ('파전', '{wheat}', '{seafood}'),     -- 해물파전과 파만 넣은 파전이 둘 다 흔하다(부추전 정답: 해산물 1)
    ('낙지', '{seafood}', '{spicy}')      -- 낙지볶음은 맵지만 연포탕, 산낙지는 맵지 않다
on conflict (keyword) do update set tags = excluded.tags, soft_tags = excluded.soft_tags;

-- 낱말 표 오발 막기를 더한다(0044 food_keyword_skips)
insert into public.food_keyword_skips (keyword, inside) values
  ('면', '쌀면'),                -- 쌀면에는 밀이 없다
  ('면', '당면'),                -- 당면은 고구마 전분
  ('면', '곤약면'),
  ('스테이크', '연어스테이크'),  -- 소고기가 아니다
  ('스테이크', '치킨스테이크'),
  ('스테이크', '닭스테이크')
on conflict do nothing;

-- 직접 적은 메뉴의 약한 태그: 이름에 든 기본 메뉴와 낱말 표의 soft_tags. 확실로 잡힌 것은 뺀다
create or replace function public.guess_food_soft_tags(p_name text) returns text[]
language sql stable set search_path = ''
as $$
  select coalesce(array(
    select distinct t from (
      select unnest(f.soft_tags) as t from public.foods f
      where not f.custom and strpos(
        public.strip_words(p_name, array(select s.inside from public.food_keyword_skips s where s.keyword = f.name)),
        f.name) > 0
      union
      select unnest(k.soft_tags) from public.food_keywords k
      where strpos(
        public.strip_words(p_name, array(select s.inside from public.food_keyword_skips s where s.keyword = k.keyword)),
        k.keyword) > 0
    ) x
    where t = any (public.ingredient_tags()) and not (t = any (public.guess_food_tags(p_name)))
    order by t
  ), '{}'::text[])
$$;
revoke execute on function public.guess_food_soft_tags(text) from public, anon, authenticated;

-- 판정: 약한 표시는 AI 태그와 가게마다 다른 태그(soft_tags) 중 확실에 없는 것 (나머지는 0044 그대로)
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
    ),
    maybe_tags = coalesce((
      select array_agg(distinct t order by t)
      from public.foods f
      cross join lateral unnest(f.ai_tags || f.soft_tags) as t
      where f.id = c.food_id
        and not (t = any (f.tags))
        and exists (
          select 1 from public.session_participants sp
          join public.restrictions r on r.user_id = sp.user_id and r.tag is not null
          where sp.session_id = c.session_id and t = any (public.diet_ingredients(r.tag))
        )
    ), '{}'::text[])
  where c.session_id = p_session_id;
end;
$$;

-- 직접 적기: 새 음식에 약한 태그도 남긴다 (나머지는 0044 그대로)
create or replace function public.add_custom_candidate(p_session_id uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_session public.sessions := public.lock_session(p_session_id, v_uid);
  v_name text;
  v_food_id bigint;
begin
  perform public.require_participant(p_session_id, v_uid);
  if v_session.status <> 'open' then
    raise exception 'voting_started';
  end if;
  v_name := public.clean_name(public.clean_menu_text(p_name), public.app_limit('FOOD_NAME_MAX'));
  select id into v_food_id from public.foods where name = v_name;
  if v_food_id is null then
    insert into public.foods (name, tags, soft_tags, cuisine, custom)
    values (v_name, public.guess_food_tags(v_name), public.guess_food_soft_tags(v_name), 'custom', true)
    on conflict (name) do nothing
    returning id into v_food_id;
    if v_food_id is null then
      select id into v_food_id from public.foods where name = v_name;
    end if;
  end if;
  return jsonb_build_object(
    'food_id', v_food_id,
    'vetoed', public.add_candidate(p_session_id, v_food_id)
  );
end;
$$;
revoke execute on function public.add_custom_candidate(uuid, text) from public, anon;
grant execute on function public.add_custom_candidate(uuid, text) to authenticated;

-- 이미 저장된 직접 적은 메뉴: 바뀐 기본 메뉴와 낱말 표로 확실과 약함을 다시 계산(사람이 더한 태그는 확실 그대로)
update public.foods f
set tags = array(select distinct t from unnest(public.guess_food_tags(f.name) || f.human_tags) as t order by t),
    soft_tags = array(
      select t from unnest(public.guess_food_soft_tags(f.name)) as t
      where not (t = any (f.human_tags)) order by t)
where f.custom
  and (f.tags is distinct from array(select distinct t from unnest(public.guess_food_tags(f.name) || f.human_tags) as t order by t)
    or f.soft_tags is distinct from array(
      select t from unnest(public.guess_food_soft_tags(f.name)) as t where not (t = any (f.human_tags)) order by t));
do $$
declare s record;
begin
  for s in select id from public.sessions where status <> 'done' loop
    perform public.refresh_vetoes(s.id);
  end loop;
end $$;
