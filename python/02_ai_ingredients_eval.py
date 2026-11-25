#!/usr/bin/env python3
"""재료 태그 AI 검증 (2026-11-25).

1) 평가자 두 명(서로 다른 AI)이 0/1/2로 매긴 표의 일치도: 세 단계 일치율, 가중 카파(선형, 제곱), 있다/없다 카파.
2) 판정자가 갈린 칸을 정한 기준 정답(consensus.csv)으로 네 방식을 잰다.
   (가) 낱말 표만 (나) 예전 AI 판 1 (다) 예전 합침 (라) 지금 판 2 두 단계
3) 기본 메뉴 40개의 확실 태그를 고치기 전과 뒤로 기준 정답과 비교한다.
기준 정답은 사람이 아니라 AI 두 개와 판정자 하나의 합의다. 사람 정답은 앱의 사람 확인 기록(ai_feedback)으로 쌓는 중이다.
표준 라이브러리만 쓰고 인터넷에 닿지 않는다.
"""
import csv
import io
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent / 'data'
TAGS = 'spicy seafood pork beef chicken wheat dairy nuts egg'.split()


def read(name):
    text = (DATA / name).read_text(encoding='utf-8-sig').replace('\r', '')
    return list(csv.DictReader(io.StringIO(text)))


def by_id(rows):
    return {r['id']: r for r in rows}


def level(v):
    v = (v or '').strip()
    if v == '':
        return None
    if v not in ('0', '1', '2'):
        raise ValueError(f'0, 1, 2가 아닌 값: {v}')
    return int(v)


def tagset(v):
    s = set((v or '').split())
    if s - set(TAGS):
        raise ValueError(f'허용하지 않은 태그: {sorted(s - set(TAGS))}')
    return s


# 일치도 ----------------------------------------------------------------------
def kappa(pairs, weight='none', k=3):
    n = len(pairs)
    if not n:
        return float('nan')
    obs = [[0] * k for _ in range(k)]
    for a, b in pairs:
        obs[a][b] += 1
    rows = [sum(obs[i]) for i in range(k)]
    cols = [sum(obs[i][j] for i in range(k)) for j in range(k)]

    def w(i, j):
        if weight == 'linear':
            return abs(i - j) / (k - 1)
        if weight == 'quadratic':
            return (i - j) ** 2 / (k - 1) ** 2
        return 0 if i == j else 1
    po = sum(w(i, j) * obs[i][j] for i in range(k) for j in range(k)) / n
    pe = sum(w(i, j) * rows[i] * cols[j] for i in range(k) for j in range(k)) / n / n
    return 1 - po / pe if pe else float('nan')


def agreement(a_rows, b_rows):
    a, b = by_id(a_rows), by_id(b_rows)
    out = {}
    every = []
    for t in TAGS + ['전체']:
        tags = TAGS if t == '전체' else [t]
        pairs = [(level(a[i][x]), level(b[i][x])) for i in a for x in tags
                 if level(a[i][x]) is not None and level(b[i][x]) is not None]
        binary = [(int(p >= 1), int(q >= 1)) for p, q in pairs]
        out[t] = {
            'n': len(pairs),
            'exact': sum(p == q for p, q in pairs) / len(pairs),
            'kappa_linear': kappa(pairs, 'linear'),
            'kappa_quadratic': kappa(pairs, 'quadratic'),
            'binary_agree': sum(p == q for p, q in binary) / len(binary),
            'kappa_binary': kappa(binary, 'none', 2),
        }
    blanks = {'A': [i for i in a if all(level(a[i][x]) is None for x in TAGS)],
              'B': [i for i in b if all(level(b[i][x]) is None for x in TAGS)]}
    return out, blanks


# 시스템 평가 ------------------------------------------------------------------
def judge(gold, sure, weak):
    """칸 하나: 정답 0/1/2와 시스템 표시(확실, 약함, 없음)."""
    shown = 'sure' if sure else ('weak' if weak else 'none')
    return gold, shown


def count(cells):
    c = {'놓침': 0, '과잉 확실': 0, '약한 표시 과잉': 0, '확실인데 가게마다(정답 1)': 0,
         '정답 2를 약하게만': 0, '정답 1을 놓침': 0, '정답 2 칸': 0, '정답 0 칸': 0, '칸': len(cells)}
    for g, s in cells:
        c['정답 2 칸'] += g == 2
        c['정답 0 칸'] += g == 0
        c['놓침'] += g == 2 and s == 'none'
        c['과잉 확실'] += g == 0 and s == 'sure'
        c['약한 표시 과잉'] += g == 0 and s == 'weak'
        c['확실인데 가게마다(정답 1)'] += g == 1 and s == 'sure'
        c['정답 2를 약하게만'] += g == 2 and s == 'weak'
        c['정답 1을 놓침'] += g == 1 and s == 'none'
    return c


def systems(gold, v1, v2, ids):
    out = {}
    plans = {
        '(가) 낱말 표만': lambda i: (tagset(v2[i]['sure_tags']), set()),
        '(나) 예전 AI 판 1': lambda i: (tagset(v1[i]['ai_tags']), set()),
        '(다) 예전 합침': lambda i: (tagset(v1[i]['merged_tags']), set()),
        '(라) 지금 판 2 두 단계': lambda i: (tagset(v2[i]['sure_tags']),
                                    tagset(v2[i]['ai_tags']) - tagset(v2[i]['sure_tags'])),
    }
    for name, f in plans.items():
        cells = []
        for i in ids:
            sure, weak = f(i)
            for t in TAGS:
                g = level(gold[i][t])
                if g is not None:
                    cells.append(judge(g, t in sure, t in weak))
        out[name] = count(cells)
    return out


def not_menu(gold, v2):
    rows = []
    for i, r in gold.items():
        if not i.startswith('M'):
            continue
        truth = r['메뉴 아님(1=아님)'].strip() == '1'
        said = v2[i]['is_menu'].strip().lower() == 'false'
        rows.append((i, r['메뉴 이름'], truth, said, v2[i]['ai_status']))
    return rows


def base_check(gold, base, label):
    cells = []
    for i, r in base.items():
        sure = tagset(r['sure_tags'])
        weak = tagset(r.get('soft_tags', ''))
        for t in TAGS:
            cells.append(judge(level(gold[i][t]), t in sure, t in weak))
    return label, count(cells)


def pct(x):
    return f'{x:.1%}'


def main():
    a, b = read('annot_a_claude.csv'), read('annot_b_gpt.csv')
    agr, blanks = agreement(a, b)
    print('== 1. 두 평가자 일치도 (평가자 A Claude, 평가자 B GPT, 둘 다 매긴 칸) ==')
    print('태그      칸   세단계일치  가중카파(선형)  가중카파(제곱)  있다없다일치  있다없다카파')
    for t, s in agr.items():
        print(f"{t:8} {s['n']:4}   {pct(s['exact']):>8}   {s['kappa_linear']:12.3f}   {s['kappa_quadratic']:12.3f}"
              f"   {pct(s['binary_agree']):>10}   {s['kappa_binary']:10.3f}")
    print(f"판단 불가로 비운 행: A {blanks['A']}, B {blanks['B']}")

    gold = by_id(read('consensus.csv'))
    v1, v2 = by_id(read('system_v1.csv')), by_id(read('system_v2.csv'))
    real = [i for i in gold if i.startswith('M') and gold[i]['메뉴 아님(1=아님)'].strip() != '1']
    shops = [i for i in gold if i.startswith('M') and gold[i]['메뉴 아님(1=아님)'].strip() == '1'
             and level(gold[i]['spicy']) is not None]
    for label, ids in (('메뉴 이름 입력', real), ('가게 이름 입력(정답은 대표 메뉴 추정)', shops)):
        print(f'\n== 2. 직접 적은 메뉴: {label} {len(ids)}개 x 태그 9 ==')
        for name, c in systems(gold, v1, v2, ids).items():
            print(f"{name}: 놓침 {c['놓침']}/{c['정답 2 칸']}, 과잉 확실 {c['과잉 확실']}/{c['정답 0 칸']}, "
                  f"약한 표시 과잉 {c['약한 표시 과잉']}, 확실인데 정답 1 {c['확실인데 가게마다(정답 1)']}, "
                  f"정답 2를 약하게만 {c['정답 2를 약하게만']}, 정답 1을 놓침 {c['정답 1을 놓침']}")
    print('\n== 3. 메뉴 아님 판단 (판 2) ==')
    nm = not_menu(gold, v2)
    tp = sum(t and s for _, _, t, s, _ in nm)
    fp = sum((not t) and s for _, _, t, s, _ in nm)
    fn = sum(t and not s for _, _, t, s, _ in nm)
    print(f'정답 메뉴 아님 {sum(t for _, _, t, _, _ in nm)}개 중 맞힘 {tp}, 놓침 {fn}, 메뉴를 메뉴 아님으로 {fp}')
    for i, n, t, s, st in nm:
        if t != s:
            print(f'  틀림 {i} {n}: 정답 {"메뉴 아님" if t else "메뉴"}, 판 2 {"메뉴 아님" if s else "메뉴"} ({st})')
    fails = [i for i in v2 if v2[i]['ai_status'] == 'failed']
    print(f'판 2 답 실패: {len(fails)}개 {fails}')

    print('\n== 4. 기본 메뉴 40개 x 태그 9 ==')
    for f, label in (('base_tags_before.csv', '고치기 전'), ('base_tags_after.csv', '고친 뒤')):
        if (DATA / f).exists():
            _, c = base_check(gold, by_id(read(f)), label)
            print(f"{label}: 놓침 {c['놓침']}/{c['정답 2 칸']}, 과잉 확실 {c['과잉 확실']}/{c['정답 0 칸']}, "
                  f"확실인데 정답 1 {c['확실인데 가게마다(정답 1)']}, 약한 표시 과잉 {c['약한 표시 과잉']}, "
                  f"정답 2를 약하게만 {c['정답 2를 약하게만']}")


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        sys.exit(f'평가하지 못했습니다: {error}')
