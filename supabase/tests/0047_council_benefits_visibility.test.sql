begin;
select plan(4);
select is((select count(*) from public.council_benefits where college = 'computing' and show_in_app), 64::bigint, '소융대 식음료 혜택만 보인다');
select is((select count(*) from public.council_benefits where college = 'atc' and show_in_app), 44::bigint, '첨융대 식음료 혜택만 보인다');
select is((select count(*) from public.council_benefits where college not in ('computing','atc') and show_in_app), 0::bigint, '나머지 출처 및 확인되지 않은 행은 숨긴다');
select is((select count(*) from public.council_benefits where status in ('closed','source_only') and show_in_app), 0::bigint, '폐업이나 출처만 있는 행을 가게처럼 보이지 않는다');
select * from finish();
rollback;
