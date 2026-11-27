#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""사전 수요 설문 78명의 비율 다시 내기 (발표 3, 4, 8장, 보고서 1장).

자료: data/survey_summary.csv (docs/survey-result.md 2절의 문항별 응답 수와 분모)
실행: python3 05_survey.py
"""
import csv
import os
from decimal import Decimal, ROUND_HALF_UP

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "survey_summary.csv")


def pct(n, d):
    """백분율을 소수 첫째 자리에서 반올림(사사오입)한다."""
    return float((Decimal(n) * 100 / Decimal(d)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def load():
    with open(DATA, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def results():
    """run_all.py가 쓰는 값. 키 -> (설명, 값 문자열)."""
    out = {}
    for r in load():
        n, d = int(r["응답수"]), int(r["분모"])
        out["survey." + r["key"]] = (r["문항"], f"{n}/{d}명 ({pct(n, d):.1f}%)")
    return out


def main():
    rows = load()
    print("== 사전 수요 설문 (2026-10-27 ~ 10-28, 응답 78명) ==")
    print(f"{'문항':<44} {'응답':>4} {'분모':>4} {'다시 낸 비율':>10} {'문서 비율':>8}  같음")
    same = 0
    checked = 0
    for r in rows:
        n, d = int(r["응답수"]), int(r["분모"])
        p = pct(n, d)
        doc = r["문서_비율"]
        mark = ""
        if doc:
            checked += 1
            ok = abs(float(doc) - p) < 1e-9
            same += ok
            mark = "O" if ok else "X"
        print(f"{r['문항']:<44} {n:>4} {d:>4} {p:>9.1f}% {(doc + '%') if doc else '-':>8}  {mark}")
    print(f"문서에 비율이 적힌 {checked}개 중 {same}개가 다시 낸 값과 같다")
    print("복수 응답 문항은 합이 분모를 넘을 수 있다. 기존 도구 불편 4가지의 분모는 써 본 61명이다")


if __name__ == "__main__":
    main()
