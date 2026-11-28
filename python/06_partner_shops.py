#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""소융대 학생회 제휴 목록 조사 다시 내기 (발표 1, 17, 21, 26장, 보고서 2.3절).

자료
  data/partner_computing.csv       소융대 학생회(LINK) 공개 제휴 목록을 옮긴 표. 행마다 출처 주소와 확인일,
                                   정문에서의 직선거리(m, 지도 파일에 거리가 있는 가게만)
  data/partner_sources.csv         읽은 학생회 공지와 게시물 목록
  data/council_benefits_counts.csv 앱 서버 council_benefits 표의 단과대별 행 수(2026-11-28 읽기 전용 집계)
실행: python3 06_partner_shops.py
"""
import csv
import os
import re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
KIND_ORDER = ["밥집", "카페·디저트", "술집", "기타"]
BANDS = [100, 200, 300, 400]


def read(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def has_people_condition(cond):
    """조건 칸에 인원 수가 적혔나. '3인'처럼 숫자 바로 뒤 '인'(인분, 인당 제외) 또는 숫자 뒤 '명'."""
    return bool(re.search(r"\d+\s*인(?!분|당)", cond) or re.search(r"\d+\s*명", cond))


def compute():
    rows = read("partner_computing.csv")
    shops = [r for r in rows if r["종류"] != "이벤트"]
    events = [r for r in rows if r["종류"] == "이벤트"]
    kinds = Counter(r["종류"] for r in shops)
    in_map = [r for r in shops if r["지도_파일에_있음"] == "1"]
    dist = [int(r["정문_직선거리_m"]) for r in shops if r["정문_직선거리_m"]]
    no_dist = [r["업체명"] for r in in_map if not r["정문_직선거리_m"]]
    people = [r for r in shops if has_people_condition(r["조건"])]
    bands = []
    prev = 0
    for b in BANDS:
        bands.append((f"{prev}~{b}m", sum(prev < d <= b if prev else d <= b for d in dist)))
        prev = b
    server = read("council_benefits_counts.csv")
    shown = Counter()
    for r in server:
        if r["앱에_보임"] == "1":
            shown[r["단과대"]] += int(r["행_수"])
    return dict(rows=rows, shops=shops, events=events, kinds=kinds, in_map=in_map, dist=dist,
                no_dist=no_dist, people=people, bands=bands, shown=shown,
                sources=read("partner_sources.csv"))


def results():
    c = compute()
    d = c["dist"]
    return {
        "partner.shops": ("소융대 학생회 제휴 가게(행사 행 제외)", f"{len(c['shops'])}곳"),
        "partner.kinds": ("종류별", ", ".join(f"{k} {c['kinds'][k]}" for k in KIND_ORDER)),
        "partner.dist": ("거리 확인한 가게와 정문 직선 400m 안",
                         f"{len(d)}곳 중 {sum(x <= 400 for x in d)}곳, 가장 먼 곳 {max(d)}m"),
        "partner.people": ("조건 칸에 인원 수가 적힌 가게", f"{len(c['people'])}곳"),
        "partner.app": ("앱 결과 화면에 보이는 학생회 제휴(서버)",
                        f"소융대 {c['shown']['소프트웨어융합대학']}곳, 첨융대 {c['shown']['첨단융합대학']}곳"),
    }


def main():
    c = compute()
    shops, d = c["shops"], c["dist"]
    print("== 소융대 학생회 제휴 목록 (학생회 공개 목록을 옮긴 자료) ==")
    print(f"표의 행 {len(c['rows'])}개 = 가게 {len(shops)}곳 + 행사 {len(c['events'])}행")
    print("종류별: " + ", ".join(f"{k} {c['kinds'][k]}곳" for k in KIND_ORDER))
    print()
    print("== 정문에서의 직선거리 ==")
    print(f"지도 파일에 있는 가게 {len(c['in_map'])}곳 중 거리 숫자가 있는 곳 {len(d)}곳 "
          f"(거리 없음: {', '.join(c['no_dist'])})")
    print(f"거리 확인 {len(d)}곳 중 정문 직선 400m 안 {sum(x <= 400 for x in d)}곳, "
          f"가장 먼 곳 {max(d)}m, 가장 가까운 곳 {min(d)}m, 중앙값 {sorted(d)[len(d) // 2]}m")
    for label, n in c["bands"]:
        print(f"  {label:>9}  {n:>3}곳  " + "#" * n)
    print()
    print("== 인원 조건 ==")
    print(f"조건 칸에 인원 수가 적힌 가게 {len(c['people'])}곳 (숫자 바로 뒤 '인'(인분, 인당 제외) 또는 '명')")
    for r in c["people"][:5]:
        print(f"  {r['업체명']}: {r['조건']}")
    print(f"  ... 외 {len(c['people']) - 5}곳")
    print()
    print("== 앱 서버의 학생회 제휴 표(council_benefits, 2026-11-28 집계) ==")
    for k, v in c["shown"].most_common():
        print(f"  결과 화면에 보이는 {k} 제휴 {v}곳")
    print()
    print("== 출처 ==")
    for s in c["sources"]:
        print(f"  {s['출처']}  {s['주소']}  {s['비고']}")
    print("가게별 출처 주소와 확인일은 data/partner_computing.csv의 출처, 확인일 칸에 있다")


if __name__ == "__main__":
    main()
