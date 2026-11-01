-- 명세 5절 실시간 구독: 판 화면이 구독하는 표는 들어 있고, 표(votes)는 빠져 있다 (4-11 익명).
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select set_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  array['sessions', 'session_participants', 'candidates'],
  '판 화면이 구독하는 세 표가 실시간 구독에 들어 있다'
);

select is(
  (select count(*)::int from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'votes'),
  0,
  '표는 실시간 구독에 없다. 지운 표의 기본 키(누가 무엇을)가 다른 사람에게 가지 않는다'
);

select * from finish();
rollback;
