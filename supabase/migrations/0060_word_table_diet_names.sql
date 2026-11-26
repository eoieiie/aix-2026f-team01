-- 0060 낱말 표 오발 고치기: 식단 이름과 짧은 낱말 (명세 4-7, 4-9, 2026-11-26)
-- 2차 메뉴 40개(python/data/consensus2.csv, AI 기준 정답)에서 "괜히 붙은 확실 경고" 4칸이 모두 낱말 표에서 왔다:
--   굴라쉬 해산물("굴"), 비건 라멘 돼지고기("라멘"), 채식 만두 돼지고기("만두"), 콩고기 불고기 소고기("불고기")
-- 이 네 메뉴만 고치지 않고 일반 규칙 두 개로 고친다.
-- 1. 식단 이름: 이름에 식단을 말하는 낱말(비건, 채식, 베지, 식물성, 콩고기, 대체육 등, food_diet_words)이 있으면
--    낱말 표에서 온 고기, 해산물, 유제품, 달걀 태그(diet_soft_tags)를 확실이 아니라 약함("들어갈 수 있어요")으로 내린다.
--    지우지 않는다: 가게마다 다를 수 있어 못 먹는 사람에게는 옅게라도 보인다. 밀, 매운맛, 견과는 그대로 확실이다.
--    사람이 더한 태그(human_tags)는 그대로 확실이다.
-- 2. 짧은 낱말 오발: 한 글자 낱말(굴, 회 등)이 다른 음식 이름 안에 든 경우를 0044 food_keyword_skips로 막는다.
--    한 글자 낱말(굴, 닭, 면, 빵, 햄, 회)을 훑어 실제 음식 이름만 넣었다: 굴라쉬, 굴라시(굴), 회과육(회, 돼지고기 요리).
--    돼지감자(뚱딴지, 채소)의 "돼지"도 같이 막는다. 굴국밥, 굴소스, 회덮밥, 물회는 그대로 걸린다.
-- 여러 번 넣어도 같게 썼다(if not exists, or replace, on conflict).

create table if not exists public.food_diet_words (
  word text primary key check (word = lower(word) and strpos(word, ' ') = 0)
);
alter table public.food_diet_words enable row level security;
revoke all on public.food_diet_words from anon, authenticated;

insert into public.food_diet_words (word) values
  ('비건'), ('채식'), ('베지'), ('식물성'), ('콩고기'), ('대체육'), ('밀고기'), ('두부고기'), ('사찰음식'),
  ('vegan'), ('vegetarian'), ('veggie')
on conflict do nothing;

insert into public.food_keyword_skips (keyword, inside) values
  ('굴', '굴라쉬'),        -- 헝가리 고기 스튜, 굴이 아니다
  ('굴', '굴라시'),
  ('회', '회과육'),        -- 중국 돼지고기 볶음, 날생선이 아니다
  ('돼지', '돼지감자'),    -- 뚱딴지(채소)
  ('채식', '야채식')       -- 야채식빵, 야채식당의 "채식"은 식단이 아니다
on conflict do nothing;

-- 낱말 표에서 식단 이름일 때 약함으로 내리는 태그
create or replace function public.diet_soft_tags() returns text[]
language sql immutable set search_path = ''
as $$ select '{pork,beef,chicken,seafood,dairy,egg}'::text[] $$;
revoke execute on function public.diet_soft_tags() from public, anon, authenticated;

-- 이름에 식단 낱말이 있는지(공백 빼고, 영어는 소문자로). 오발 막기(food_keyword_skips)도 본다
create or replace function public.food_diet_name(p_name text) returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.food_diet_words w
    where strpos(
      public.strip_words(lower(replace(coalesce(p_name, ''), ' ', '')),
        array(select s.inside from public.food_keyword_skips s where s.keyword = w.word)),
      w.word) > 0
  )
$$;
revoke execute on function public.food_diet_name(text) from public, anon, authenticated;

-- 낱말 표 그대로의 확실 태그 (0044 guess_food_tags 본문과 같다)
create or replace function public.guess_food_word_tags(p_name text) returns text[]
language sql stable set search_path = ''
as $$
  select coalesce(array(
    select distinct t from (
      select unnest(f.tags) as t from public.foods f
      where not f.custom and strpos(
        public.strip_words(p_name, array(select s.inside from public.food_keyword_skips s where s.keyword = f.name)),
        f.name) > 0
      union
      select unnest(k.tags) from public.food_keywords k
      where strpos(
        public.strip_words(p_name, array(select s.inside from public.food_keyword_skips s where s.keyword = k.keyword)),
        k.keyword) > 0
    ) x
    where t = any (public.ingredient_tags())
    order by t
  ), '{}'::text[])
$$;
revoke execute on function public.guess_food_word_tags(text) from public, anon, authenticated;

-- 확실: 식단 이름이면 고기, 해산물, 유제품, 달걀을 뺀다(아래 약함으로 간다)
create or replace function public.guess_food_tags(p_name text) returns text[]
language sql stable set search_path = ''
as $$
  select coalesce(array(
    select t from unnest(public.guess_food_word_tags(p_name)) as t
    where not (t = any (public.diet_soft_tags()) and public.food_diet_name(p_name))
    order by t
  ), '{}'::text[])
$$;
revoke execute on function public.guess_food_tags(text) from public, anon, authenticated;

-- 약함: 0045 그대로(이름에 든 기본 메뉴와 낱말의 약한 태그) + 식단 이름이라 확실에서 내린 태그. 확실로 잡힌 것은 뺀다
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
      union
      select w from unnest(public.guess_food_word_tags(p_name)) as w
      where w = any (public.diet_soft_tags()) and public.food_diet_name(p_name)
    ) x
    where t = any (public.ingredient_tags()) and not (t = any (public.guess_food_tags(p_name)))
    order by t
  ), '{}'::text[])
$$;
revoke execute on function public.guess_food_soft_tags(text) from public, anon, authenticated;

-- 이미 저장된 직접 적은 메뉴: 확실과 약함을 다시 계산(사람이 더한 태그는 확실 그대로, 0045와 같은 방식)
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
