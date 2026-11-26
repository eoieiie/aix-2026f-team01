#!/usr/bin/env python3
"""재료 태그 평가를 메뉴 80개로 (2026-11-26).

1차 메뉴 40개(M01~M40)는 팀원 세 명이 따로 매긴 사람 정답(03과 같은 다수결)으로 잰다.
2차 메뉴 40개(M41~M80)는 사람이 매기지 않았다. 그래서 AI 기준 정답(평가자 둘과 판정자의 합의, consensus2.csv)으로 잰다.
사람 정답은 1차 40개뿐이다. 2차를 AI 기준 정답으로 재는 근거로 두 AI 평가자의 일치도와,
1차에서 AI 기준 정답이 사람 정답과 얼마나 맞았는지를 같이 낸다.

1) 근거: 두 AI 평가자 일치도(1차, 2차), 1차 AI 기준 정답과 사람 정답의 일치도
2) 1차 40개, 사람 정답 기준: (가)~(마). 03과 같은 숫자
3) 2차 40개, AI 기준 정답 기준: (가)~(마). 2차는 판 3을 고칠 때 보지 않은 새 메뉴다
4) 합쳐서 80개: 1차는 사람 정답, 2차는 AI 기준 정답으로 센 합계
(바) 낱말 표 고친 뒤(0060): 2차에서 찾은 낱말 표 오발을 고친 뒤 같은 메뉴로 잰 값. 2차도 보고 고친 뒤 잰 값이 된다
5) (마)가 2차에서 놓친 칸과 메뉴 아님 판단이 틀린 것

시스템 답: 1차 system_v1~v3.csv(그때 서버 값), 2차 system2_v1~v3.csv. 2차의 판 3은 운영 서버 답이고, 판 1과 판 2는
git 기록의 프롬프트로 Gemini에 다시 물은 값이다. 2차 낱말 표는 지금 서버 값이며 약한 낱말 태그(soft_tags)도 약한 표시로 센다.
03을 고치지 않고 불러 쓴다. 표준 라이브러리만 쓰고 인터넷에 닿지 않는다. 쓰는 법: python3 04_eval_80.py [--data 폴더]
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

LABELS = ('(가) 낱말 표만', '(나) 예전 AI 판 1', '(다) 예전 합침', '(라) 판 2 두 단계', '(마) 판 3 두 단계',
          '(바) 낱말 표 고친 뒤')
BASIS1, BASIS2 = '사람 정답(세 명 다수결)', 'AI 기준 정답(consensus2)'


def show(i, v1, v2, v3, v4):
    """메뉴 하나를 여섯 방식으로 보였을 때의 (확실, 약함). soft_tags 열이 없으면(1차) 빈 것으로 본다."""
    soft = tagset(v3[i].get('soft_tags', ''))
    sure, sure3, sure4 = tagset(v2[i]['sure_tags']), tagset(v3[i]['sure_tags']), tagset(v4[i]['sure_tags'])
    return {
        LABELS[0]: (sure, soft - sure),
        LABELS[1]: (tagset(v1[i]['ai_tags']), set()),
        LABELS[2]: (tagset(v1[i]['merged_tags']), set()),
        LABELS[3]: (sure, (tagset(v2[i]['ai_tags']) | tagset(v2[i].get('soft_tags', ''))) - sure),
        LABELS[4]: (sure3, (tagset(v3[i]['ai_tags']) | soft) - sure3),
        LABELS[5]: (sure4, (tagset(v4[i]['ai_tags']) | tagset(v4[i].get('soft_tags', ''))) - sure4),
    }


def measure(gold, sysrows, ids, label):
    cells = []
    for i in ids:
        sure, weak = show(i, *sysrows)[label]
        cells += [judge(level(gold[i][t]), t in sure, t in weak) for t in TAGS if level(gold[i][t]) is not None]
    return count(cells)


def missed(gold, sysrows, ids, label):
    out = []
    for i in ids:
        sure, weak = show(i, *sysrows)[label]
        out += [f"{i} {gold[i]['메뉴 이름']} {t}" for t in TAGS if level(gold[i][t]) == 2 and t not in sure | weak]
    return out


def split(gold):
    real = [i for i in gold if gold[i][NOT_MENU].strip() != '1']
    shops = [i for i in gold if gold[i][NOT_MENU].strip() == '1' and any(level(gold[i][t]) is not None for t in TAGS)]
    return (('메뉴 이름 입력', real), ('가게 이름 입력(대표 메뉴로 매김)', shops))


def line(label, c):
    return (f"{label:18}  {rate(c['놓침'], c['정답 2 칸']):>16}   {rate(c['과잉 확실'], c['정답 0 칸']):>16}"
            f"   {c['약한 표시 과잉']:>6}")


HEAD = '방식                  놓친 재료          괜히 붙은 확실 경고   약한 표시 과잉\n' \
       '                      (정답 2, 표시 없음) (정답 0인데 확실)    (정답 0인데 약함)'


def agree_line(name, a_rows, b_rows):
    s = agreement(a_rows, b_rows)[0]['전체']
    print(f"{name}: 칸 {s['n']}, 세 단계 일치 {s['exact']:.1%}, 가중 카파(선형) {s['kappa_linear']:.3f}, "
          f"있다/없다 카파 {s['kappa_binary']:.3f}")


def main(argv):
    data = Path(argv[argv.index('--data') + 1]) if '--data' in argv else HERE / 'data'

    # 1차 사람 정답 (03과 같은 규칙)
    names = list(key03.SHEETS) + ([key03.OPTIONAL] if (data / key03.OPTIONAL[1]).exists() else [])
    sheets = [(who, read(data, f)) for who, f in names]
    total = len(sheets[0][1]) * len(TAGS)
    if any(filled(rows) < total for _, rows in sheets[:len(key03.SHEETS)]):
        print('1차 사람 시트가 덜 찼다. python3 03_human_answer_key.py로 채운 정도를 본다')
        return
    decided = {}
    if (data / key03.DECIDED).exists():
        for r in read(data, key03.DECIDED):
            decided[(r['id'].strip(), r['태그'].strip())] = r['값'].strip()
    gold1, open_cells = human_gold([by_id(rows) for _, rows in sheets], decided)
    gold2 = by_id(read(data, 'consensus2.csv'))
    ids1, ids2 = list(gold1), list(gold2)
    if set(ids1) & set(ids2):
        raise ValueError(f'1차와 2차 번호가 겹친다: {sorted(set(ids1) & set(ids2))}')
    cons1 = by_id(read(data, 'consensus.csv'))

    def rows3(prefix):
        """판 1~3과 낱말 표 고친 뒤(v4). v4 파일이 없으면(1차: 0060으로 바뀐 칸이 없다) 판 3 값을 쓴다."""
        got = [by_id(read(data, f'{prefix}_v{k}.csv')) for k in (1, 2, 3)]
        v4 = f'{prefix}_v4.csv'
        return tuple(got + [by_id(read(data, v4)) if (data / v4).exists() else got[2]])
    sys1, sys2 = rows3('system'), rows3('system2')

    print('== 1. 2차를 AI 기준 정답으로 재는 근거 ==')
    print('2차 40개는 사람이 매기지 않았다. 사람 정답은 1차 40개뿐이다')
    a1 = [r for r in read(data, 'annot_a_claude.csv') if r['id'] in cons1 and r['id'].startswith('M')]
    b1 = [r for r in read(data, 'annot_b_gpt.csv') if r['id'] in cons1 and r['id'].startswith('M')]
    agree_line('두 AI 평가자 일치도, 1차 M01~M40', a1, b1)
    agree_line('두 AI 평가자 일치도, 2차 M41~M80', read(data, 'annot2_a_claude.csv'), read(data, 'annot2_b_gpt.csv'))
    pairs = [(level(gold1[i][t]), level(cons1[i][t])) for i in ids1 for t in TAGS
             if level(gold1[i][t]) is not None and level(cons1[i][t]) is not None]
    same = sum(p == q for p, q in pairs)
    print(f"1차 AI 기준 정답과 사람 정답: 칸 {len(pairs)}, 세 단계 일치 {same / len(pairs):.1%}, "
          f"가중 카파(선형) {kappa(pairs, 'linear'):.3f} (사람 정답에서 아직 안 정한 칸 {len(open_cells)}개는 뺐다)")

    totals = {}
    for n, (title, gold, sysrows) in enumerate((
            (f'1차 40개, {BASIS1} 기준', gold1, sys1),
            (f'2차 40개, {BASIS2} 기준', gold2, sys2)), start=2):
        print(f'\n== {n}. {title} ==')
        if n == 3:
            print('2차는 판 3을 고칠 때 보지 않은 새 메뉴다. 정답은 사람이 아니라 AI 기준 정답이다')
        for kind, ids in split(gold):
            print(f'{kind} {len(ids)}개')
            print(HEAD)
            for lab in LABELS:
                c = measure(gold, sysrows, ids, lab)
                print(line(lab, c))
                tot = totals.setdefault((kind, lab), {k: 0 for k in c})
                for k in c:
                    tot[k] += c[k]
            totals.setdefault(('n', kind), 0)
            totals[('n', kind)] += len(ids)
        if n == 2:
            print('(마) 1차는 (라)가 놓친 칸을 보고 고친 뒤 같은 메뉴로 다시 잰 값이다(같은 자료로 고친 뒤 잰 값)')
            print('(바) 1차는 0060으로 바뀐 칸이 없어 (마)와 같다')
        else:
            print('2차의 (나)(다)(라)는 예전 프롬프트로 지금 다시 물은 값이고, 2차의 낱말 표는 지금 서버 값이다')
            print('(바)는 2차에서 찾은 낱말 표 오발을 보고 고친 뒤(0060) 같은 메뉴로 잰 값이다. 2차도 이제 보고 고친 뒤 잰 값이라 '
                  '새 메뉴 성능은 (마)로 본다')

    print(f'\n== 4. 합쳐서 80개 (1차는 {BASIS1}, 2차는 {BASIS2}로 센 합계) ==')
    for kind, _ in split(gold1):
        print(f"{kind} {totals[('n', kind)]}개 (1차는 사람 정답, 2차는 AI 기준 정답)")
        print(HEAD)
        for lab in LABELS:
            print(line(lab, totals[(kind, lab)]) + '   기준: 1차는 사람 정답, 2차는 AI 기준 정답')

    print(f'\n== 5. (마) 판 3이 2차({BASIS2} 기준)에서 틀린 것 ==')
    for kind, ids in split(gold2):
        print(f"{kind} 놓친 칸: {', '.join(missed(gold2, sys2, ids, LABELS[4])) or '없음'}")
        new = sorted(set(missed(gold2, sys2, ids, LABELS[5])) - set(missed(gold2, sys2, ids, LABELS[4])))
        print(f"{kind} (바)에서 새로 생긴 놓친 칸: {', '.join(new) or '없음'}")
    v3 = sys2[2]
    wrong_not = [f"{i} {gold2[i]['메뉴 이름']}" for i in ids2
                 if v3[i]['is_menu'].strip().lower() == 'false' and gold2[i][NOT_MENU].strip() != '1']
    wrong_menu = [f"{i} {gold2[i]['메뉴 이름']}" for i in ids2
                  if v3[i]['is_menu'].strip().lower() == 'true' and gold2[i][NOT_MENU].strip() == '1']
    print(f"메뉴인데 메뉴 아님으로 본 것: {', '.join(wrong_not) or '없음'}")
    print(f"메뉴 아님인데 메뉴로 본 것: {', '.join(wrong_menu) or '없음'}")
    fails = [i for i in ids2 if v3[i]['ai_status'] == 'failed']
    print(f'답 실패: {len(fails)}개 {fails}')


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (OSError, ValueError, KeyError) as error:
        sys.exit(f'평가하지 못했습니다: {error}')
