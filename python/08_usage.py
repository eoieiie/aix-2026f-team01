#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""실제 사용 합계 표와 그림 (운영 서버 읽기 전용 집계, scripts/usage-stats.sql 기준).

자료 (모두 합계만, 개인을 알아볼 수 있는 칸 없음)
  data/usage_summary.csv       모임, 판, 식사 기록, 사람 수 합계
  data/usage_daily.csv         날짜별 연 판과 끝난 판 (연 판과 끝난 판이 5 미만인 날은 이어진 날과 묶음)
  data/usage_group_size.csv    식사 기록 한 건에 함께 먹은 인원 (5 미만인 칸은 묶음)
  data/usage_cuisine.csv       룰렛으로 뽑힌 음식 종류 (5 미만인 칸은 묶음)
  data/usage_candidates.csv    후보로 올린 기본 메뉴와 직접 적은 메뉴
빼는 것: 동네가 'zz'로 시작하는 시험 모임, 시연 자료 모임과 시연 계정(usage-stats.sql과 같음)
실행: python3 08_usage.py   (matplotlib이 있으면 out/usage.png도 만든다. 없으면 글자 그림만)
"""
import csv
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT = os.path.join(HERE, "out")


def read(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def summary():
    return {r["항목"]: r["값"] for r in read("usage_summary.csv")}


def results():
    s = summary()
    cand = {r["후보_종류"]: r for r in read("usage_candidates.csv")}
    c = cand["직접 적은 메뉴"]
    return {
        "usage.sessions": (f"실제 사용: 연 판과 끝난 판 ({s['기간']}, {s['뽑은 시각(한국)']} 기준)",
                           f"판을 연 모임 {s['판을 연 모임']}, 연 판 {s['연 판']}, 끝난 판 {s['끝난 판']}"),
        "usage.people": ("실제 사용: 판에 들어온 사람, 끼니당 인원", f"{s['판에 들어온 사람']}명, 평균 {s['끼니당 인원 평균']}명"),
        "usage.custom": ("실제 사용: 직접 적은 메뉴 후보", f"{c['후보로_올린_횟수']}번, 서로 다른 메뉴 {c['서로_다른_메뉴_수']}개"),
    }


def bar(n, scale=1):
    return "#" * max(1, round(n / scale)) if n else ""


def main():
    s = summary()
    print(f"== 실제 사용 합계 ({s['기간']}, {s['뽑은 시각(한국)']} 기준, 운영 서버 읽기 전용) ==")
    for k, v in s.items():
        if k not in ("기간", "뽑은 시각(한국)"):
            print(f"  {k:<12} {v}")
    print()
    daily = read("usage_daily.csv")
    print("== 날짜별 판 수 (연 판 #, 끝난 판 숫자) ==")
    for r in daily:
        span = r["시작일"][5:] if r["시작일"] == r["끝일"] else f"{r['시작일'][5:]}~{r['끝일'][5:]}"
        print(f"  {span:<12} 연 판 {int(r['연_판']):>3}  끝난 판 {int(r['끝난_판']):>3}  {bar(int(r['연_판']))}")
    print()
    for name, title, key, val in [("usage_group_size.csv", "식사 한 건의 인원", "끼니_인원", "식사_기록"),
                                  ("usage_cuisine.csv", "룰렛으로 뽑힌 음식 종류", "음식_종류", "뽑힌_식사"),
                                  ("usage_candidates.csv", "후보로 올린 메뉴", "후보_종류", "후보로_올린_횟수")]:
        rows = read(name)
        total = sum(int(r[val]) for r in rows)
        scale = max(1, max(int(r[val]) for r in rows) / 40)
        print(f"== {title} (합계 {total}) ==")
        for r in rows:
            n = int(r[val])
            extra = f", 서로 다른 메뉴 {r['서로_다른_메뉴_수']}개" if "서로_다른_메뉴_수" in r else ""
            print(f"  {r[key]:<16} {n:>4} ({n / total * 100:4.1f}%){extra}  {bar(n, scale)}")
        print()
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib이 없어 그림 파일은 만들지 않았다(위 글자 그림이 같은 내용이다)")
        return
    for fam in ("AppleGothic", "Malgun Gothic", "NanumGothic"):
        plt.rcParams["font.family"] = fam
        break
    fig, axes = plt.subplots(1, 3, figsize=(13, 4))
    labels = [r["시작일"][5:] if r["시작일"] == r["끝일"] else f"{r['시작일'][5:]}~{r['끝일'][5:]}" for r in daily]
    axes[0].bar(labels, [int(r["연_판"]) for r in daily], color="#d9d9d9", label="연 판")
    axes[0].bar(labels, [int(r["끝난_판"]) for r in daily], color="#ff7a00", label="끝난 판")
    axes[0].set_title("날짜별 판 수")
    axes[0].tick_params(axis="x", rotation=45)
    axes[0].legend()
    g = read("usage_group_size.csv")
    axes[1].bar([r["끼니_인원"] for r in g], [int(r["식사_기록"]) for r in g], color="#ff7a00")
    axes[1].set_title("식사 한 건의 인원")
    cz = read("usage_cuisine.csv")
    axes[2].bar([r["음식_종류"] for r in cz], [int(r["뽑힌_식사"]) for r in cz], color="#ff7a00")
    axes[2].set_title("뽑힌 음식 종류")
    fig.tight_layout()
    os.makedirs(OUT, exist_ok=True)
    fig.savefig(os.path.join(OUT, "usage.png"), dpi=150)
    print("그림: out/usage.png")


if __name__ == "__main__":
    main()
