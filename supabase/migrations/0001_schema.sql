-- 명세 5절 데이터 모델.

-- 규칙 숫자. src/constants/index.ts와 같아야 한다 (3절 4번).
-- src/constants/server-limits.test.ts가 아래 JSON을 읽어 앱 상수와 비교한다
create function public.app_limits() returns jsonb
language sql immutable set search_path = ''
as $$
  select '{"GROUP_NAME_MAX": 40, "DISPLAY_NAME_MAX": 20, "INVITE_CODE_LENGTH": 6, "PITCH_MAX": 60, "MAX_VOTES_PER_PERSON": 2}'::jsonb
$$;

create function public.app_limit(p_key text) returns int
language sql immutable set search_path = ''
as $$ select (public.app_limits() ->> p_key)::int $$;

-- 태그 이름. 재료 8개와 식단 3개(4-7), 음식에 붙는 식단 짝 표시(4-9)
create function public.ingredient_tags() returns text[]
language sql immutable set search_path = ''
as $$ select array['spicy','seafood','pork','beef','chicken','wheat','dairy','nuts'] $$;

create function public.diet_tags() returns text[]
language sql immutable set search_path = ''
as $$ select array['halal','vegetarian','vegan'] $$;

create function public.diet_ok_tags() returns text[]
language sql immutable set search_path = ''
as $$ select array['halal_ok','veg_ok','vegan_ok'] $$;

-- 사람 하나당 하나 (3절 3번)
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and public.app_limit('DISPLAY_NAME_MAX')),
  handle text unique check (char_length(handle) between 3 and 16),
  quiz_answers jsonb,
  axes jsonb,
  created_at timestamptz not null default now()
);

create table public.foods (
  id bigint generated always as identity primary key,
  name text not null unique,
  name_en text,
  tags text[] not null default '{}'
    check (tags <@ (public.ingredient_tags() || public.diet_ok_tags())),
  cuisine text
);

-- 못 먹는 것. 태그나 음식 중 하나만 가진다
create table public.restrictions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tag text check (tag = any (public.ingredient_tags() || public.diet_tags())),
  food_id bigint references public.foods (id) on delete cascade,
  kind text not null check (kind in ('allergy', 'dislike', 'belief')),
  check (num_nonnulls(tag, food_id) = 1),
  unique (user_id, tag),
  unique (user_id, food_id)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and public.app_limit('GROUP_NAME_MAX')),
  -- 영어 대문자와 숫자, 0 O 1 I 제외
  invite_code text not null unique
    check (invite_code ~ '^[A-HJ-NP-Z2-9]+$' and char_length(invite_code) = public.app_limit('INVITE_CODE_LENGTH')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.memberships (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and public.app_limit('DISPLAY_NAME_MAX')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  unique (group_id, display_name)
);

create index memberships_user_id_idx on public.memberships (user_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  host_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'voting', 'done')),
  decided_food_id bigint references public.foods (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- 한 모임에 진행 중인 판은 하나뿐 (4-8)
create unique index sessions_one_active_per_group
  on public.sessions (group_id) where status <> 'done';

create table public.session_participants (
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  voted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- 빠진 이유(누가 원인인지)는 저장하지 않는다 (4-9)
create table public.candidates (
  session_id uuid not null references public.sessions (id) on delete cascade,
  food_id bigint not null references public.foods (id),
  proposed_by uuid not null references auth.users (id) on delete cascade,
  pitch text check (char_length(pitch) <= public.app_limit('PITCH_MAX')),
  vetoed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (session_id, food_id)
);

create table public.votes (
  session_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, food_id),
  foreign key (session_id, food_id)
    references public.candidates (session_id, food_id) on delete cascade
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  food_id bigint not null references public.foods (id),
  eaten_at timestamptz not null default now()
);

create index meals_group_id_idx on public.meals (group_id, eaten_at desc);

create table public.meal_participants (
  meal_id uuid not null references public.meals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (meal_id, user_id)
);
