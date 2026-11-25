#!/usr/bin/env python3
"""사람 정답표로 재료 태그 비교 실험 (2026-11-26, #53 11/21 Aninnom 몫).

02는 AI 두 개와 판정자의 합의(consensus.csv)를 기준 정답으로 썼다. 이 파일은 같은 직접 적은 메뉴 40개를
사람 두 명(Aninnom, Ruty041)이 따로 매긴 값으로 다시 잰다. AI 결과는 정답으로 쓰지 않는다.

1) 채운 정도: 두 시트가 몇 칸 찼는지 (덜 찼으면 여기서 멈춘다)
2) 두 사람 일치도와 서로 다른 칸 목록 (다른 칸만 둘이 같이 정해 human_decided.csv에 적는다)
3) 사람 정답 = 두 사람이 같은 칸 + human_decided.csv에서 정한 칸. 아직 안 정한 칸은 빼고 수를 알린다
4) 사람 정답으로 (가) 낱말 표만 (나) AI 판 1 (다) 합침 (라) 지금 판 2 두 단계를 잰다. 발표 한 장용 표
5) AI 기준 정답(consensus.csv)이 사람 정답과 얼마나 맞는지

표준 라이브러리만 쓰고 인터넷에 닿지 않는다. 쓰는 법: python3 03_human_answer_key.py [--data 폴더]
"""
import csv
import importlib.util
import io
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHEETS = (('Aninnom', 'human_a_aninnom.csv'), ('Ruty041', 'human_b_ruty041.csv'))
DECIDED = 'human_decided.csv'

# 02의 계산 함수를 그대로 쓴다 (일치도, 시스템 평가가 같은 정의여야 비교가 된다)
_spec = importlib.util.spec_from_file_location('eval02', HERE / '02_ai_ingredients_eval.py')
eval02 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(eval02)
TAGS, level, by_id, agreement, systems, kappa = (
    eval02.TAGS, eval02.level, eval02.by_id, eval02.agreement, eval02.systems, eval02.kappa)
NOT_MENU = '메뉴 아님(1=아님)'


def read(data, name):
    text = (data / name).read_text(encoding='utf-8-sig').replace('\r', '')
    return list(csv.DictReader(io.StringIO(text)))


def filled(rows):
    """채운 칸 수. 메뉴 아님(1)이고 태그를 비운 행은 다 채운 것으로 본다(가게 이름이라 매길 메뉴가 없음)."""
    done = 0
    for r in rows:
        values = [level(r[t]) for t in TAGS]
        if r[NOT_MENU].strip() == '1' and all(v is None for v in values):
            done += len(TAGS)
        else:
            done += sum(v is not None for v in values)
    return done


def diff_cells(a, b):
    out = []
    for i in a:
        for t in TAGS + [NOT_MENU]:
            x = a[i][t].strip() if t == NOT_MENU else level(a[i][t])
            y = b[i][t].strip() if t == NOT_MENU else level(b[i][t])
            if x != y:
                out.append((i, a[i]['메뉴 이름'], t, x, y))
    return out


def human_gold(a, b, decided):
    """두 사람이 같은 칸은 그 값, 다른 칸은 human_decided.csv 값. 정하지 않은 칸은 비운다."""
    gold, open_cells = {}, []
    for i in a:
        row = {'id': i, '메뉴 이름': a[i]['메뉴 이름']}
        for t in TAGS + [NOT_MENU]:
            x, y = a[i][t].strip(), b[i][t].strip()
            if x == y:
                row[t] = x
            elif (i, t) in decided:
                row[t] = decided[(i, t)]
            else:
                row[t] = ''
                open_cells.append((i, t))
        gold[i] = row
    return gold, open_cells


def rate(n, d):
    return f'{n}/{d} ({n / d:.1%})' if d else f'{n}/0'


def main(argv):
    data = Path(argv[argv.index('--data') + 1]) if '--data' in argv else HERE / 'data'
    sheets = [(who, read(data, f)) for who, f in SHEETS]
    total = sum(len(rows) for _, rows in sheets) // len(sheets) * len(TAGS)

    print('== 1. 채운 정도 ==')
    for who, rows in sheets:
        print(f'{who}: {filled(rows)}/{total}칸')
    if any(filled(rows) < total for _, rows in sheets):
        print('두 시트가 다 차면 일치도와 비교를 낸다. 0(거의 없음), 1(가게나 버전에 따라), 2(대부분 가게의 기본 레시피)')
        return
    (_, ra), (_, rb) = sheets
    a, b = by_id(ra), by_id(rb)
    if set(a) != set(b):
        raise ValueError(f'두 시트의 메뉴가 다르다: {sorted(set(a) ^ set(b))}')

    print('\n== 2. 두 사람 일치도 ==')
    agr, _ = agreement(ra, rb)
    s = agr['전체']
    print(f"칸 {s['n']}, 세 단계 일치 {s['exact']:.1%}, 가중 카파(선형) {s['kappa_linear']:.3f}, "
          f"있다/없다 일치 {s['binary_agree']:.1%}, 있다/없다 카파 {s['kappa_binary']:.3f}")
    diffs = diff_cells(a, b)
    print(f'서로 다른 칸 {len(diffs)}개 (둘이 같이 정해 {DECIDED}에 id,태그,값,이유로 적는다)')
    for i, name, t, x, y in diffs:
        print(f'  {i} {name} {t}: Aninnom {x}, Ruty041 {y}')

    decided = {}
    if (data / DECIDED).exists():
        for r in read(data, DECIDED):
            v = r['값'].strip()
            if r['태그'] != NOT_MENU:
                level(v)
            decided[(r['id'].strip(), r['태그'].strip())] = v
    gold, open_cells = human_gold(a, b, decided)
    print(f'\n== 3. 사람 정답 == 같이 정한 칸 {len(decided)}, 아직 안 정한 칸 {len(open_cells)} (계산에서 뺀다)')

    v1, v2 = by_id(read(data, 'system_v1.csv')), by_id(read(data, 'system_v2.csv'))
    real = [i for i in gold if gold[i][NOT_MENU] != '1']
    shops = [i for i in gold if gold[i][NOT_MENU] == '1' and any(level(gold[i][t]) is not None for t in TAGS)]
    for label, ids in (('메뉴 이름 입력', real), ('가게 이름 입력(대표 메뉴로 매김)', shops)):
        if not ids:
            continue
        print(f'\n== 4. 사람 정답으로 잰 직접 적은 메뉴: {label} {len(ids)}개 ==')
        print('방식                    놓친 재료(정답 2인데 표시 없음)   괜히 붙은 확실 경고(정답 0인데 확실)   약한 표시 과잉')
        for name, c in systems(gold, v1, v2, ids).items():
            print(f"{name:20}  {rate(c['놓침'], c['정답 2 칸']):>22}   {rate(c['과잉 확실'], c['정답 0 칸']):>24}"
                  f"   {c['약한 표시 과잉']:>6}")

    consensus = by_id(read(data, 'consensus.csv'))
    pairs = [(level(gold[i][t]), level(consensus[i][t])) for i in gold for t in TAGS
             if level(gold[i][t]) is not None and level(consensus[i][t]) is not None]
    if pairs:
        same = sum(p == q for p, q in pairs)
        print(f'\n== 5. AI 기준 정답과 사람 정답 == 칸 {len(pairs)}, 세 단계 일치 {same / len(pairs):.1%}, '
              f"가중 카파(선형) {kappa(pairs, 'linear'):.3f}")


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (OSError, ValueError, KeyError) as error:
        sys.exit(f'평가하지 못했습니다: {error}')
