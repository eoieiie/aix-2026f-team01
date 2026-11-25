begin;
select plan(9);
select has_table('public', 'council_benefits');
select ok(not has_table_privilege('anon', 'public.council_benefits', 'SELECT'), '로그인 전에는 읽지 못한다');
select ok(has_table_privilege('authenticated', 'public.council_benefits', 'SELECT'), '로그인하면 읽을 수 있다');
select ok(not has_table_privilege('authenticated', 'public.council_benefits', 'INSERT'), '추가할 수 없다');
select ok(not has_table_privilege('authenticated', 'public.council_benefits', 'UPDATE'), '고칠 수 없다');
select ok(not has_table_privilege('authenticated', 'public.council_benefits', 'DELETE'), '지울 수 없다');
select ok((select relrowsecurity from pg_class where oid = 'public.council_benefits'::regclass), '행 보안이 켜져 있다');
insert into public.council_benefits (college,council_name,shop_name,source_url,checked_on,status,source_key)
values ('computing','시험','zz_council_가게','https://example.com',current_date,'list_only','zz_council_가게');
set local role authenticated;
select is((select count(*) from public.council_benefits where source_key = 'zz_council_가게'), 1::bigint, '소속이나 가게 연결 없이도 목록을 읽을 수 있다');
reset role;
select is((select restaurant_id from public.council_benefits where source_key = 'zz_council_가게'), null::bigint, '맞추지 못한 가게를 연결하지 않는다');
select * from finish();
rollback;
