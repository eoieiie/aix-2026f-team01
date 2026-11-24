-- 0025 메뉴 그림 (2026-11-21, 병주 "실사 말고 약간 그림체.. 일관된 일러스트")
-- 기본 음식 40개에 생성형 AI로 만든 그림체 일러스트를 붙인다. 결과 순간과 결과 카드에서만 크게 보인다.
-- 실사 사진, 남의 사진(지도 서비스, 블로그)은 쓰지 않는다.
-- 그림은 공개 버킷 food-images에 둔다. 쓰기 정책은 두지 않는다(팀이 대시보드나 관리 키로만 올린다).
-- foods.image_path에는 버킷 안 파일 이름만 넣는다(예: '12.webp'). 주소 앞부분은 앱이 자기 Supabase 주소로 붙인다.
-- 그래서 노트북, CI, 실제 서버가 같은 값을 쓴다. 파일이 없는 곳에서는 그림만 안 보이고 화면은 그대로다.

alter table public.foods add column if not exists image_path text;
alter table public.foods drop constraint if exists foods_image_path;
alter table public.foods add constraint foods_image_path
  check (image_path is null or (not custom and image_path ~ '^[0-9]+\.(webp|png)$'));

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    execute $q$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('food-images', 'food-images', true, 1048576, array['image/png', 'image/webp'])
      on conflict (id) do update set
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types
    $q$;
  else
    raise notice 'storage.buckets에 public 칸이 없어 food-images 버킷을 만들지 않았다';
  end if;
end;
$$;
