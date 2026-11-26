#!/usr/bin/env python3
"""사람 정답표 80개로 재료 태그 비교 실험 (2026-11-26, 검증 규모 두 배).

03은 1차 메뉴 40개(M01~M40)만 잰다. 이 파일은 03을 고치지 않고, 2차 메뉴 40개(M41~M80)를 더해 80개로 03과 같은 표를 낸다.
2차 메뉴는 1차와 같은 비율(서버에 실제로 들어온 직접 적은 입력 10개 중 메뉴 아님 6개, 외국 음식 13개, 숨은 재료 한식 11개,
식단 판단 6개)로 골랐고 1차와 겹치지 않는다.

- 사람 시트: 1차 human_*.csv, 2차 human2_*.csv (같은 세 사람, 같은 모양). 다수결로 못 정한 칸은 1차 human_decided.csv,
  2차 human2_decided.csv
- 시스템 답: 1차 system_v1~v3.csv, 2차 system2_v1~v3.csv
  2차의 판 3은 운영 서버에 시험 계정으로 다시 올려 받은 답이다. 판 1과 판 2는 git 기록의 프롬프트와 응답 모양, 모델 순서를
  그대로 써서 Gemini에 직접 물은 값이다(서버 저장 규칙은 0023, 0044를 따라 걸렀다). 1차의 판 1, 판 2는 그때 서버 값이다
  2차의 낱말 표(확실 sure_tags, 약함 soft_tags)는 지금 서버(0045 뒤) 값이다. 앱처럼 soft_tags도 약한 표시로 센다
- AI 기준 정답: 1차 consensus.csv, 2차 consensus2.csv (--consensus2 경로로 바꿀 수 있다)

2차 사람 시트(앞 두 사람)가 덜 찼으면 1차 결과(03)만 내고 채운 칸 수를 알린 뒤 멈춘다.
(마) 판 3은 1차에서 (라)가 놓친 칸을 보고 고친 판이라 1차 줄은 같은 자료로 고친 뒤 잰 값이다. 2차 줄이 새 메뉴에서 잰 값이다.

표준 라이브러리만 쓰고 인터넷에 닿지 않는다. 쓰는 법: python3 04_human_answer_key_80.py [--data 폴더] [--consensus2 파일]
"""
import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


key03 = load('key03', '03_human_answer_key.py')  # 03을 그대로 불러 쓴다(고치지 않음)
eval02 = key03.eval02
TAGS, level, by_id, tagset, judge, count, agreement, kappa = (
    eval02.TAGS, eval02.level, eval02.by_id, eval02.tagset, eval02.judge, eval02.count, eval02.agreement, eval02.kappa)
read, filled, human_gold, rate, NOT_MENU = key03.read, key03.filled, key03.human_gold, key03.rate, key03.NOT_MENU

ROUND2 = (('Aninnom', 'human2_a_aninnom.csv'), ('Ruty041', 'human2_b_ruty041.csv'))
OPTIONAL2 = ('GONI1130', 'human2_c_goni1130.csv')
DECIDED2 = 'human2_decided.csv'
LABELS = ('(가) 낱말 표만', '(나) 예전 AI 판 1', '(다) 예전 합침', '(라) 판 2 두 단계', '(마) 판 3 두 단계')


def decided_cells(data, name):
    out = {}
    if (data / name).exists():
        for r in read(data, name):
            v = r['값'].strip()
            if r['태그'].strip() != NOT_MENU:
                level(v)
            out[(r['id'].strip(), r['태그'].strip())] = v
    return out


def show(i, v1, v2, v3):
    """메뉴 하나를 다섯 방식으로 보였을 때의 (확실, 약함). soft_tags 열이 없으면(1차) 빈 것으로 본다."""
    soft = tagset(v3[i].get('soft_tags', ''))
    sure = tagset(v2[i]['sure_tags'])
    sure3 = tagset(v3[i]['sure_tags'])
    return {
        LABELS[0]: (sure, soft - sure),
        LABELS[1]: (tagset(v1[i]['ai_tags']), set()),
        LABELS[2]: (tagset(v1[i]['merged_tags']), set()),
        LABELS[3]: (sure, (tagset(v2[i]['ai_tags']) | tagset(v2[i].get('soft_tags', ''))) - sure),
        LABELS[4]: (sure3, (tagset(v3[i]['ai_tags']) | soft) - sure3),
    }


def measure(gold, sysrows, ids, label):
    cells = []
    for i in ids:
        sure, weak = show(i, *sysrows)[label]
        for t in TAGS:
            g = level(gold[i][t])
            if g is not None:
                cells.append(judge(g, t in sure, t in weak))
    return count(cells)


def missed(gold, sysrows, ids, label):
    out = []
    for i in ids:
        sure, weak = show(i, *sysrows)[label]
        out += [f"{i} {gold[i]['메뉴 이름']} {t}" for t in TAGS if level(gold[i][t]) == 2 and t not in sure | weak]
    return out


def main(argv):
    data = Path(argv[argv.index('--data') + 1]) if '--data' in argv else HERE / 'data'
    cons2 = Path(argv[argv.index('--consensus2') + 1]) if '--consensus2' in argv else data / 'consensus2.csv'

    names2 = list(ROUND2) + ([OPTIONAL2] if (data / OPTIONAL2[1]).exists() else [])
    sheets2 = [(who, read(data, f)) for who, f in names2]
    total2 = len(sheets2[0][1]) * len(TAGS)
    if any(filled(rows) < total2 for _, rows in sheets2[:len(ROUND2)]):
        print('== 1차 메뉴 40개 (03과 같은 출력) ==')
        key03.main(['--data', str(data)])
        print('\n== 2차 메뉴 40개 채운 정도 ==')
        for who, rows in sheets2:
            print(f'{who}: {filled(rows)}/{total2}칸')
        print('2차 시트가 다 차면 1차와 합쳐 80개 표를 낸다')
        return

    names1 = list(key03.SHEETS) + ([key03.OPTIONAL] if (data / key03.OPTIONAL[1]).exists() else [])
    sheets1 = [(who, read(data, f)) for who, f in names1]
    total1 = len(sheets1[0][1]) * len(TAGS)
    print('== 1. 채운 정도 (1차 / 2차) ==')
    for (who, r1), (_, r2) in zip(sheets1, sheets2):
        print(f'{who}: {filled(r1)}/{total1}칸 / {filled(r2)}/{total2}칸')
    if any(filled(rows) < total1 for _, rows in sheets1[:len(key03.SHEETS)]):
        print('1차 시트가 덜 찼다. 1차가 다 차면 80개 표를 낸다')
        return
    if len(sheets1) != len(sheets2):
        raise ValueError('1차와 2차의 사람 수가 다르다(세 번째 시트를 둘 다 두거나 둘 다 뺀다)')
    sheets = [(who, r1 + r2) for (who, r1), (_, r2) in zip(sheets1, sheets2)]
    people = [by_id(rows) for _, rows in sheets]
    for (who, _), p in zip(sheets[1:], people[1:]):
        if set(p) != set(people[0]):
            raise ValueError(f'{who} 시트의 메뉴가 다르다: {sorted(set(p) ^ set(people[0]))}')
    ids1 = [r['id'] for r in sheets1[0][1]]
    ids2 = [r['id'] for r in sheets2[0][1]]
    if set(ids1) & set(ids2):
        raise ValueError(f'1차와 2차 번호가 겹친다: {sorted(set(ids1) & set(ids2))}')

    print(f'\n== 2. 두 사람씩 일치도 ({len(sheets)}명, 80개) ==')
    for x in range(len(sheets)):
        for y in range(x + 1, len(sheets)):
            s = agreement(sheets[x][1], sheets[y][1])[0]['전체']
            print(f"{sheets[x][0]}-{sheets[y][0]}: 칸 {s['n']}, 세 단계 일치 {s['exact']:.1%}, "
                  f"가중 카파(선형) {s['kappa_linear']:.3f}, 있다/없다 일치 {s['binary_agree']:.1%}")

    decided = {**decided_cells(data, key03.DECIDED), **decided_cells(data, DECIDED2)}
    gold, open_cells = human_gold(people, decided)
    rule = '두 명 이상이 같은 값' if len(sheets) >= 3 else '두 사람이 같은 값'
    print(f'\n== 3. 사람 정답 == {rule}, 같이 정한 칸 {len(decided)}, 아직 안 정한 칸 {len(open_cells)} (계산에서 뺀다)')
    if open_cells:
        print(f'못 정한 칸 (1차는 {key03.DECIDED}, 2차는 {DECIDED2}에 id,태그,값,이유로 적는다). '
              f'값 순서: {", ".join(w for w, _ in sheets)}')
    for i, name, t, values in open_cells:
        print(f"  {i} {name} {t}: {' / '.join('빈칸' if v is None else str(v) for v in values)}")

    def rows3(prefix):
        return tuple(by_id(read(data, f'{prefix}_v{k}.csv')) for k in (1, 2, 3))
    sys1, sys2 = rows3('system'), rows3('system2')
    pick = {i: sys1 for i in ids1}
    pick.update({i: sys2 for i in ids2})
    merged = tuple({i: pick[i][k][i] for i in pick} for k in range(3))
    real = [i for i in gold if gold[i][NOT_MENU] != '1']
    shops = [i for i in gold if gold[i][NOT_MENU] == '1' and any(level(gold[i][t]) is not None for t in TAGS)]
    for label, ids in (('메뉴 이름 입력', real), ('가게 이름 입력(대표 메뉴로 매김)', shops)):
        if not ids:
            continue
        parts = (('80개', ids), ('1차', [i for i in ids if i in ids1]), ('2차', [i for i in ids if i in ids2]))
        print(f'\n== 4. 사람 정답으로 잰 직접 적은 메뉴: {label} '
              f"{' / '.join(f'{n} {len(x)}개' for n, x in parts)} ==")
        print('방식                 묶음   놓친 재료(정답 2인데 표시 없음)   괜히 붙은 확실 경고(정답 0인데 확실)   약한 표시 과잉')
        for lab in LABELS:
            for part, sub in parts:
                if not sub:
                    continue
                c = measure(gold, merged, sub, lab)
                print(f"{lab:18} {part:>4}  {rate(c['놓침'], c['정답 2 칸']):>22}   "
                      f"{rate(c['과잉 확실'], c['정답 0 칸']):>24}   {c['약한 표시 과잉']:>6}")
        for lab in LABELS[3:]:
            print(f"{lab}가 놓친 칸: {', '.join(missed(gold, merged, ids, lab)) or '없음'}")
    print('(마) 1차 줄은 (라)가 놓친 칸을 보고 고친 뒤 같은 메뉴로 다시 잰 값이다. 새 메뉴에서의 성능은 2차 줄로 본다')
    print('2차의 (나)(다)(라)는 예전 프롬프트로 지금 다시 물은 값이고, 2차의 낱말 표는 지금 서버 값이다')
    v3 = merged[2]
    said = [i for i in gold if v3[i]['is_menu'].strip().lower() == 'false']
    wrong = [f"{i} {gold[i]['메뉴 이름']}" for i in said if gold[i][NOT_MENU] != '1']
    print(f"(마) 메뉴 아님으로 본 것 {len(said)}개, 그중 사람 정답이 메뉴인 것: {', '.join(wrong) or '없음'}")

    consensus = by_id(read(data, 'consensus.csv'))
    if cons2.exists():
        consensus.update(by_id(read(cons2.parent, cons2.name)))
    else:
        print(f'\n(2차 AI 기준 정답 {cons2}가 없어 5절은 1차만 본다)')
    for part, sub in (('80개', list(gold)), ('1차', ids1), ('2차', ids2)):
        pairs = [(level(gold[i][t]), level(consensus[i][t])) for i in sub if i in consensus for t in TAGS
                 if level(gold[i][t]) is not None and level(consensus[i][t]) is not None]
        if pairs:
            same = sum(p == q for p, q in pairs)
            print(f'{"" if part != "80개" else chr(10)}== 5. AI 기준 정답과 사람 정답 ({part}) == 칸 {len(pairs)}, '
                  f"세 단계 일치 {same / len(pairs):.1%}, 가중 카파(선형) {kappa(pairs, 'linear'):.3f}")


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (OSError, ValueError, KeyError) as error:
        sys.exit(f'평가하지 못했습니다: {error}')
