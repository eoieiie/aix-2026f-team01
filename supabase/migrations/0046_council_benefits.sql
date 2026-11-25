-- 공개 학생회 공지만 옮긴다. 밥BTI 광고·쿠폰과 연결하지 않는다.
create table if not exists public.council_benefits (
  id bigint generated always as identity primary key,
  college text not null check (college in ('eng','computing','pharmacy','atc','gcc','cnc','cbe','design','sports_arts','lions','all')),
  council_name text not null,
  shop_name text,
  restaurant_id bigint references public.restaurants(id) on delete set null,
  benefit text,
  conditions text,
  period text,
  location text,
  source_url text not null check (source_url like 'https://%'),
  checked_on date not null,
  status text not null check (status in ('notice','list_only','source_only','closed')),
  source_key text not null unique,
  check ((status = 'source_only') = (shop_name is null)),
  check (status <> 'notice' or benefit is not null)
);

alter table public.council_benefits enable row level security;
revoke all on public.council_benefits from public, anon, authenticated;
grant select on public.council_benefits to authenticated;
drop policy if exists council_benefits_read on public.council_benefits;
create policy council_benefits_read on public.council_benefits for select to authenticated using (true);
create index if not exists council_benefits_college_idx on public.council_benefits(college, restaurant_id);

-- 공지에 별도 주소가 없어 원문 주소는 비워 둔다. 검토한 가게 이름과 주소가 같은 한 행만 연결한다.
with source(college,council_name,shop_name,match_name,match_address,benefit,conditions,period,source_url,checked_on,status,source_key) as (values
  ('computing','LINK','아로하','아로하','경기도 안산시 상록구 용신로 132, 1층 (사동)','커피 메뉴 10% 할인
커피 메뉴 외 다른 음료 5% 할인
(중복 불가)','(중복 불가)',null,'https://app.notion.com/p/2feafc7e0f188178a75eeee7cd525b62','2026-11-25','notice','2feafc7e0f188178a75eeee7cd525b62'),
  ('computing','LINK','오얏리커피','오얏리커피','경기도 안산시 상록구 한양대학로 70, 1층 일부 (사동)','메뉴 당 500원 할인',null,null,'https://app.notion.com/p/2feafc7e0f18817c940ac429281b2041','2026-11-25','notice','2feafc7e0f18817c940ac429281b2041'),
  ('computing','LINK','밀숲',null,null,'3인 이상 방문 시 음료 1개 제공 or 만두 1,000원 할인',null,null,'https://app.notion.com/p/2feafc7e0f1881a2b723e277533aaee2','2026-11-25','notice','2feafc7e0f1881a2b723e277533aaee2'),
  ('computing','LINK','로드락비어',null,null,'4인 이상 방문 시 음료 1개 or 생맥주 500cc 제공
4만원 이상 주문 시 포테이토 메뉴 1개 제공
(중복 불가)','(중복 불가)',null,'https://app.notion.com/p/309afc7e0f18807aab08d12a7f715422','2026-11-25','notice','309afc7e0f18807aab08d12a7f715422'),
  ('computing','LINK','에이플러스','에이플러스(A+)','경기도 안산시 상록구 성안길 78-4, 더에리카 3층 (사동)','4인 이상 방문 시 에이플러스 인스타 태그 후 스토리 올리면 소주 1병 제공
8인 이하 방문 시 주류 병당 500원씩 할인
김치찌개(소) 주문 시 라면사리 1개 제공 / 김치찌개(대) 주문 시 라면사리 무한리필
(중복 가능, 에이플러스의 다른 행사와 중복 불가, 오전 2시까지 적용, 인원 중 한 명 이상 소융대 학생이면 제휴 적용 가능)','(중복 가능, 에이플러스의 다른 행사와 중복 불가, 오전 2시까지 적용, 인원 중 한 명 이상 소융대 학생이면 제휴 적용 가능)',null,'https://app.notion.com/p/309afc7e0f1880deb497fc7053c362e5','2026-11-25','notice','309afc7e0f1880deb497fc7053c362e5'),
  ('computing','LINK','쌈앤쌈','쌈앤쌈','경기도 안산시 상록구 성안2길 5, 1층 (사동)','현금/계좌이체 시 10% 할인
4인 이상 방문 시 음료수 2개 제공
(중복 가능)','(중복 가능)',null,'https://app.notion.com/p/309afc7e0f18806ba6abfdf73f1885e7','2026-11-25','notice','309afc7e0f18806ba6abfdf73f1885e7'),
  ('computing','LINK','풍차이야기','풍차이야기','경기도 안산시 상록구 성안2길 5, 2층 (사동)','현금/계좌이체 시 10% 할인
4인 이상 방문 시 음료수 2개 제공
(중복 가능)','(중복 가능)',null,'https://app.notion.com/p/309afc7e0f188034ab67fe8cdae87b52','2026-11-25','notice','309afc7e0f188034ab67fe8cdae87b52'),
  ('computing','LINK','소담골오리마을','소담골오리마을','경기도 안산시 상록구 한양대학로 66, 1층 102,103호 (사동)','3인 이상 방문 시 음료 1개 제공',null,null,'https://app.notion.com/p/309afc7e0f188063822fe485cbef0443','2026-11-25','notice','309afc7e0f188063822fe485cbef0443'),
  ('computing','LINK','탕화쿵푸','탕화쿵푸마라탕 한양대에리카점','경기도 안산시 상록구 성안길 78-3, 1층 106,107호 (사동)','2인 이상 방문 시 음료 1개 제공 or 주류 1개 2000원 할인
12000원 이상 결제 시 꼬치 1개 제공
(중복 불가)','(중복 불가)',null,'https://app.notion.com/p/309afc7e0f188087b9fece939fd039a1','2026-11-25','notice','309afc7e0f188087b9fece939fd039a1'),
  ('computing','LINK','텐버거',null,null,'15,000원 이상 주문 시 치즈스틱(2개) or 어니언링(3개) or 오징어링(2개) 중 택1
(텐버거의 이벤트와 중복 불가, 11:00~13:00 제휴 불가)','(텐버거의 이벤트와 중복 불가, 11:00~13:00 제휴 불가)',null,'https://app.notion.com/p/309afc7e0f1880a4be4fd13aab8aa65b','2026-11-25','notice','309afc7e0f1880a4be4fd13aab8aa65b'),
  ('computing','LINK','신디도넛','신디도넛','경기도 안산시 상록구 성안1길 16, 윤준빌딩 1층 (사동)','음료+도넛 10,000원 이상 주문 시 5% 할인
음료+도넛 50,000원 이상 주문 시 7% 할인
(현금/계좌이체 시 적용)','(현금/계좌이체 시 적용)',null,'https://app.notion.com/p/309afc7e0f18803986bced38513adff5','2026-11-25','notice','309afc7e0f18803986bced38513adff5'),
  ('computing','LINK','계림원','계림원안산한양대점','경기도 안산시 상록구 성안2길 6, 1층 (사동)','세트메뉴 하나 당 주먹밥 or 계란찜 제공
통닭메뉴 하나 당 음료 1개 제공
(중복 가능)','(중복 가능)',null,'https://app.notion.com/p/309afc7e0f18805d9409eefa774ad8b4','2026-11-25','notice','309afc7e0f18805d9409eefa774ad8b4'),
  ('computing','LINK','교반육회비빔밥','교반안산상록수점','경기도 안산시 상록구 성안길 78-4, 1층 (사동)','(식사) 4인당 음료 2
(포차) 3만원 이상 주문 시 육회 1
(중복 불가)','(중복 불가)',null,'https://app.notion.com/p/2feafc7e0f18816ea01df521c201d54e','2026-11-25','notice','2feafc7e0f18816ea01df521c201d54e'),
  ('computing','LINK','도야짬뽕','도야짬뽕안산한양대점','경기도 안산시 상록구 한양대학로 70-1, 1층 일부 (사동)','인원수만큼 만두 제공',null,null,'https://app.notion.com/p/2feafc7e0f18818ba245f00e84a958cf','2026-11-25','notice','2feafc7e0f18818ba245f00e84a958cf'),
  ('computing','LINK','돼지우리','돼지우리','경기도 안산시 상록구 성안길 78-1, 1층 105~107호 (사동)','현금결제, 계좌이체 시 5% 할인
냉면 500원 할인 
(중복 가능)','(중복 가능)',null,'https://app.notion.com/p/2feafc7e0f188177be63e1cd99170e6b','2026-11-25','notice','2feafc7e0f188177be63e1cd99170e6b'),
  ('computing','LINK','이서식당',null,null,'2인 이상 방문 시 음료 1
4인 테이블당 음료2 or 주류1
(중복 불가)','(중복 불가)',null,'https://app.notion.com/p/2feafc7e0f1881028dadd0c847f19919','2026-11-25','notice','2feafc7e0f1881028dadd0c847f19919'),
  ('computing','LINK','떼드떼','떼드떼 한양대점','경기도 안산시 상록구 성안1길 17, 1층 (사동)','(여름 한정)
음료+컵빙수 주문 시 500원 할인
음료2+빙수(2인) 주문 시 1500원 할인

(2인) 음료 주문 시 500원 할인
(3인) 1000원할인 or 아메리카노 사이즈업
(4인 이상) 1500원할인 or 아메리카노 2잔 사이즈업 or 원쿠키

(중복 불가)','(중복 불가)','여름 한정','https://app.notion.com/p/2feafc7e0f1881849890e693ec2055f9','2026-11-25','notice','2feafc7e0f1881849890e693ec2055f9'),
  ('computing','LINK','91콩삼','91콩삼콩나물삼겹살&덮밥','경기도 안산시 상록구 학사4길 15-1, 1층 (사동)','4인 테이블 당 우동 or 당면사리',null,null,'https://app.notion.com/p/91-2feafc7e0f1881e08f67d4f70863ef85','2026-11-25','notice','91-2feafc7e0f1881e08f67d4f70863ef85'),
  ('computing','LINK','더치킨','더치킨','경기도 안산시 상록구 학사2길 10, 1층 (사동)','위풍당닭 or 사계천왕 or 치뽀끼 주문 시 감자튀김 서비스 제공',null,null,'https://app.notion.com/p/2feafc7e0f1881e39f68c628727b0faf','2026-11-25','notice','2feafc7e0f1881e39f68c628727b0faf'),
  ('computing','LINK','마라미방',null,null,'3-4인 테이블 당 아이스티 1 / 1만원 이상 현금 결제시 500원 할인',null,null,'https://app.notion.com/p/2feafc7e0f18817cac0ff4336b6a78ad','2026-11-25','notice','2feafc7e0f18817cac0ff4336b6a78ad'),
  ('computing','LINK','일미닭갈비','일미닭갈비 파전','경기도 안산시 상록구 학사2길 2, 2층 (사동)','3,4인 테이블 당 볶음밥 1인분 제공',null,null,'https://app.notion.com/p/2feafc7e0f18817ba187d3b1f1fccb4c','2026-11-25','notice','2feafc7e0f18817ba187d3b1f1fccb4c'),
  ('computing','LINK','정직유부',null,null,'1. 1인 1메뉴 주문 시 음료 or 디핑소스 제공
2. 3만원 이상 주문 시 작은 컵라면 증정
3. 6만원 이상 주문 시 우볶이 or 유부초밥 제공 (반반제외, 원하는 맛 1가지)',null,null,'https://app.notion.com/p/2feafc7e0f1881308a11d40d59dbbd6c','2026-11-25','notice','2feafc7e0f1881308a11d40d59dbbd6c'),
  ('computing','LINK','젤리팩토리',null,null,'4인 방문시 콜라 1캔 / 6인 이상 방문 시 콜라 2캔',null,null,'https://app.notion.com/p/2feafc7e0f1881fbad72f152371960c0','2026-11-25','notice','2feafc7e0f1881fbad72f152371960c0'),
  ('computing','LINK','달달포차',null,null,'계좌이체 시 소주/맥주 병당 500원 할인',null,null,'https://app.notion.com/p/2feafc7e0f1881ca91e4f325ab9d55d7','2026-11-25','notice','2feafc7e0f1881ca91e4f325ab9d55d7'),
  ('computing','LINK','더술(닭요리하는남자)',null,null,'2-3인 테이블당 음료수 1 or 4인이상 서비스 메뉴 제공 /  현금결제 or 계좌이체 시 10% 할인 (1번이랑 중복 적용 가능)',null,null,'https://app.notion.com/p/2feafc7e0f18811ca413c6139f16c41e','2026-11-25','notice','2feafc7e0f18811ca413c6139f16c41e'),
  ('computing','LINK','동그라미(써클)',null,null,'1. 4인이상 테이블 음료 1캔 서비스
2. 5만원 이상 현금/계좌이체 시 5% 할인 (1,2 중복 가능)',null,null,'https://app.notion.com/p/2feafc7e0f1881acb87ecc19fe9597ce','2026-11-25','notice','2feafc7e0f1881acb87ecc19fe9597ce'),
  ('computing','LINK','이스턴문','이스턴문','경기도 안산시 상록구 한양대학로 35, 3층일부 (사동)','12시-17시 인당 500원 할인 / 17시 이후 주류메뉴 4개 이상 주문시 감자칩1',null,null,'https://app.notion.com/p/2feafc7e0f18819aa569c50fb6c0afb4','2026-11-25','notice','2feafc7e0f18819aa569c50fb6c0afb4'),
  ('computing','LINK','UP플레이스(어반)',null,null,'매장 이용 시 아메리카노 500원 할인 / Take Out 시 모든 음료 500원 할인',null,null,'https://app.notion.com/p/UP-2feafc7e0f188120a909e49d6c6bc01c','2026-11-25','notice','UP-2feafc7e0f188120a909e49d6c6bc01c'),
  ('computing','LINK','삐노누아','삐노누아','경기도 안산시 상록구 학사6길 4, 1층 (사동)','테이크아웃 시 모든 음료 10% 할인 (쿠폰 적립 불가)
2. 매장 취식 시 1인 1음료+디저트 주문 시 디저트 300원 할인',null,null,'https://app.notion.com/p/2feafc7e0f1881db98cff415db8816a3','2026-11-25','notice','2feafc7e0f1881db98cff415db8816a3'),
  ('computing','LINK','샛별코인노래방',null,null,'3천원 이상 결제 시 물1',null,null,'https://app.notion.com/p/2feafc7e0f1881e7b9a2f63708719323','2026-11-25','notice','2feafc7e0f1881e7b9a2f63708719323'),
  ('computing','LINK','슈퍼스타코인노래방',null,null,'3천원 이상 결제 시 물 1 / 9곡 시 2곡 추가 or 30분 시 10분 추가',null,null,'https://app.notion.com/p/2feafc7e0f1881e1a677c61dbb5e6534','2026-11-25','notice','2feafc7e0f1881e1a677c61dbb5e6534'),
  ('computing','LINK','원조감자탕일미집','원조감자탕 일미집 안산한양대점','경기도 안산시 상록구 학사2길 6-1 (사동)','1. 2인 이상, 1인 1식사 (백반)주문 시 펩시제로 355ml 한 캔 제공
or
2. 감자탕 중짜 이상 주문 시 볶음밥 or 사리 중 택 1',null,null,'https://app.notion.com/p/316afc7e0f18805fa09ff6863dcd5ed4','2026-11-25','notice','316afc7e0f18805fa09ff6863dcd5ed4'),
  ('computing','LINK','토핑스온패티스',null,null,'2인 이상 방문 시 감자튀김 서비스 제공',null,null,'https://app.notion.com/p/316afc7e0f1880b6b921c52f43bc7bb5','2026-11-25','notice','316afc7e0f1880b6b921c52f43bc7bb5'),
  ('computing','LINK','큐 당구장',null,null,'요금 1인당 만원 이상 나왔을 시 5% 할인 적용 (모든 시간대에 적용)',null,null,'https://app.notion.com/p/316afc7e0f1880969945f3370be79081','2026-11-25','notice','316afc7e0f1880969945f3370be79081'),
  ('computing','LINK','허구헌날',null,null,'1인당 주류 15000원 이상 결제 시 나쵸 제공',null,null,'https://app.notion.com/p/316afc7e0f1880feb69df859efc54a09','2026-11-25','notice','316afc7e0f1880feb69df859efc54a09'),
  ('computing','LINK','모모커피','모모커피 안산한양대점','경기도 안산시 상록구 한양대학1길 1, 1층 (사동)','음료 5개 이상 구매 시
1. 아메리카노 s 사이즈 1개 증정
or
2. 아이스크림 토핑 증정
(아메리카노 s 사이즈와 마카롱 제외)','(아메리카노 s 사이즈와 마카롱 제외)',null,'https://app.notion.com/p/316afc7e0f1880ae8fb0c1da338fc5e1','2026-11-25','notice','316afc7e0f1880ae8fb0c1da338fc5e1'),
  ('computing','LINK','워터킹커피로스터스',null,null,'평일 12시 ~ 14시 제외 특가메뉴를 제외한 커피 및 음료 전메뉴 1잔 당 500원 할인
(포인트 적립 및 사용 불가 & 중복할인 불가)
1인당 1잔 까지만 적용 가능',null,null,'https://app.notion.com/p/316afc7e0f1880849d2cc9e2d9362d1f','2026-11-25','notice','316afc7e0f1880849d2cc9e2d9362d1f'),
  ('computing','LINK','북경반점',null,null,'테이블당 음료 한 캔',null,null,'https://app.notion.com/p/316afc7e0f1880cda048db8b1ffa1aea','2026-11-25','notice','316afc7e0f1880cda048db8b1ffa1aea'),
  ('computing','LINK','트라이뽀티','트라이뽀티','경기도 안산시 상록구 학사4길 4, 1층 일부 (사동)','1. 8000원 이상 구매 시 계좌이체/현금 으로 결제할 경우 500원 즉시 할인
2. 4잔 이상 구매 시 계좌이체/현금 으로 결제할 경우 1000원 즉시 할인',null,null,'https://app.notion.com/p/316afc7e0f18802997acc6c15a5c35b8','2026-11-25','notice','316afc7e0f18802997acc6c15a5c35b8'),
  ('computing','LINK','대홍훠궈샤브샤브','대홍훠궈샤브샤브(한양대점)','경기도 안산시 상록구 한양대학로 47, 2층 (사동)','2인 이상 무한 리필 주문 시 원하는 음료 1개 제공',null,null,'https://app.notion.com/p/316afc7e0f18802a95fbf417e997a3d7','2026-11-25','notice','316afc7e0f18802a95fbf417e997a3d7'),
  ('computing','LINK','동아리식당','동아리식당','경기도 안산시 상록구 학사2길 13, 1층 (사동)','3인 이상 방문 시 된장 or 순두부찌개 제공',null,null,'https://app.notion.com/p/316afc7e0f188050b16bc6f048590e55','2026-11-25','notice','316afc7e0f188050b16bc6f048590e55'),
  ('computing','LINK','오쏘커피','오쏘커피','경기도 안산시 상록구 한양대학로 27, 1층 (사동)','1. 테이크 아웃 시 음료 1잔 당 500원 할인
2. 매장 이용시 음료 1잔 당 500원 할인 (2번은 일요일 제외)',null,null,'https://app.notion.com/p/316afc7e0f1880b8b0e3ff752fe8c720','2026-11-25','notice','316afc7e0f1880b8b0e3ff752fe8c720'),
  ('computing','LINK','미쳐버린파닭','미쳐버린파닭','경기도 안산시 상록구 학사2길 3-3, 1층 (사동)','테이블 당 1,000원 상당의 서비스 / 테이블 당 7만원 이상 주문 시 떡볶이 1인분',null,null,'https://app.notion.com/p/2feafc7e0f1881139c5de1798f92d39f','2026-11-25','notice','2feafc7e0f1881139c5de1798f92d39f'),
  ('computing','LINK','코지홀리데이','코지홀리데이','경기도 안산시 상록구 학사2길 2-1, 1층 (사동)','1. 4인 이상 테이크 아웃 주문 시 1000원 할인
2. 음료/베이커리 (현금/계좌이체)로 결제 시 10% 할인 (1,2 중복 불가능)',null,null,'https://app.notion.com/p/316afc7e0f18802397e8e3b2888440c0','2026-11-25','notice','316afc7e0f18802397e8e3b2888440c0'),
  ('computing','LINK','앤의식탁','앤의식탁','경기도 안산시 상록구 성안길 84-1, 1층 (사동)','2인 테이블 당 음료 1개 제공',null,null,'https://app.notion.com/p/2feafc7e0f18818c8663d439f02841fd','2026-11-25','notice','2feafc7e0f18818c8663d439f02841fd'),
  ('computing','LINK','언니네화덕핏짜','언니네화덕핏짜','경기도 안산시 상록구 성안길 87, 103호 (사동)','3인 이상 테이블 당 음료 1개 제공 / 현금결제, 계좌이체 시 메뉴 당 1,000원 할인',null,null,'https://app.notion.com/p/2feafc7e0f1881b8b4badd00cda38b18','2026-11-25','notice','2feafc7e0f1881b8b4badd00cda38b18'),
  ('computing','LINK','에비수','에비수',null,'2인 테이블 당 음료 1개 제공',null,null,'https://app.notion.com/p/2feafc7e0f1881068545e8cb31675d6b','2026-11-25','notice','2feafc7e0f1881068545e8cb31675d6b'),
  ('computing','LINK','유가네닭갈비',null,null,'고기 단품 메뉴 주문 시 테이블 당 음료 1개 제공',null,null,'https://app.notion.com/p/2feafc7e0f1881b1b832f5b2bbad206b','2026-11-25','notice','2feafc7e0f1881b1b832f5b2bbad206b'),
  ('computing','LINK','육앤샤','육앤샤','경기도 안산시 상록구 성안길 84-2, 1층 105~107호 (사동)','18시 이후 소주 3,000원 / 샤브 4인분 이상 주문 시 육회비빔밥 or 샤브 1 제공',null,null,'https://app.notion.com/p/2feafc7e0f1881cd94f4ebcde3d83be0','2026-11-25','notice','2feafc7e0f1881cd94f4ebcde3d83be0'),
  ('computing','LINK','이삭토스트','이삭토스트 안산한양대점','경기도 안산시 상록구 한양대학로 48, 1층 101호 (사동)','세트 주문 시 1,000원 할인',null,null,'https://app.notion.com/p/2feafc7e0f1881168d0ac559e0e91f54','2026-11-25','notice','2feafc7e0f1881168d0ac559e0e91f54'),
  ('computing','LINK','참새방앗간','참새방앗간','경기도 안산시 상록구 한양대학로 48, 3층 일부호 (사동)','3인분 이상 주문 시 사리 1종류 추가 가능',null,null,'https://app.notion.com/p/2feafc7e0f1881aeb025f084c109738a','2026-11-25','notice','2feafc7e0f1881aeb025f084c109738a'),
  ('computing','LINK','탐나는바지락손칼국수','탐나는바지락손칼국수','경기도 안산시 상록구 성안2길 19, 1층 (사동)','현금결제, 계좌이체 시 10% 할인',null,null,'https://app.notion.com/p/2feafc7e0f18816e978dec6e624b0584','2026-11-25','notice','2feafc7e0f18816e978dec6e624b0584'),
  ('computing','LINK','페퍼로니버튼',null,null,'사이즈 상관없이 피자 한 판 당 음료 1개 or 플레인프라이 제공',null,null,'https://app.notion.com/p/2feafc7e0f188199a8deca7b2d1c0a44','2026-11-25','notice','2feafc7e0f188199a8deca7b2d1c0a44'),
  ('computing','LINK','행컵',null,null,'10만원 이상 단체 주문 시 개당 1,000원 할인 및 배달 / 만원 이상 현금결제, 계좌이체 시 토핑1 or 음료1개 제공 (매장 이벤트 중복 가능)',null,null,'https://app.notion.com/p/2feafc7e0f188167a66fca731497a97f','2026-11-25','notice','2feafc7e0f188167a66fca731497a97f'),
  ('computing','LINK','만취',null,null,'4인 테이블 당 샤베트 1회 제공/ 2인 테이블당 음료 1개 제공',null,null,'https://app.notion.com/p/2feafc7e0f1881b28eb7c258108a3ddf','2026-11-25','notice','2feafc7e0f1881b28eb7c258108a3ddf'),
  ('computing','LINK','역전할머니맥주',null,null,'3인 이상 방문 시 탄산음료 1개 제공',null,null,'https://app.notion.com/p/2feafc7e0f1881e5b879c67aeb0fdbc1','2026-11-25','notice','2feafc7e0f1881e5b879c67aeb0fdbc1'),
  ('computing','LINK','묵커피바','묵커피바','경기도 안산시 상록구 성안1길 25, 1층 (사동)','15,000원 이상 주문 시 10% 할인 (중복 가능, 주말 불가) / 주문제작 홀 케이크 2,000원 할인',null,null,'https://app.notion.com/p/2feafc7e0f18812ab46bf43ec8ab33a7','2026-11-25','notice','2feafc7e0f18812ab46bf43ec8ab33a7'),
  ('computing','LINK','시저커피','시저커피','경기도 안산시 상록구 한양대학로 38, 2층 (사동)','음료 주문 시 인당 500원 할인',null,null,'https://app.notion.com/p/2feafc7e0f1881c2921af39e05a60c49','2026-11-25','notice','2feafc7e0f1881c2921af39e05a60c49'),
  ('computing','LINK','코이노커피','코이노커피','경기도 안산시 상록구 성안2길 15, 정도빌딩 1층 일부 (사동)','1인 1음료 주문 시 음료 한잔 당 500원 할인',null,null,'https://app.notion.com/p/2feafc7e0f1881beba41d06a70c16dce','2026-11-25','notice','2feafc7e0f1881beba41d06a70c16dce'),
  ('computing','LINK','버텍스',null,null,'추가 메뉴 1회 한정 무료 제공 (닭고기, 새우, 야채, 볶음밥 제외)',null,null,'https://app.notion.com/p/309afc7e0f1880d4a3c6c51f3be3853a','2026-11-25','notice','309afc7e0f1880d4a3c6c51f3be3853a'),
  ('computing','LINK','오타코','오타코','경기도 안산시 상록구 성안길 84-2, 유원빌딩 2층 201호 (사동)','2인 테이블당 음료 제공 (2,000원)',null,null,'https://app.notion.com/p/309afc7e0f1880df8df4fa1963661f82','2026-11-25','notice','309afc7e0f1880df8df4fa1963661f82'),
  ('computing','LINK','조박사 부대찌개','조박사부대찌개','경기도 안산시 상록구 성안길 97-1, 1층 (사동)','2인 이상 방문 시 음료 1개 제공',null,null,'https://app.notion.com/p/309afc7e0f188014958be66b42b3734d','2026-11-25','notice','309afc7e0f188014958be66b42b3734d'),
  ('computing','LINK','파익스피크소다',null,null,'4인 테이블당 오늘의 음료 1잔 제공 (타코/햄버거로 1인 1메뉴 주문 시) ',null,null,'https://app.notion.com/p/309afc7e0f188034866dd074a58ed224','2026-11-25','notice','309afc7e0f188034866dd074a58ed224'),
  ('computing','LINK','홍당무',null,null,'3인 이상 방문 시 음료 1개 제공',null,null,'https://app.notion.com/p/309afc7e0f18805babc6f54c03594194','2026-11-25','notice','309afc7e0f18805babc6f54c03594194'),
  ('computing','LINK','코운즈','코운즈','경기도 안산시 상록구 성안2길 16, 1층 (사동)','2인 테이블당 음료 1개 제공',null,null,'https://app.notion.com/p/309afc7e0f1880469744df32b35d41ad','2026-11-25','notice','309afc7e0f1880469744df32b35d41ad'),
  ('computing','LINK','락',null,null,'소주(참이슬, 처음처럼, 진로, 새로) 무제한 1,000원 할인 (일행 전원 소융대 소속 학생일 시)',null,null,'https://app.notion.com/p/309afc7e0f18804bae50f66e2612d8a6','2026-11-25','notice','309afc7e0f18804bae50f66e2612d8a6'),
  ('computing','LINK','썬더 커피','썬더커피','경기도 안산시 상록구 성안길 91, 1층 (사동)','음료 4잔 주문 시 아메리카노(벤티) 한 잔 제공 (더치페이 가능)',null,null,'https://app.notion.com/p/309afc7e0f18801a8636f549ba8576d9','2026-11-25','notice','309afc7e0f18801a8636f549ba8576d9'),
  ('computing','LINK','브리드복싱',null,null,'3개월 또는 3개월 이상 가입 시 이벤트가에서 2만원 추가 할인
+ 사물함, 티셔츠 이용권 무료제공 -> 총 4만원 상당 할인
(단, 최초 가입자에 한해서 적용, 가입 당시 미리 소프트웨어융합대학 학생임을 인증해야 함.)','(단, 최초 가입자에 한해서 적용, 가입 당시 미리 소프트웨어융합대학 학생임을 인증해야 함.)',null,'https://app.notion.com/p/316afc7e0f1880c68d90d14d98390665','2026-11-25','notice','316afc7e0f1880c68d90d14d98390665'),
  ('computing','LINK','레드버튼',null,null,'식음료 전체 결제금액 10% 할인',null,null,'https://app.notion.com/p/354afc7e0f1880d3b51cded9bc7c54eb','2026-11-25','notice','354afc7e0f1880d3b51cded9bc7c54eb'),
  ('atc','SOAR','기찬고기',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-2'),
  ('atc','SOAR','이서식당',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-3'),
  ('atc','SOAR','교반','교반안산상록수점','경기도 안산시 상록구 성안길 78-4, 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-4'),
  ('atc','SOAR','탕화쿵푸마라탕','탕화쿵푸마라탕 한양대에리카점','경기도 안산시 상록구 성안길 78-3, 1층 106,107호 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-5'),
  ('atc','SOAR','보배반점',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-6'),
  ('atc','SOAR','도야짬뽕','도야짬뽕안산한양대점','경기도 안산시 상록구 한양대학로 70-1, 1층 일부 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-7'),
  ('atc','SOAR','페퍼로니버튼',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-8'),
  ('atc','SOAR','참새방앗간','참새방앗간','경기도 안산시 상록구 한양대학로 48, 3층 일부호 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-9'),
  ('atc','SOAR','육앤샤','육앤샤','경기도 안산시 상록구 성안길 84-2, 1층 105~107호 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-10'),
  ('atc','SOAR','동양솥밥',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-11'),
  ('atc','SOAR','유가네 닭갈비',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-12'),
  ('atc','SOAR','이삭토스트','이삭토스트 안산한양대점','경기도 안산시 상록구 한양대학로 48, 1층 101호 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-13'),
  ('atc','SOAR','양식당',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-14'),
  ('atc','SOAR','앤의 식탁','앤의식탁','경기도 안산시 상록구 성안길 84-1, 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-15'),
  ('atc','SOAR','언니네화덕핏짜','언니네화덕핏짜','경기도 안산시 상록구 성안길 87, 103호 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-16'),
  ('atc','SOAR','버텍스',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-17'),
  ('atc','SOAR','예산닭갈비감자탕','예산닭갈비.감자탕','경기도 안산시 상록구 한양대학로 30, 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-18'),
  ('atc','SOAR','신선샤브&칼국수','신선샤브&칼국수','경기도 안산시 상록구 성안1길 20, 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-19'),
  ('atc','SOAR','미쳐버린 파닭','미쳐버린파닭','경기도 안산시 상록구 학사2길 3-3, 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-20'),
  ('atc','SOAR','정직유부',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-21'),
  ('atc','SOAR','더치킨','더치킨','경기도 안산시 상록구 학사2길 10, 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-22'),
  ('atc','SOAR','핵밥',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-23'),
  ('atc','SOAR','원조감자탕일미집','원조감자탕 일미집 안산한양대점','경기도 안산시 상록구 학사2길 6-1 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-24'),
  ('atc','SOAR','일미닭갈비파전','일미닭갈비 파전','경기도 안산시 상록구 학사2길 2, 2층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-25'),
  ('atc','SOAR','동아리 식당','동아리식당','경기도 안산시 상록구 학사2길 13, 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-26'),
  ('atc','SOAR','헤브론 카페',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-27'),
  ('atc','SOAR','신디도넛','신디도넛','경기도 안산시 상록구 성안1길 16, 윤준빌딩 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-28'),
  ('atc','SOAR','코이노 커피','코이노커피','경기도 안산시 상록구 성안2길 15, 정도빌딩 1층 일부 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-29'),
  ('atc','SOAR','시저커피','시저커피','경기도 안산시 상록구 한양대학로 38, 2층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-30'),
  ('atc','SOAR','묵커피바','묵커피바','경기도 안산시 상록구 성안1길 25, 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-31'),
  ('atc','SOAR','썬더커피','썬더커피','경기도 안산시 상록구 성안길 91, 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-32'),
  ('atc','SOAR','오멜트','오멜트','경기도 안산시 상록구 한양대학로 18, 2층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-33'),
  ('atc','SOAR','UP플레이스',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-34'),
  ('atc','SOAR','이스턴문','이스턴문','경기도 안산시 상록구 한양대학로 35, 3층일부 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-35'),
  ('atc','SOAR','카페 디캔바스','카페 디캔바스','경기도 안산시 상록구 용신로 209, 금호빌딩 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-36'),
  ('atc','SOAR','로드락비어',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-37'),
  ('atc','SOAR','에이플러스','에이플러스(A+)','경기도 안산시 상록구 성안길 78-4, 더에리카 3층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-38'),
  ('atc','SOAR','만취',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-39'),
  ('atc','SOAR','역전할머니맥주',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-40'),
  ('atc','SOAR','달달포차',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-41'),
  ('atc','SOAR','써클',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-42'),
  ('atc','SOAR','더술',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-43'),
  ('atc','SOAR','한양사',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-44'),
  ('atc','SOAR','슈퍼스타코인노래연습장',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-45'),
  ('atc','SOAR','샛별코인노래연습장',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-46'),
  ('atc','SOAR','코지 홀리데이','코지홀리데이','경기도 안산시 상록구 학사2길 2-1, 1층 (사동)',null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-47'),
  ('atc','SOAR','홍성 마라미방',null,null,null,null,null,'https://mammoth-antimatter-89c.notion.site/2f4bb93eff2380dbbd90e90cf8f6e306','2026-11-19','list_only','atc-48'),
  ('all','총학생회','YBM',null,null,null,null,null,'https://www.instagram.com/p/Dfdol9ugSaG/','2026-11-19','list_only','all-4'),
  ('all','총학생회','롯데렌터카 G car',null,null,null,null,null,'https://www.instagram.com/p/DfMAA_IAc2R/','2026-11-19','list_only','all-5'),
  ('all','총학생회','두찜 안산한대앞역점',null,null,null,null,null,'https://www.instagram.com/p/De-85W4AX7a/','2026-11-19','list_only','all-6'),
  ('all','총학생회','딥무드 파티룸',null,null,null,null,null,'https://www.instagram.com/p/De-6SERATto/','2026-11-19','list_only','all-7'),
  ('all','총학생회','YBM',null,null,null,null,null,'https://www.instagram.com/p/De8X7lrgYek/','2026-11-19','list_only','all-8'),
  ('all','총학생회','캣툰',null,null,null,null,null,'https://www.instagram.com/p/DeI4GDSAd_H/','2026-11-19','list_only','all-9'),
  ('all','총학생회','술찌',null,null,null,null,null,'https://www.instagram.com/p/DeGURWiAaqX/','2026-11-19','list_only','all-10'),
  ('all','총학생회','YBM',null,null,null,null,null,'https://www.instagram.com/p/DdknxjHgajn/','2026-11-19','list_only','all-11'),
  ('all','총학생회','용가회전훠궈 안산점',null,null,null,null,null,'https://www.instagram.com/p/DdQVZ57ERHP/','2026-11-19','list_only','all-12'),
  ('all','총학생회','베스트검진센터',null,null,null,null,null,'https://www.instagram.com/p/Dc5DcwWEfKZ/','2026-11-19','list_only','all-13'),
  ('all','총학생회','렛유인',null,null,null,null,null,'https://www.instagram.com/p/Dcu99fOEXfZ/','2026-11-19','list_only','all-14'),
  ('all','총학생회','에이톤헤어 상록수점',null,null,null,null,null,'https://www.instagram.com/p/DamzPr_jBnx/','2026-11-19','list_only','all-15'),
  ('all','총학생회','YBM',null,null,null,null,null,'https://www.instagram.com/p/DacHyhHkUsS/','2026-11-19','list_only','all-16'),
  ('all','총학생회','수상레저',null,null,null,null,null,'https://www.instagram.com/p/DaUTDfLgUzf/','2026-11-19','list_only','all-17'),
  ('all','총학생회','베스트검진센터',null,null,null,null,null,'https://www.instagram.com/p/DaUQBrVAZeo/','2026-11-19','list_only','all-18'),
  ('all','총학생회','마인드로직',null,null,null,null,null,'https://www.instagram.com/p/DaO5MKwAWop/','2026-11-19','list_only','all-19'),
  ('all','총학생회','팔레트 페스티벌',null,null,null,null,null,'https://www.instagram.com/p/DaFlLsQAdIf/','2026-11-19','list_only','all-20'),
  ('all','총학생회','AICE Learning',null,null,null,null,null,'https://www.instagram.com/p/DZ6glH-kemb/','2026-11-19','list_only','all-21'),
  ('all','총학생회','에버랜드',null,null,null,null,null,'https://www.instagram.com/p/DZZI5PkRaxW/','2026-11-19','list_only','all-22'),
  ('all','총학생회','에버랜드',null,null,null,null,null,'https://www.instagram.com/p/DZWeHylEa8S/','2026-11-19','list_only','all-23'),
  ('all','총학생회','베지밀',null,null,null,null,null,'https://www.instagram.com/p/DZT7LAPkX-u/','2026-11-19','list_only','all-24'),
  ('all','총학생회','북유니버스',null,null,null,null,null,'https://www.instagram.com/p/DZL8kSBgR6-/','2026-11-19','list_only','all-25'),
  ('all','총학생회','이마트 안산고잔점',null,null,null,null,null,'https://www.instagram.com/p/DYBe55jkcMu/','2026-11-19','list_only','all-26'),
  ('all','총학생회','YBM',null,null,null,null,null,'https://www.instagram.com/p/DXv1_v1EXX4/','2026-11-19','list_only','all-27'),
  ('all','총학생회','고려스파랜드',null,null,null,null,null,'https://www.instagram.com/p/DXqS-FPkS6_/','2026-11-19','list_only','all-28'),
  ('all','총학생회','산들산들',null,null,null,null,null,'https://www.instagram.com/p/DXVhElQgRwU/','2026-11-19','list_only','all-29'),
  ('all','총학생회','형제들 감자탕',null,null,null,null,null,'https://www.instagram.com/p/DXJFgMeEW56/','2026-11-19','list_only','all-30'),
  ('all','총학생회','데드레빗 안산고잔점',null,null,null,null,null,'https://www.instagram.com/p/DXJFVAKkfxI/','2026-11-19','list_only','all-31'),
  ('all','총학생회','롯데시네마',null,null,null,null,null,'https://www.instagram.com/p/DW0T40xEavN/','2026-11-19','list_only','all-32'),
  ('all','총학생회','준오헤어 안산중앙 2호점',null,null,null,null,null,'https://www.instagram.com/p/DW0CLWNgXkb/','2026-11-19','list_only','all-33'),
  ('all','총학생회','백금당',null,null,null,null,null,'https://www.instagram.com/p/DW0BwXxgTry/','2026-11-19','list_only','all-34'),
  ('all','총학생회','YBM',null,null,null,null,null,'https://www.instagram.com/p/DWfvkhSkSyd/','2026-11-19','list_only','all-35'),
  ('all','총학생회','봄날의서재 안산중앙역점',null,null,null,null,null,'https://www.instagram.com/p/DWFrBfpAeHa/','2026-11-19','list_only','all-36'),
  ('all','총학생회','젠젠 안산중앙점',null,null,null,null,null,'https://www.instagram.com/p/DWFq_HKAWMc/','2026-11-19','list_only','all-37'),
  ('all','총학생회','한양베이커리',null,null,null,null,null,'https://www.instagram.com/p/DWFq-OOAXSp/','2026-11-19','list_only','all-38'),
  ('all','총학생회','딥다이브',null,null,null,null,null,'https://www.instagram.com/p/DWFq9bBAVfn/','2026-11-19','list_only','all-39'),
  ('all','총학생회','멜커피 안산중앙점',null,null,null,null,null,'https://www.instagram.com/p/DWFq8auAZnG/','2026-11-19','list_only','all-40'),
  ('all','총학생회','파스타리안',null,null,null,null,null,'https://www.instagram.com/p/DWDYTtzEfoX/','2026-11-19','list_only','all-41'),
  ('all','총학생회','대동집',null,null,null,null,null,'https://www.instagram.com/p/DWDX_hkkf0u/','2026-11-19','list_only','all-42'),
  ('all','총학생회','카사 데 타코',null,null,null,null,null,'https://www.instagram.com/p/DWDXq29EUDo/','2026-11-19','list_only','all-43'),
  ('all','총학생회','오복당',null,null,null,null,null,'https://www.instagram.com/p/DWDXco0Ecg7/','2026-11-19','list_only','all-44'),
  ('all','총학생회','뽁식당',null,null,null,null,null,'https://www.instagram.com/p/DWDXPyYESk4/','2026-11-19','list_only','all-45'),
  ('all','총학생회','통영집',null,null,null,null,null,'https://www.instagram.com/p/DWDW8R2kTp0/','2026-11-19','list_only','all-46'),
  ('all','총학생회','속눈썹전문 리반타 안산점',null,null,null,null,null,'https://www.instagram.com/p/DWBMq3REeu1/','2026-11-19','list_only','all-47'),
  ('atc','첨단융합대학 SOAR',null,null,null,null,null,null,'https://linktr.ee/soar_hyu','2026-11-19','source_only','source-2'),
  ('eng','공학대학 학생회 아름',null,null,null,null,null,null,'https://www.instagram.com/hyu_erica_eng/','2026-11-19','source_only','source-3'),
  ('lions','LIONS칼리지 학생회 EAR:US',null,null,null,null,null,null,'https://www.instagram.com/hyu_lions/','2026-11-19','source_only','source-4'),
  ('eng','스마트융합공학부 YOUS',null,null,null,null,null,null,'https://www.instagram.com/hyu_erica_sce/','2026-11-19','source_only','source-5'),
  ('cbe','경상대학 학생회 이음',null,null,null,null,null,null,'https://www.facebook.com/erica.gyeongsang','2026-11-19','source_only','source-6')
)
insert into public.council_benefits(college,council_name,shop_name,restaurant_id,benefit,conditions,period,source_url,checked_on,status,source_key)
select s.college,s.council_name,s.shop_name,r.id,s.benefit,s.conditions,s.period,s.source_url,s.checked_on::date,s.status,s.source_key
from source s
left join lateral (
  select min(r.id) as id from public.restaurants r
  where r.area = 'erica' and r.name = s.match_name and r.address is not distinct from s.match_address
  having count(*) = 1
) r on true
on conflict (source_key) do update set
  college = excluded.college, council_name = excluded.council_name, shop_name = excluded.shop_name,
  restaurant_id = excluded.restaurant_id, benefit = excluded.benefit, conditions = excluded.conditions,
  period = excluded.period, source_url = excluded.source_url, checked_on = excluded.checked_on, status = excluded.status;

notify pgrst, 'reload schema';
