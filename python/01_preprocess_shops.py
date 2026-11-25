#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""학교 앞 가게 데이터 전처리 (밥BTI 명세 4-21 식당, 4-23 카페).

공공데이터(행정안전부 인허가 자료)와 오픈스트리트맵 원본에서
한양대 ERICA 정문 1.2km 안의 식당과 카페를 골라, 제출용 표를 만들고 앱 서버의 별도 추출본과 대조한다.

실행:  python3 01_preprocess_shops.py      (표준 라이브러리만 쓴다. 인터넷이 없어도 된다)
결과:  out/restaurants.csv, out/cafes.csv 와 단계마다 남은 가게 수
설명:  README.md
"""
import csv
import json
import math
import os
import re
from collections import Counter
from statistics import median

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT = os.path.join(HERE, "out")

# 정문. 오픈스트리트맵의 "한대정문사거리" 신호등과 "한양대정문" 정류장 옆 (마이그레이션 0018, area_gate)
GATE = (37.2998, 126.8369)
RADIUS_M = 1200


# ---------------------------------------------------------------------------
# 1. 좌표 변환: EPSG:5174 (Bessel 1841, 중부원점 TM) → WGS84 (위도, 경도)
#    공공데이터의 좌표정보(X), 좌표정보(Y)는 미터 단위 평면 좌표라 그대로는 거리를 잴 수 없다.
# ---------------------------------------------------------------------------
BESSEL_A = 6377397.155            # Bessel 1841 타원체 긴반지름(m)
BESSEL_F = 1 / 299.1528128        # 편평률
TM_LAT0 = math.radians(38.0)      # 중부원점 위도
TM_LON0 = math.radians(127.0028902777778)  # 중부원점 경도 (127도 + 10.405초)
TM_FALSE_E, TM_FALSE_N = 200000.0, 500000.0
# Bessel → WGS84 7변수 (EPSG:5174 towgs84): 이동 3개(m), 회전 3개(초), 축척 1개(ppm)
TOWGS84 = (-115.80, 474.99, 674.11, 1.16, -2.31, -1.63, 6.43)
WGS84_A = 6378137.0
WGS84_F = 1 / 298.257223563


def _meridian_arc(phi, a, e2):
    """적도에서 위도 phi까지 자오선 길이."""
    return a * (
        (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
        - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * phi)
        + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * phi)
        - (35 * e2 ** 3 / 3072) * math.sin(6 * phi)
    )


def tm_to_wgs84(x, y):
    """중부원점 TM 좌표(x 동쪽, y 북쪽, m)를 WGS84 (위도, 경도)로 바꾼다.

    1) TM 역변환으로 Bessel 타원체의 위도, 경도를 구한다.
    2) 위도, 경도를 지구 중심 직교 좌표(X, Y, Z)로 바꾼다.
    3) 7변수로 WGS84 직교 좌표로 옮긴다.
    4) 다시 위도, 경도로 바꾼다.
    """
    a, f = BESSEL_A, BESSEL_F
    e2 = 2 * f - f * f
    ep2 = e2 / (1 - e2)

    # 1) TM 역변환
    m = _meridian_arc(TM_LAT0, a, e2) + (y - TM_FALSE_N)
    mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
        + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
        + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
        + (1097 * e1 ** 4 / 512) * math.sin(8 * mu)
    )
    c1 = ep2 * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = a / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    r1 = a * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = (x - TM_FALSE_E) / n1
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d * d / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6 / 720
    )
    lon = TM_LON0 + (
        d
        - (1 + 2 * t1 + c1) * d ** 3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5 / 120
    ) / math.cos(phi1)

    # 2) Bessel 위경도 → 직교 좌표
    n = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
    px = n * math.cos(lat) * math.cos(lon)
    py = n * math.cos(lat) * math.sin(lon)
    pz = n * (1 - e2) * math.sin(lat)

    # 3) 7변수 변환
    tx, ty, tz, rx_s, ry_s, rz_s, ppm = TOWGS84
    rx, ry, rz = (math.radians(s / 3600) for s in (rx_s, ry_s, rz_s))
    k = 1 + ppm * 1e-6
    qx = tx + k * (px - rz * py + ry * pz)
    qy = ty + k * (rz * px + py - rx * pz)
    qz = tz + k * (-ry * px + rx * py + pz)

    # 4) 직교 좌표 → WGS84 위경도 (되풀이 계산)
    we2 = 2 * WGS84_F - WGS84_F ** 2
    p = math.hypot(qx, qy)
    wlat = math.atan2(qz, p * (1 - we2))
    for _ in range(6):
        wn = WGS84_A / math.sqrt(1 - we2 * math.sin(wlat) ** 2)
        wlat = math.atan2(qz + we2 * wn * math.sin(wlat), p)
    return math.degrees(wlat), math.degrees(math.atan2(qy, qx))


def haversine_m(lat1, lng1, lat2, lng2):
    """두 점 사이 직선거리(m). 서버 walk_minutes(0016)와 같은 식."""
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def walk_minutes(distance_m):
    """정문에서 걸어서 몇 분. 직선거리 × 1.3 ÷ 분당 80m, 올림 (서버 0016과 같다)."""
    return max(1, math.ceil(distance_m * 1.3 / 80))


# ---------------------------------------------------------------------------
# 2. 원본 읽기
# ---------------------------------------------------------------------------
def read_csv(name):
    with open(os.path.join(DATA, name), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def read_json(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


def locate(rows):
    """좌표가 있는 줄에 위도, 경도, 정문까지 거리를 붙인다. 좌표가 빈 줄은 따로 돌려준다."""
    placed, missing = [], []
    for r in rows:
        x, y = r["좌표정보(X)"].strip(), r["좌표정보(Y)"].strip()
        if not x or not y:
            missing.append(r)
            continue
        lat, lng = tm_to_wgs84(float(x), float(y))
        placed.append(dict(r, lat=round(lat, 7), lng=round(lng, 7), dist=haversine_m(GATE[0], GATE[1], lat, lng)))
    return placed, missing


def osm_points(name):
    """오픈스트리트맵 추출 파일에서 이름이 있는 곳만 읽는다."""
    out = []
    for e in read_json(name)["elements"]:
        tags = e.get("tags", {})
        shop_name = tags.get("name:ko") or tags.get("name")
        if not shop_name:
            continue
        lat = e.get("lat") or e["center"]["lat"]
        lng = e.get("lon") or e["center"]["lon"]
        out.append({
            "source_id": "%s/%s" % (e["type"], e["id"]), "name": shop_name, "tags": tags,
            "lat": lat, "lng": lng, "dist": haversine_m(GATE[0], GATE[1], lat, lng),
        })
    return out


# ---------------------------------------------------------------------------
# 3. 식당 거르기
# ---------------------------------------------------------------------------
def is_meal_place(row):
    """식사하는 가게인지. 공공데이터의 업태 칸으로 거른다."""
    category, name = row["업태구분명"], row["사업장명"]
    if category in ("기타", "정종/대포집/소주방"):   # 카페 등, 술집. 카페는 4번에서 따로 고른다
        return False
    if category == "호프/통닭" and not re.search("닭|치킨", name):   # 호프는 치킨집만 남긴다
        return False
    return True


def _norm(name):
    return re.sub(r"[\s()\[\]·.,_-]", "", name.lower())


def _first_word(name):
    return _norm(re.split(r"[\s(]", name.strip())[0])


def same_shop(name_a, name_b, first_word=False):
    """두 원본의 이름이 같은 가게를 가리키는지.

    한쪽 이름이 다른 쪽에 통째로 들어 있으면 같은 가게로 본다("남월 한양대점" ⊃ "남월").
    first_word=True면 괄호와 띄어쓰기 앞의 첫 낱말이 다른 쪽에 들어 있어도 같은 가게로 본다
    ("밀플랜비(MEAL PLAN B)"와 "밀플랜비 한양대에리카점"). 카페는 첫 낱말이 "카페"인 곳이 많아 쓰지 않는다.
    """
    a, b = _norm(name_a), _norm(name_b)
    if a in b or b in a:
        return True
    if not first_word:
        return False
    fa, fb = _first_word(name_a), _first_word(name_b)
    return bool(fa and fa in b) or bool(fb and fb in a)


# 업태 → 앱의 음식 종류 (foods.cuisine과 같은 값)
CUISINE_BY_CATEGORY = {
    "한식": "korean", "분식": "korean", "식육(숯불구이)": "korean", "탕류(보신용)": "korean",
    "냉면집": "korean", "횟집": "korean",
    "중국식": "chinese",
    "일식": "japanese",
    "경양식": "western", "패밀리레스트랑": "western", "패스트푸드": "western",
    "호프/통닭": "western", "통닭(치킨)": "western",
    "외국음식전문점(인도,태국등)": "asian",
}
# 가게 이름에 든 낱말 → 기본 음식 이름. 기본 음식 이름이 그대로 들어 있는 경우는 따로 본다
MENU_ALIASES = [("스시", "초밥"), ("버거", "햄버거"), ("파스타", "토마토 파스타"), ("마라", "마라탕"), ("국밥", "돼지국밥")]
# 업태로 흔한 메뉴
MENUS_BY_CATEGORY = {
    "중국식": ["짜장면", "짬뽕", "탕수육"],
    "분식": ["떡볶이", "김밥", "라면"],
    "호프/통닭": ["치킨"], "통닭(치킨)": ["치킨"],
    "냉면집": ["물냉면"],
}


def guess_menus(name, category, default_foods):
    """대표 메뉴를 짐작한다. 공공데이터에는 메뉴가 없다.

    순서: 가게 이름에 든 기본 음식 이름 → 이름에 든 낱말(별칭) → 업태로 흔한 메뉴. 겹치면 한 번만.
    예: "예산닭갈비.감자탕" → 닭갈비, 감자탕 / 분식 "엄지꼬마김밥" → 김밥, 떡볶이, 라면
    """
    menus = [food for food in default_foods if food in name]
    for word, food in MENU_ALIASES:
        if word in name and food not in menus:
            menus.append(food)
    for food in MENUS_BY_CATEGORY.get(category, []):
        if food not in menus:
            menus.append(food)
    return menus


# 오픈스트리트맵 cuisine 태그 → (종류, 대표 메뉴) (0015)
OSM_CUISINE = {
    "korean": ("korean", []), "chinese": ("chinese", []), "japanese": ("japanese", []),
    "italian": ("western", ["피자"]), "international": ("western", []), "mexican": ("western", []),
    "chicken": ("western", ["치킨"]), "vietnamese": ("asian", ["쌀국수"]), "indian": ("asian", ["인도 커리"]),
}


def build_restaurants(general, default_foods):
    print("[식당] 공공데이터 일반음식점 (안산시 상록구 사동)")
    print("  원본                          %4d곳" % len(general))
    open_rows = [r for r in general if r["영업상태명"] == "영업/정상"]
    print("  영업 중만                     %4d곳" % len(open_rows))
    placed, missing = locate(open_rows)
    print("  좌표가 있는 곳                %4d곳  (좌표 없음 %d곳: %s)" % (
        len(placed), len(missing), ", ".join(r["사업장명"] for r in missing)))
    near = [r for r in placed if r["dist"] <= RADIUS_M]
    print("  정문 %.1fkm 안                 %4d곳" % (RADIUS_M / 1000, len(near)))
    meal = [r for r in near if is_meal_place(r)]
    dropped = Counter(r["업태구분명"] for r in near if not is_meal_place(r))
    print("  식사 가게만                   %4d곳  (뺀 것: 기타 %d, 술집 %d, 치킨집이 아닌 호프 %d)" % (
        len(meal), dropped["기타"], dropped["정종/대포집/소주방"], dropped["호프/통닭"]))

    osm_all = osm_points("osm_restaurants.json")
    osm, seen = [], set()
    for o in osm_all:                       # 같은 가게가 두 번 그려진 곳은 한 번만 (상록한정식)
        if o["dist"] <= RADIUS_M and _norm(o["name"]) not in seen:
            seen.add(_norm(o["name"]))
            osm.append(o)
    print("[식당] 오픈스트리트맵               %4d곳  (추출 %d곳, 같은 이름 한 번만)" % (len(osm), len(osm_all)))

    overlap = [(r, o) for r in meal for o in osm if same_shop(r["사업장명"], o["name"], first_word=True)]
    overlap_ids = {r["관리번호"] for r, _ in overlap}
    public = [r for r in meal if r["관리번호"] not in overlap_ids]
    print("  오픈스트리트맵과 겹친 곳 빼기 %4d곳  (겹친 곳 %d)" % (len(public), len(overlap_ids)))

    # 좌표 변환 확인: 두 원본에 다 있는 가게의 위치가 얼마나 가까운가
    gaps = sorted(min(haversine_m(r["lat"], r["lng"], o["lat"], o["lng"]) for rr, o in overlap if rr is r)
                  for r in {id(r): r for r, _ in overlap}.values())
    close = [g for g in gaps if g <= 10]
    if gaps:
        print("  좌표 변환 확인: 겹친 %d곳 중 %d곳이 오픈스트리트맵 위치와 10m 안 (중앙값 %.1fm)" % (
            len(gaps), len(close), median(gaps)))

    out = []
    for r in public:
        category = r["업태구분명"]
        out.append({
            "source_id": "localdata/" + r["관리번호"], "name": r["사업장명"],
            "cuisine": CUISINE_BY_CATEGORY.get(category, ""),
            "menus": guess_menus(r["사업장명"], category, default_foods),
            "lat": r["lat"], "lng": r["lng"], "distance_m": round(r["dist"]), "walk_min": walk_minutes(r["dist"]),
            "category": category, "source": "공공데이터 일반음식점",
        })
    for o in osm:
        cuisine, menus = OSM_CUISINE.get(o["tags"].get("cuisine"), ("", []))
        out.append({
            "source_id": o["source_id"], "name": o["name"], "cuisine": cuisine, "menus": list(menus),
            "lat": o["lat"], "lng": o["lng"], "distance_m": round(o["dist"]), "walk_min": walk_minutes(o["dist"]),
            "category": "", "source": "오픈스트리트맵",
        })

    kinds = Counter(x["cuisine"] or "모름" for x in out if x["source"] != "오픈스트리트맵")
    with_menu = sum(1 for x in out if x["source"] != "오픈스트리트맵" and x["menus"])
    print("[식당] 종류와 대표 메뉴 채우기")
    print("  공공데이터 %d곳의 종류: %s" % (len(public), ", ".join("%s %d" % kv for kv in kinds.most_common())))
    print("  대표 메뉴를 짐작한 곳 %d곳, 종류로만 맞는 곳 %d곳" % (with_menu, len(public) - with_menu))
    print("  식당 합계                     %4d곳  (공공데이터 %d + 오픈스트리트맵 %d)" % (len(out), len(public), len(osm)))
    return sorted(out, key=lambda x: (x["distance_m"], x["source_id"]))


# ---------------------------------------------------------------------------
# 4. 카페 고르기
# ---------------------------------------------------------------------------
CAFE_WORDS = re.compile(
    "커피|카페|까페|cafe|coffee|도넛|디저트|베이커리|제과|빵|tea|스위트|와플|빙수|쿠키|케이크|로스터|티하우스", re.I)
# 팀이 방문하기로 한 카페(0021). 공공데이터 등록 이름이 가게가 쓰는 이름과 달라 낱말로 찾는다
VISIT_WORDS = {
    "신디도넛": ["신디"], "코지홀리데이": ["코지"], "썬더커피": ["썬더", "thunder"], "이삭토스트": ["이삭"],
    "묵커피바": ["묵커피", "묵 커피"], "시저커피": ["시저"], "코이노커피": ["코이노"], "삐노누아": ["삐노", "pinot"],
    "오쏘커피": ["오쏘", "osso"], "아로하": ["아로하"], "모모커피": ["모모커피", "momo"],
    "트라이뽀티": ["트라이뽀티", "tribo"], "이스턴문": ["이스턴", "eastern"], "레이지그라운드": ["레이지", "lazy"],
    "디캔바스": ["디캔바스", "캔바스"], "오멜트": ["오멜트"], "오얏리커피": ["오얏리"],
}
# 방문 카페 가운데 일반음식점 원본에 없는 9곳. 휴게음식점(104), 제과점(121) 원본의 관리번호와 가게가 쓰는 이름 (0021, 0022)
VISIT_CAFE_IDS = {
    "5550000-104-2004-00011": "이삭토스트 안산한양대점", "5550000-104-2013-00057": "코지홀리데이",
    "5550000-104-2018-00036": "썬더커피", "5550000-104-2021-00119": "묵커피바",
    "5550000-104-2013-00062": "삐노누아", "5550000-104-2016-00111": "모모커피 안산한양대점",
    "5550000-104-2013-00098": "떼드떼 한양대점", "5550000-121-2024-00002": "오멜트",
    "5550000-104-2020-00087": "오얏리커피",
}
# 공공 자료에 좌표가 빈 곳. 공공 자료의 도로명주소를 오픈스트리트맵 Nominatim으로 찾은 건물 좌표 (0022)
MANUAL_COORDS = {"5550000-104-2013-00057": (37.2995787, 126.8385624)}   # 코지홀리데이, 학사2길 2-1
# 일반음식점 등록 이름 → 가게가 쓰는 이름 (0021)
DISPLAY_NAMES = {
    "5550000-101-2022-00103": "신디도넛", "5550000-101-2018-00173": "레이지그라운드",
    "5550000-101-2022-00117": "트라이뽀티", "5550000-101-2020-00297": "이스턴문",
    "5550000-101-2011-00238": "오쏘커피", "5550000-101-2021-00168": "코이노커피",
    "5550000-101-2005-00466": "시저커피", "5550000-101-2022-00158": "카페 디캔바스",
}


def visit_cafe(name):
    low = name.lower()
    for cafe, words in VISIT_WORDS.items():
        if any(w in low for w in words):
            return cafe
    return None


def is_cafe_row(row):
    """일반음식점 원본에서 카페인 줄. 업태가 기타나 라이브카페이고 이름에 카페 낱말이 있거나, 방문 카페."""
    category, name = row["업태구분명"], row["사업장명"]
    visit = visit_cafe(name)
    if category in ("기타", "라이브카페") and (CAFE_WORDS.search(name) or visit):
        return True
    return visit is not None and category != "정종/대포집/소주방"


def cafe_row(source_id, name, registered, lat, lng, source, visit):
    d = haversine_m(GATE[0], GATE[1], lat, lng)
    return {"source_id": source_id, "name": name, "registered_name": registered, "lat": lat, "lng": lng,
            "distance_m": round(d), "walk_min": walk_minutes(d), "source": source, "visit": 1 if visit else 0}


def build_cafes(general, default_foods):
    out = []
    # (가) 일반음식점 원본에서
    placed, _ = locate([r for r in general if r["영업상태명"] == "영업/정상" and is_cafe_row(r)])
    near = [r for r in placed if r["dist"] <= RADIUS_M]
    # 이름에 기본 음식 이름이 든 곳은 식당 칸과 섞이지 않게 뺀다
    picked = [r for r in near if not any(food in r["사업장명"] for food in default_foods)]
    for r in picked:
        out.append(cafe_row("localdata/" + r["관리번호"], DISPLAY_NAMES.get(r["관리번호"], r["사업장명"]),
                            r["사업장명"], r["lat"], r["lng"], "공공데이터 일반음식점", visit_cafe(r["사업장명"])))
    print("[카페] 공공데이터 일반음식점에서    %4d곳  (업태 기타, 라이브카페 중 카페 이름과 방문 카페, 정문 %.1fkm 안)" % (
        len(picked), RADIUS_M / 1000))

    # (나) 방문 카페 9곳: 휴게음식점, 제과점 원본에서 관리번호로 찾는다
    licensed = read_csv("rest_cafes_sangnok.csv") + read_csv("bakeries_sangnok.csv")
    open_licensed = [r for r in licensed if r["영업상태명"] == "영업/정상"]
    by_id = {r["관리번호"]: r for r in open_licensed}
    found = 0
    for number, display in VISIT_CAFE_IDS.items():
        r = by_id.get(number)
        if r is None:
            print("  영업 중 자료에서 못 찾음: %s %s" % (number, display))
            continue
        if number in MANUAL_COORDS:
            lat, lng = MANUAL_COORDS[number]
        else:
            lat, lng = (round(v, 7) for v in tm_to_wgs84(float(r["좌표정보(X)"]), float(r["좌표정보(Y)"])))
        if haversine_m(*GATE, lat, lng) > RADIUS_M:
            continue
        out.append(cafe_row("localdata/" + number, display, r["사업장명"], lat, lng, "공공데이터 휴게음식점, 제과점", True))
        found += 1
    print("[카페] 공공데이터 휴게음식점, 제과점 %3d곳  (상록구 %d곳 중 영업 중 %d곳에서 방문 카페를 관리번호로 찾음)" % (
        found, len(licensed), len(open_licensed)))

    # (다) 오픈스트리트맵 카페, 아이스크림, 빵집 가운데 이름이 있는 곳
    osm_all = osm_points("osm_cafes.json")
    osm = [o for o in osm_all
           if o["dist"] <= RADIUS_M
           and not any(same_shop(o["name"], c["name"]) for c in out)          # 위에서 이미 넣은 가게 (떼드떼)
           and not any(food in o["name"] for food in default_foods)
           and "할인점" not in o["name"]]                                      # 과자 할인점은 카페가 아니다
    for o in osm:
        out.append(cafe_row(o["source_id"], o["name"], o["name"], o["lat"], o["lng"], "오픈스트리트맵", False))
    print("[카페] 오픈스트리트맵               %4d곳  (이름 있는 %d곳에서 겹친 곳과 할인점 빼기)" % (len(osm), len(osm_all)))
    print("  카페 합계                     %4d곳" % len(out))

    # 참고: 아직 넣지 않은 카페 후보 (다음 할 일)
    placed, _ = locate(open_licensed)
    near_all = [r for r in placed if r["dist"] <= RADIUS_M]
    coffee = [r for r in near_all if r["업태구분명"] in ("커피숍", "다방")]
    print("  참고: 정문 %.1fkm 안에 영업 중인 휴게음식점과 제과점은 %d곳(그중 커피숍·다방 %d곳)이다. 이 경로에서는 방문 후보 카페 %d곳만 골랐다" % (
        RADIUS_M / 1000, len(near_all), len(coffee), found))
    return sorted(out, key=lambda x: (x["distance_m"], x["source_id"]))


# ---------------------------------------------------------------------------
# 5. 서버에 들어간 것과 대조
# ---------------------------------------------------------------------------
def compare_with_server(restaurants, cafes, general):
    """data/server_shops.csv(2026-11-25 서버 restaurants 표)와 한 줄씩 대조한다."""
    server = {r["source_id"]: r for r in read_csv("server_shops.csv")}
    mine = {x["source_id"]: x for x in restaurants + cafes}
    raw_ids = {"localdata/" + r["관리번호"] for r in general}
    print("[대조] 서버 restaurants 표 %d곳 (식당 %d, 카페 %d) / 이 코드 %d곳 (식당 %d, 카페 %d)" % (
        len(server), sum(1 for r in server.values() if r["cuisine"] != "cafe"),
        sum(1 for r in server.values() if r["cuisine"] == "cafe"),
        len(mine), len(restaurants), len(cafes)))

    same = 0
    diffs = []
    for sid, x in mine.items():
        s = server.get(sid)
        if s is None:
            diffs.append("서버에 없음: %s (%s)" % (x["name"], sid))
            continue
        is_cafe = "registered_name" in x
        want = (s["name"], s["cuisine"], s["menus"])
        got = (x["name"], "cafe" if is_cafe else x["cuisine"], "" if is_cafe else "|".join(x["menus"]))
        moved = haversine_m(float(s["lat"]), float(s["lng"]), x["lat"], x["lng"])
        if want == got and moved < 0.5:
            same += 1
        else:
            diffs.append("값이 다름: %s  서버 %s / 이 코드 %s%s" % (
                x["name"], want[1:], got[1:], "" if moved < 0.5 else "  위치 차이 %.1fm" % moved))
    for sid, s in server.items():
        if sid not in mine:
            why = "11/25 일반음식점 영업 중 추출본에 없다. 빠진 이유는 확인하지 못했다" if sid not in raw_ids and sid.startswith(
                "localdata/5550000-101") else "이 코드의 규칙으로는 고르지 않았다"
            diffs.append("이 코드에 없음: %s (%s)  %s" % (s["name"], sid, why))
    print("  이름, 종류, 대표 메뉴가 같고 위치 차이가 0.5m 미만인 곳 %d곳 / 다른 곳 %d곳" % (same, len(diffs)))
    for line in diffs:
        print("   - " + line)
    return same, len(diffs)


# ---------------------------------------------------------------------------
# 6. 내보내기
# ---------------------------------------------------------------------------
def write_csv(name, rows, columns):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(columns)
        for r in rows:
            w.writerow(["|".join(r[c]) if isinstance(r[c], list) else r[c] for c in columns])
    print("  out/%s  %d줄" % (name, len(rows)))


def main():
    general = read_csv("general_restaurants_sadong.csv")
    default_foods = [r["name"] for r in read_csv("default_foods.csv")]

    restaurants = build_restaurants(general, default_foods)
    cafes = build_cafes(general, default_foods)
    compare_with_server(restaurants, cafes, general)

    print("[내보내기]")
    write_csv("restaurants.csv", restaurants, [
        "source_id", "name", "cuisine", "menus", "lat", "lng", "distance_m", "walk_min",
        "category", "source"])
    write_csv("cafes.csv", cafes, [
        "source_id", "name", "registered_name", "lat", "lng", "distance_m", "walk_min", "source", "visit"])


if __name__ == "__main__":
    main()
