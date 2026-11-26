-- 제휴 카페 (0021): 방문 후보 카페가 들어갔고 제휴로 켜졌다
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
select ok((select count(*) from public.restaurants where name in ('이삭토스트 안산한양대점','코지홀리데이','썬더커피','묵커피바','삐노누아','모모커피 안산한양대점','떼드떼 한양대점','오멜트','오얏리커피') and cuisine = 'cafe') = 9, '0020에 없던 방문 후보 카페 9곳');
select ok((select bool_and(partner) from public.restaurants where name in ('이삭토스트 안산한양대점','코지홀리데이','썬더커피','묵커피바','삐노누아','모모커피 안산한양대점','떼드떼 한양대점','오멜트','오얏리커피')), '방문 후보 카페는 제휴');
select is((select count(*)::int from public.restaurants where source_id like 'partner/%'), 0, '카카오에서 옮긴 좌표는 남지 않는다 (0022)');
select is((select count(*)::int from public.restaurants where partner and cuisine <> 'cafe'), 0, '0021은 식당 제휴를 켜지 않는다');
select * from finish();
rollback;
