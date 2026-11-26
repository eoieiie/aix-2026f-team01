#!/usr/bin/env python3
"""사람 정답표로 재료 태그 비교 실험 (2026-11-26, #53 11/21 Aninnom 몫).

02는 AI 두 개와 판정자의 합의(consensus.csv)를 기준 정답으로 썼다. 이 파일은 같은 직접 적은 메뉴 40개를
팀원 세 명(Aninnom, Ruty041, GONI1130)이 따로 매긴 값으로 다시 잰다. AI 결과는 정답으로 쓰지 않는다.

1) 채운 정도: 시트마다 몇 칸 찼는지 (덜 찼으면 여기서 멈춘다)
2) 두 사람씩 일치도, 그리고 다수결로 못 정하는 칸 목록 (그 칸만 같이 정해 human_decided.csv에 적는다)
3) 사람 정답 = 칸마다 두 명 이상이 같은 값(다수결) + human_decided.csv에서 정한 칸. 아직 안 정한 칸은 빼고 수를 알린다
   세 번째 시트가 없으면 두 사람이 같은 칸만 쓴다
4) 사람 정답으로 (가) 낱말 표만 (나) AI 판 1 (다) 합침 (라) 판 2 두 단계 (마) 지금 판 3 두 단계를 잰다. 발표 한 장용 표
   (마)는 (라)가 놓친 칸을 보고 프롬프트와 서버를 고친 뒤(0055) 같은 메뉴 40개로 다시 잰 값이다. 같은 자료로 고친 뒤 잰 값이라
   새 메뉴에서의 성능보다 좋게 나올 수 있다. system_v3.csv가 없으면 (마)는 내지 않는다
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
OPTIONAL = ('GONI1130', 'human_c_goni1130.csv')  # 있으면 세 명 다수결
DECIDED = 'human_decided.csv'

# 02의 계산 함수를 그대로 쓴다 (일치도, 시스템 평가가 같은 정의여야 비교가 된다)
_spec = importlib.util.spec_from_file_location('eval02', HERE / '02_ai_ingredients_eval.py')
eval02 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(eval02)
TAGS, level, by_id, agreement, systems, kappa = (
    eval02.TAGS, eval02.level, eval02.by_id, eval02.agreement, eval02.systems, eval02.kappa)
V3 = 'system_v3.csv'
V3_LABEL = '(마) 지금 판 3 두 단계'
V3_NOTE = '(마)는 (라)가 놓친 칸을 보고 고친 뒤 같은 메뉴로 다시 잰 값이다(같은 자료로 고친 뒤 잰 값). 새 메뉴에서는 더 나쁠 수 있다'
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


def cell(row, t):
    return row[t].strip() if t == NOT_MENU else level(row[t])


def majority(values):
    """두 명 이상이 같은 값. 빈칸(None)은 표로 치지 않는다. 못 정하면 None."""
    for v in set(values):
        if v is not None and values.count(v) >= 2:
            return v
    return None


def human_gold(people, decided):
    """칸마다 다수결 값, 못 정한 칸은 human_decided.csv 값. 둘 다 없으면 비우고 open에 넣는다."""
    first = people[0]
    gold, open_cells = {}, []
    for i in first:
        row = {'id': i, '메뉴 이름': first[i]['메뉴 이름']}
        for t in TAGS + [NOT_MENU]:
            values = [cell(p[i], t) for p in people]
            if t == NOT_MENU:
                values = [v or '0' for v in values]
            v = majority(values)
            if (i, t) in decided:
                row[t] = decided[(i, t)]
            elif v is not None:
                row[t] = '' if t == NOT_MENU and v == '0' else str(v)
            elif values.count(None) * 2 >= len(values):
                row[t] = ''  # 절반 이상이 비움(대표 메뉴를 모르는 가게 등): 정할 값이 없다
            else:
                row[t] = ''
                open_cells.append((i, row['메뉴 이름'], t, values))
        gold[i] = row
    return gold, open_cells


def two_level(gold, v, ids):
    """02의 (라)와 같은 정의로 한 판을 잰다: 확실 = sure_tags, 약함 = ai_tags 중 확실에 없는 것."""
    cells = []
    for i in ids:
        sure = eval02.tagset(v[i]['sure_tags'])
        weak = eval02.tagset(v[i]['ai_tags']) - sure
        for t in TAGS:
            g = level(gold[i][t])
            if g is not None:
                cells.append(eval02.judge(g, t in sure, t in weak))
    return eval02.count(cells)


def missed_cells(gold, v, ids):
    return [f"{i} {gold[i]['메뉴 이름']} {t}" for i in ids for t in TAGS
            if level(gold[i][t]) == 2 and t not in eval02.tagset(v[i]['ai_tags']) | eval02.tagset(v[i]['sure_tags'])]


def rate(n, d):
    return f'{n}/{d} ({n / d:.1%})' if d else f'{n}/0'


def main(argv):
    data = Path(argv[argv.index('--data') + 1]) if '--data' in argv else HERE / 'data'
    names = list(SHEETS) + ([OPTIONAL] if (data / OPTIONAL[1]).exists() else [])
    sheets = [(who, read(data, f)) for who, f in names]
    total = len(sheets[0][1]) * len(TAGS)

    print('== 1. 채운 정도 ==')
    for who, rows in sheets:
        print(f'{who}: {filled(rows)}/{total}칸')
    if any(filled(rows) < total for _, rows in sheets[:len(SHEETS)]):
        print('시트가 다 차면 일치도와 비교를 낸다. 0(거의 없음), 1(가게나 버전에 따라), 2(대부분 가게의 기본 레시피)')
        return
    if len(sheets) > len(SHEETS) and filled(sheets[-1][1]) < total:
        print(f'{sheets[-1][0]} 시트의 빈칸은 표 없음으로 보고 진행한다 (나머지 두 사람이 같으면 그 값, 다르면 같이 정할 칸)')
    people = [by_id(rows) for _, rows in sheets]
    for (who, _), p in zip(sheets[1:], people[1:]):
        if set(p) != set(people[0]):
            raise ValueError(f'{who} 시트의 메뉴가 다르다: {sorted(set(p) ^ set(people[0]))}')

    print(f'\n== 2. 두 사람씩 일치도 ({len(sheets)}명) ==')
    for x in range(len(sheets)):
        for y in range(x + 1, len(sheets)):
            s = agreement(sheets[x][1], sheets[y][1])[0]['전체']
            print(f"{sheets[x][0]}-{sheets[y][0]}: 칸 {s['n']}, 세 단계 일치 {s['exact']:.1%}, "
                  f"가중 카파(선형) {s['kappa_linear']:.3f}, 있다/없다 일치 {s['binary_agree']:.1%}")

    decided = {}
    if (data / DECIDED).exists():
        for r in read(data, DECIDED):
            v = r['값'].strip()
            if r['태그'].strip() != NOT_MENU:
                level(v)
            decided[(r['id'].strip(), r['태그'].strip())] = v
    gold, open_cells = human_gold(people, decided)
    rule = '두 명 이상이 같은 값' if len(sheets) >= 3 else '두 사람이 같은 값'
    print(f'\n== 3. 사람 정답 == {rule}, 같이 정한 칸 {len(decided)}, 아직 안 정한 칸 {len(open_cells)} (계산에서 뺀다)')
    if open_cells:
        print(f'못 정한 칸 (같이 정해 {DECIDED}에 id,태그,값,이유로 적는다). 값 순서: {", ".join(w for w, _ in sheets)}')
    for i, name, t, values in open_cells:
        print(f"  {i} {name} {t}: {' / '.join('빈칸' if v is None else str(v) for v in values)}")

    v1, v2 = by_id(read(data, 'system_v1.csv')), by_id(read(data, 'system_v2.csv'))
    v3 = by_id(read(data, V3)) if (data / V3).exists() else None
    real = [i for i in gold if gold[i][NOT_MENU] != '1']
    shops = [i for i in gold if gold[i][NOT_MENU] == '1' and any(level(gold[i][t]) is not None for t in TAGS)]
    for label, ids in (('메뉴 이름 입력', real), ('가게 이름 입력(대표 메뉴로 매김)', shops)):
        if not ids:
            continue
        print(f'\n== 4. 사람 정답으로 잰 직접 적은 메뉴: {label} {len(ids)}개 ==')
        print('방식                    놓친 재료(정답 2인데 표시 없음)   괜히 붙은 확실 경고(정답 0인데 확실)   약한 표시 과잉')
        rows = list(systems(gold, v1, v2, ids).items())
        if v3:
            rows.append((V3_LABEL, two_level(gold, v3, ids)))
        for name, c in rows:
            print(f"{name:20}  {rate(c['놓침'], c['정답 2 칸']):>22}   {rate(c['과잉 확실'], c['정답 0 칸']):>24}"
                  f"   {c['약한 표시 과잉']:>6}")
        print(f"(라)가 놓친 칸: {', '.join(missed_cells(gold, v2, ids)) or '없음'}")
        if v3:
            print(f"(마)가 놓친 칸: {', '.join(missed_cells(gold, v3, ids)) or '없음'}")
    if v3:
        print(V3_NOTE)
        said = [i for i in gold if v3[i]['is_menu'].strip().lower() == 'false']
        wrong = [f"{i} {gold[i]['메뉴 이름']}" for i in said if gold[i][NOT_MENU] != '1']
        print(f"(마) 메뉴 아님으로 본 것 {len(said)}개, 그중 사람 정답이 메뉴인 것: {', '.join(wrong) or '없음'}")

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
