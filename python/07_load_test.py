#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""동시 접속 시험 결과 표 다시 내기 (발표 14장, 보고서 5.5절, 명세 13-3).

자료: data/load_results.jsonl  실제 서버에 가상 사용자 20, 40, 80명을 넣은 시험의 원래 기록(2026-11-21~22).
      한 줄이 한 번의 시험이다. 시험을 돌린 코드는 저장소의 scripts/load-test.mjs (Node, supabase-js).
실행: python3 07_load_test.py
"""
import json
import os
import re
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "load_results.jsonl")

# 시험 이름(tag) -> 표에 쓰는 이름. 같은 인원으로 두 번 돌린 것은 1차, 2차
LABELS = {"n20": "20명 1모임 (1차)", "n20b": "20명 1모임 (2차)", "n40g1": "40명 1모임 (1차)",
          "n40g1b": "40명 1모임 (2차)", "n40g4": "40명 4모임", "n80g4": "80명 4모임"}
ORDER = ["n20", "n20b", "n40g1", "n40g1b", "n40g4", "n80g4"]
SERVER_STEPS = ["1 익명 가입", "2 프로필 이름", "3 모임 만들기", "4 초대로 들어오기(동시)", "5 판 열기",
                "7 후보 올리기", "8 투표 열기", "9 전원 동시 투표", "10 돌리기"]
STEP_RE = re.compile(r"(?:성공 )?(\d+)/(\d+)(?:, 중앙 (\d+)ms / 95% (\d+)ms / 최대 (\d+)ms)?")


def parse(s):
    m = STEP_RE.match(s)
    ok, total = int(m.group(1)), int(m.group(2))
    med, p95, mx = (int(m.group(i)) if m.group(i) else None for i in (3, 4, 5))
    return dict(ok=ok, total=total, med=med, p95=p95, max=mx)


def load():
    """시험별 마지막 기록. 가입이 한 건도 안 된(시작하지 못한) 시도는 뺀다."""
    runs = OrderedDict()
    skipped = 0
    with open(DATA, encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            steps = {k: parse(v) for k, v in r["steps"].items()}
            if steps["1 익명 가입"]["ok"] == 0:
                skipped += 1
                continue
            rt = {k: parse(v) if k != "구독" else v for k, v in r["realtime"].items()}
            runs[r["tag"]] = dict(N=r["N"], G=r["G"], steps=steps, rt=rt)
    return runs, skipped


def sec(ms):
    return "-" if ms is None else f"{ms / 1000:.1f}초"


def by_people(runs):
    """인원(20, 40, 80)별 서버 함수 성공률과 실시간 신호 받은 비율."""
    out = OrderedDict()
    for tag in ORDER:
        r = runs[tag]
        a = out.setdefault(r["N"], dict(ok=0, total=0, sub_ok=0, sub_total=0, vote_max=0, rt_ok=0, rt_total=0))
        for k in SERVER_STEPS:
            a["ok"] += r["steps"][k]["ok"]
            a["total"] += r["steps"][k]["total"]
        s6 = r["steps"]["6 판 참여+실시간 구독"]
        a["sub_ok"] += s6["ok"]
        a["sub_total"] += s6["total"]
        a["vote_max"] = max(a["vote_max"], r["steps"]["9 전원 동시 투표"]["max"])
        res = r["rt"]["결과 신호 받음"]
        a["rt_ok"] += res["ok"]
        a["rt_total"] += r["N"]
    return out


def results():
    runs, _ = load()
    agg = by_people(runs)
    fails = sum(a["total"] - a["ok"] for a in agg.values())
    out = {"load.fail": ("가상 사용자 20, 40, 80명 시험의 서버 함수 실패", f"{fails}건")}
    for n, a in agg.items():
        out[f"load.n{n}"] = (f"{n}명 시험 서버 함수 성공률과 투표 최대 시간",
                             f"{a['ok']}/{a['total']} ({a['ok'] / a['total'] * 100:.1f}%), 투표 최대 {sec(a['vote_max'])}")
    r80 = runs["n80g4"]["rt"]
    out["load.rt80"] = ("80명 4모임 실시간 신호(투표 열림, 결과)",
                        f"{r80['투표 열림 신호 받음']['ok']}/80, {r80['결과 신호 받음']['ok']}/80")
    return out


def main():
    runs, skipped = load()
    print("== 동시 접속 시험 (실제 서버, 가상 사용자) ==")
    print("시험 | 가입 | 초대로 들어오기 | 판 참여+구독 | 전원 동시 투표 | 돌리기 | 투표 열림 신호 | 결과 신호")
    for tag in ORDER:
        r = runs[tag]
        s = r["steps"]
        g, j, sub, v, sp = (s[k] for k in ("1 익명 가입", "4 초대로 들어오기(동시)", "6 판 참여+실시간 구독",
                                           "9 전원 동시 투표", "10 돌리기"))
        vo, do = r["rt"]["투표 열림 신호 받음"], r["rt"]["결과 신호 받음"]
        print(f"{LABELS[tag]} | {g['ok']}/{g['total']}, 최대 {sec(g['max'])} | {j['ok']}/{j['total']}, 중앙 {sec(j['med'])} | "
              f"{sub['ok']}/{r['N']}, 중앙 {sec(sub['med'])} | {v['ok']}/{v['total']}, 중앙 {sec(v['med'])}, 최대 {sec(v['max'])} | "
              f"{sp['max'] / 1000:.2f}초 | {vo['ok']}/{r['N']} | {do['ok']}/{r['N']}, 중앙 {sec(do['med'])}")
    print(f"(시작하지 못한 시도 {skipped}건은 표에서 뺐다)")
    print()
    print("== 인원별 합계 (같은 인원의 시험을 더함) ==")
    print("인원 | 서버 함수 성공 (가입, 이름, 모임, 들어오기, 판, 후보, 투표 열기, 투표, 돌리기) | 판 참여+구독 | 투표 최대 | 결과 신호 받음")
    for n, a in by_people(runs).items():
        print(f"{n}명 | {a['ok']}/{a['total']} ({a['ok'] / a['total'] * 100:.1f}%) | {a['sub_ok']}/{a['sub_total']} | "
              f"{sec(a['vote_max'])} | {a['rt_ok']}/{a['rt_total']} ({a['rt_ok'] / a['rt_total'] * 100:.1f}%)")
    print("앱은 실시간 신호를 놓쳐도 판 화면을 4초마다 다시 읽는다(src/hooks/use-session.ts)")


if __name__ == "__main__":
    main()
