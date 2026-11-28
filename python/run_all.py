#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""01부터 09까지 차례로 돌리고, 발표와 보고서에 쓴 숫자를 한 표로 모아 보여 준다.

실행: python3 run_all.py            각 스크립트의 출력 전체와 마지막 숫자 표
      python3 run_all.py --summary  숫자 표만
표준 라이브러리만 쓴다. 인터넷, 계정, 키가 필요 없다. (08의 그림만 matplotlib이 있을 때 만든다)
"""
import importlib.util
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = ["01_preprocess_shops.py", "02_ai_ingredients_eval.py", "03_human_answer_key.py", "04_eval_80.py",
           "05_survey.py", "06_partner_shops.py", "07_load_test.py", "08_usage.py", "09_unit_economics.py"]

# 숫자 키 -> (발표 장, 보고서 장). 발표는 밥BTI_발표자료 v13, 보고서는 결과보고서 v7 기준
WHERE = [
    ("shops.funnel", "12장", "5.3 전처리"),
    ("shops.total", "12장", "5.2 데이터셋"),
    ("ai.kappa_ai", "10장", "6.2 완료 조건 달성 여부"),
    ("ai.kappa_human", "10장", "6.2 완료 조건 달성 여부"),
    ("ai.missed", "10장", "6.2, 8장"),
    ("ai.oversure", "10장", "6.2, 8장"),
    ("ai.new_missed", "10장", "6.2"),
    ("survey.ambiguous_4plus", "3장", "1장"),
    ("survey.time_5min", "3장, 19장", "1장"),
    ("survey.restrict_any", "3장, 8장, 19장", "1장"),
    ("survey.restrict_allergy", "8장", "-"),
    ("survey.nunchi_ate_4plus", "3장", "-"),
    ("survey.tool_unhappy", "4장", "1장"),
    ("survey.pain_wait", "4장", "1장"),
    ("survey.pain_food", "4장", "-"),
    ("survey.pain_random", "4장", "-"),
    ("survey.pain_open", "4장", "-"),
    ("partner.shops", "21장(부록 A1)", "2.3 가정과 사실"),
    ("partner.people", "21장(부록 A1)", "2.3 가정과 사실"),
    ("partner.dist", "1장, 21장, 26장", "-"),
    ("partner.kinds", "-", "-"),
    ("partner.app", "17장", "-"),
    ("load.fail", "14장", "5.5 가장 어려웠던 문제"),
    ("load.n20", "-", "5.5"),
    ("load.n40", "-", "5.5"),
    ("load.n80", "14장", "5.5"),
    ("load.rt80", "-", "-"),
    ("usage.sessions", "아직 안 씀", "아직 안 씀"),
    ("usage.people", "아직 안 씀", "아직 안 씀"),
    ("usage.custom", "아직 안 씀", "아직 안 씀"),
    ("money.team_sales", "17장, 27장 계산 바탕", "-"),
    ("money.margin", "27장(부록 A7)", "-"),
    ("money.new_net", "17장", "-"),
    ("money.breakeven", "17장, 27장", "-"),
    ("money.contrib", "17장", "-"),
    ("money.month", "17장", "-"),
    ("money.year", "17장, 30장", "-"),
]


def grab(pattern, text, flags=0):
    m = re.search(pattern, text, flags)
    return m.groups() if m else None


def from_text(outputs):
    """01~04는 출력 글에서 숫자를 읽는다."""
    out = {}
    t1 = outputs.get("01_preprocess_shops.py", "")
    g = [grab(p, t1) for p in (r"원본\s+(\d+)곳", r"정문 1\.2km 안\s+(\d+)곳", r"식사 가게만\s+(\d+)곳",
                                r"겹친 곳 빼기\s+(\d+)곳", r"식당 합계\s+(\d+)곳", r"카페 합계\s+(\d+)곳")]
    if all(g):
        v = [int(x[0]) for x in g]
        out["shops.funnel"] = ("사동 일반음식점 원본 → 1.2km 안 → 식사 가게 → 중복 제외", f"{v[0]} → {v[1]} → {v[2]} → {v[3]}곳")
        out["shops.total"] = ("정문 1.2km 안 가게 자료(식당 + 카페)", f"{v[4]} + {v[5]} = {v[4] + v[5]}곳")
    t4 = outputs.get("04_eval_80.py", "")
    a = grab(r"1차 M01~M40: 칸 (\d+), 세 단계 일치 ([\d.]+)%, 가중 카파\(선형\) ([\d.]+)", t4)
    b = grab(r"2차 M41~M80: 칸 (\d+), 세 단계 일치 ([\d.]+)%, 가중 카파\(선형\) ([\d.]+)", t4)
    if a and b:
        out["ai.kappa_ai"] = ("두 AI 평가자끼리 가중 카파(1차, 2차)", f"{a[2]} ({a[0]}칸), {b[2]} ({b[0]}칸)")
    h = grab(r"AI 기준 정답과 사람 정답: 칸 (\d+), 세 단계 일치 ([\d.]+)%, 가중 카파\(선형\) ([\d.]+)", t4)
    if h:
        out["ai.kappa_human"] = ("AI 기준 정답과 사람 정답(1차)", f"{h[0]}칸 일치 {h[1]}%, 가중 카파 {h[2]}")
    total = t4.split("합쳐서 80개", 1)[-1]
    ga = grab(r"\(가\) 낱말 표만\s+(\d+/\d+ \([\d.]+%\))\s+(\d+/\d+)", total)
    na = grab(r"\(나\) 예전 AI 판 1\s+(\d+/\d+ \([\d.]+%\))\s+(\d+/\d+)", total)
    ba = grab(r"\(바\) 낱말 표 고친 뒤\s+(\d+/\d+ \([\d.]+%\))\s+(\d+/\d+)", total)
    if ga and na and ba:
        out["ai.missed"] = ("메뉴 80개 중 메뉴 이름 68개: 놓친 재료 낱말 표만 → 지금", f"{ga[0]} → {ba[0]}")
        out["ai.oversure"] = ("같은 68개: 괜히 붙은 확실 경고 예전 AI → 지금", f"{na[1]} → {ba[1]}")
    second = t4.split("== 3. 2차 40개", 1)[-1].split("== 4.", 1)[0]
    ma = grab(r"\(마\) 판 3 두 단계\s+(\d+/\d+)", second)
    if ma:
        out["ai.new_missed"] = ("새 메뉴 34개(2차)에서 판 3이 놓친 재료", ma[0])
    return out


def from_module(name):
    spec = importlib.util.spec_from_file_location(name[:-3], os.path.join(HERE, name))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.results()


def main():
    summary_only = "--summary" in sys.argv
    outputs, failed = {}, []
    for name in SCRIPTS:
        r = subprocess.run([sys.executable, os.path.join(HERE, name)], cwd=HERE, capture_output=True, text=True)
        outputs[name] = r.stdout
        if r.returncode != 0:
            failed.append(name)
        if not summary_only:
            print("#" * 72)
            print(f"# {name}")
            print("#" * 72)
            print(r.stdout.rstrip())
            if r.returncode != 0:
                print(r.stderr.rstrip())
            print()
    nums = from_text(outputs)
    for name in SCRIPTS[4:]:
        if name not in failed:
            nums.update(from_module(name))
    print("=" * 72)
    print("발표(v13)와 보고서(v7)에 쓴 숫자, 이 폴더에서 다시 낸 값")
    print("=" * 72)
    print("숫자 | 다시 낸 값 | 낸 스크립트 | 발표 | 보고서")
    src = {"shops": "01", "ai": "03, 04", "survey": "05", "partner": "06", "load": "07", "usage": "08", "money": "09"}
    missing = []
    for key, deck, report in WHERE:
        if key not in nums:
            missing.append(key)
            continue
        label, value = nums[key]
        print(f"{label} | {value} | {src[key.split('.')[0]]} | {deck} | {report}")
    print()
    print(f"스크립트 {len(SCRIPTS)}개 중 실패 {len(failed)}개{(': ' + ', '.join(failed)) if failed else ''}, "
          f"표에 못 채운 숫자 {len(missing)}개{(': ' + ', '.join(missing)) if missing else ''}")
    print("09의 금액은 가정 값으로 계산한 것이다(가정 값은 09_unit_economics.py 맨 위)")
    sys.exit(1 if failed or missing else 0)


if __name__ == "__main__":
    main()
