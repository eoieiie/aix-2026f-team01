#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""방문 확인 수수료 수익 계산 (발표 17, 27, 30장, 보고서 10.1절).

가정 값은 모두 맨 위 ASSUMPTIONS에 모았다. 바꾸고 다시 돌리면 모든 표가 따라 바뀐다.
'근거'가 있는 값은 공개 자료에서 옮긴 값이고, '가정'은 팀이 정한 시험값이다.
실행: python3 09_unit_economics.py
"""
import math

# ---------------------------------------------------------------------------
# 가정 값 (이름: (값, 구분, 설명))
ASSUMPTIONS = {
    "price_per_person": (8841, "근거", "경기 김치찌개 백반 1인분, 참가격 2026년 10월"),
    "people_per_team": (4, "가정", "대표 모임 인원"),
    "food_cost_ratio": (0.407, "근거", "외식업 식재료비 비중, 농식품부 2025년 조사(2024년 값)"),
    "other_var_cost": (2500, "가정", "추가 방문 한 팀의 식재료 외 비용(결제 수수료, 추가 인력 등)"),
    "coupon_cost": (2000, "가정", "쿠폰 혜택 한 팀당 가게 부담"),
    "fee_per_team": (500, "가정", "직원이 확인한 모임 한 팀당 방문 확인 수수료"),
    "payment_fee_rate": (0.033, "가정", "수수료를 받을 때 드는 결제 수수료 비율"),
    "subscription": (19900, "가정", "(비교용, 뒤로 미룸) 월 구독료"),
}
# 한 가게의 한 달: (이름, 직원 확인 팀 수, 그중 추가 방문 팀 수)
STORE_MONTH = [("효과 없음", 7, 0), ("본전 근처", 7, 1), ("보수 가정", 4, 2), ("기본 가정", 10, 8)]
# 캠퍼스 한 곳의 한 달: (이름, 유료 가게 수, 가게당 월 확인 팀 수)
CAMPUS_MONTH = [("수수료 전 단계(무료 시범)", 0, 0), ("보수", 5, 4), ("기본", 10, 10)]
# 여러 캠퍼스의 한 해: (이름, 캠퍼스 수, 캠퍼스당 유료 가게, 과금 개월, 가게당 월 확인 팀 수)
MULTI_YEAR = [("수수료 전 단계", 0, 0, 0, 0), ("보수", 2, 5, 4, 4), ("기본", 5, 10, 8, 10)]
# ---------------------------------------------------------------------------


def A(k):
    return ASSUMPTIONS[k][0]


def won(x):
    """마지막에만 원 단위로 반올림(사사오입)한다."""
    return int(math.floor(x + 0.5)) if x >= 0 else -int(math.floor(-x + 0.5))


def fmt(x):
    v = won(x)
    return f"{v:,}원 이익" if v >= 0 else f"{-v:,}원 손해"


def calc():
    team_sales = A("price_per_person") * A("people_per_team")
    margin = team_sales * (1 - A("food_cost_ratio")) - A("other_var_cost")  # 추가 방문 한 팀, 쿠폰 전
    after_coupon = margin - A("coupon_cost")
    per_confirmed = A("fee_per_team") + A("coupon_cost")  # 확인된 한 팀에 가게가 쓰는 돈
    new_team_net = margin - per_confirmed  # 새 손님 한 팀이 쿠폰과 수수료를 빼고 남기는 돈
    breakeven = per_confirmed / margin
    pay_fee = math.ceil(A("fee_per_team") * A("payment_fee_rate"))  # 결제 수수료는 원 단위 올림
    contrib = A("fee_per_team") - pay_fee
    return dict(team_sales=team_sales, margin=margin, after_coupon=after_coupon, per_confirmed=per_confirmed,
                new_team_net=new_team_net, breakeven=breakeven, pay_fee=pay_fee, contrib=contrib,
                fee_share=A("fee_per_team") / team_sales)


def store_profit(c, confirmed, new):
    fee_way = new * c["margin"] - confirmed * c["per_confirmed"]
    sub_way = new * c["after_coupon"] - (confirmed - new) * A("coupon_cost") - A("subscription")
    return fee_way, sub_way


def results():
    c = calc()
    base = CAMPUS_MONTH[-1]
    teams = base[1] * base[2]
    y = MULTI_YEAR[-1]
    return {
        "money.team_sales": ("한 팀 매출(4명 한 끼, 가정 포함)", f"{won(c['team_sales']):,}원"),
        "money.margin": ("새 손님 한 팀이 남기는 돈(쿠폰과 수수료 전, 가정 포함)", f"약 {won(c['margin']):,}원"),
        "money.new_net": ("새 손님 한 팀이 쿠폰과 수수료를 빼고 남기는 돈(가정 포함)", f"약 {won(c['new_team_net']):,}원"),
        "money.breakeven": ("본전 비율(확인된 팀 중 새 손님)", f"{c['breakeven'] * 100:.1f}% ({math.floor(1 / c['breakeven'])}팀 중 1팀이면 본전 넘음)"),
        "money.contrib": ("밥BTI 팀당 공헌이익", f"약 {c['contrib']}원 (결제 수수료 약 {c['pay_fee']}원)"),
        "money.month": ("월 공헌이익, 가게 10곳 × 월 10팀 (가정)", f"약 {teams * c['contrib']:,}원"),
        "money.year": ("연 수수료 매출, 기본 가정", f"{y[1] * y[2] * y[3] * y[4] * A('fee_per_team'):,}원"),
    }


def main():
    c = calc()
    print("== 가정 값 (가정은 팀이 정한 시험값이고 계약가나 실적이 아니다) ==")
    for k, (v, kind, desc) in ASSUMPTIONS.items():
        print(f"  [{kind}] {desc}: {v:,}" if isinstance(v, int) else f"  [{kind}] {desc}: {v}")
    print()
    print("== 한 팀 계산 ==")
    print(f"한 팀 매출 = {A('price_per_person'):,}원 × {A('people_per_team')}명 = {won(c['team_sales']):,}원 "
          f"(수수료 {A('fee_per_team')}원은 약 {c['fee_share'] * 100:.1f}%)")
    print(f"새 손님 한 팀이 쿠폰 전에 남기는 돈 = {won(c['team_sales']):,} × (1 - {A('food_cost_ratio')}) - "
          f"{A('other_var_cost'):,} = 약 {won(c['margin']):,}원")
    print(f"쿠폰을 준 뒤 = 약 {won(c['after_coupon']):,}원, 원래 올 손님 한 팀은 쿠폰만큼 {A('coupon_cost'):,}원 손해")
    print(f"확인된 한 팀에 가게가 쓰는 돈 = 수수료 {A('fee_per_team')} + 쿠폰 {A('coupon_cost'):,} = {c['per_confirmed']:,}원")
    print(f"새 손님 한 팀이 쿠폰과 수수료를 빼고 남기는 돈 = 약 {won(c['new_team_net']):,}원")
    print(f"본전 비율 = {c['per_confirmed']:,} ÷ {won(c['margin']):,} = {c['breakeven'] * 100:.1f}% "
          f"(7팀 중 1팀이면 {1 / 7 * 100:.1f}%)")
    print(f"밥BTI 팀당 공헌이익 = {A('fee_per_team')} - 결제 수수료 약 {c['pay_fee']}원 = 약 {c['contrib']}원")
    print()
    print("== 한 가게의 한 달 (가정) ==")
    print("경우 | 직원 확인 | 그중 새 손님 | 방문 확인 수수료 뒤 가게 추가 이익 | (비교용) 월 구독 뒤")
    for name, conf, new in STORE_MONTH:
        f, s = store_profit(c, conf, new)
        print(f"{name} | {conf}팀 | {new}팀 | {fmt(f)} | {fmt(s)}")
    print()
    print("== 캠퍼스 한 곳의 한 달 (가정) ==")
    print("경우 | 유료 가게 | 가게당 월 확인 | 수수료 매출 | 밥BTI 공헌이익 | (비교용) 월 구독 매출")
    for name, shops, teams in CAMPUS_MONTH:
        print(f"{name} | {shops}곳 | {teams}팀 | {shops * teams * A('fee_per_team'):,}원 | "
              f"약 {shops * teams * c['contrib']:,}원 | {shops * A('subscription'):,}원")
    print()
    print("== 여러 캠퍼스의 한 해 (가정, 모든 캠퍼스가 적힌 개월만큼 과금한다고 놓은 값) ==")
    print("경우 | 캠퍼스 × 가게 × 개월 | 연 확인 팀 | 연 수수료 매출 | (비교용) 월 구독 연 매출")
    for name, camp, shops, months, teams in MULTI_YEAR:
        t = camp * shops * months * teams
        print(f"{name} | {camp} × {shops} × {months} | {t:,}팀 | {t * A('fee_per_team'):,}원 | "
              f"{camp * shops * months * A('subscription'):,}원")


if __name__ == "__main__":
    main()
