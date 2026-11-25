#!/usr/bin/env python3
"""사람이 확인한 정답표로 낱말 표, 서버 AI 태그, 둘의 합집합을 비교한다."""
import csv
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent / 'data'
TAGS = set('spicy seafood pork beef chicken wheat dairy nuts egg'.split())


def read_rows(filename, fields):
    with (DATA / filename).open(encoding='utf-8-sig', newline='') as file:
        reader = csv.DictReader(file)
        if not set(fields).issubset(reader.fieldnames or []):
            raise ValueError(f'{filename}: 필요한 열은 {", ".join(fields)}입니다.')
        for number, row in enumerate(reader, 2):
            if None in row or any(row.get(key) is None for key in fields):
                raise ValueError(f'{filename} {number}행: 열의 개수를 확인하세요.')
            yield row


def parse_tags(value):
    tags = set(value.split())
    if tags - TAGS:
        raise ValueError(f'허용하지 않은 태그: {", ".join(sorted(tags - TAGS))}')
    return tags


def name_key(name):
    return re.sub(r'\s+', '', name).lower()


def keyword_tags(name, rules):
    """서버 guess_food_tags처럼 기본 음식 이름과 낱말의 부분 일치를 합친다."""
    return set().union(*(tags for word, tags in rules if word in name))


def load_answers():
    """빈 칸은 모른다는 뜻이다. 해당 없음으로 확인한 경우만 '-'로 받는다."""
    path = DATA / 'answer_key.csv'
    if not path.exists():
        return {}
    answers = {}
    for row in read_rows(path.name, ('name', 'tags', 'source')):
        name, raw, source = (row[k].strip() for k in ('name', 'tags', 'source'))
        key = name_key(name)
        if not key or not raw or not source:
            raise ValueError('정답표에는 메뉴 이름, 확인한 태그(없으면 -), 근거가 모두 필요합니다.')
        if key in answers:
            raise ValueError(f'정답표에 중복 메뉴가 있습니다: {name}')
        answers[key] = (name, set() if raw == '-' else parse_tags(raw))
    return answers


def score(predictions):
    """메뉴별 태그 적중, 잘못 더한 태그, 빠뜨린 태그를 전체에서 합산한다."""
    hit = extra = missed = 0
    for expected, predicted in predictions:
        hit += len(predicted & expected)
        extra += len(predicted - expected)
        missed += len(expected - predicted)
    return hit, extra, missed


def ratio(numerator, denominator):
    return f'{numerator / denominator:.1%}' if denominator else '정의되지 않음'


def main():
    answers = load_answers()
    if not answers:
        print('사람이 확인한 정답표가 없어 성능 숫자를 출력하지 않습니다. data/answer_key.csv에 근거와 함께 채워 주세요.')
        return

    ai = {}
    for row in read_rows('ai_results.csv', ('name', 'tags')):
        key = name_key(row['name'])
        if not key or key in ai:
            raise ValueError(f'AI 태그 자료에 비어 있거나 중복된 메뉴 이름이 있습니다: {row["name"]}')
        ai[key] = parse_tags(row['tags'])
    missing = answers.keys() - ai.keys()
    if missing:
        names = ', '.join(answers[key][0] for key in sorted(missing))
        raise ValueError(f'서버 AI 결과가 없는 정답 메뉴는 비교할 수 없습니다: {names}')

    rules = [(row[column], parse_tags(row['tags']))
             for filename, column in (('default_foods.csv', 'name'), ('food_keywords.csv', 'keyword'))
             for row in read_rows(filename, (column, 'tags')) if row[column]]
    methods = {'낱말 표': [], 'AI': [], '합침': []}
    for key, (name, expected) in answers.items():
        word = keyword_tags(name, rules)
        methods['낱말 표'].append((expected, word))
        methods['AI'].append((expected, ai[key]))
        methods['합침'].append((expected, word | ai[key]))

    print(f'같은 정답 메뉴 {len(answers)}개로 비교')
    for method, predictions in methods.items():
        hit, extra, missed = score(predictions)
        print(f'{method}: 적중 {hit}, 과잉 {extra}, 누락 {missed}, '
              f'정밀도 {ratio(hit, hit + extra)}, 재현율 {ratio(hit, hit + missed)}, '
              f'F1 {ratio(2 * hit, 2 * hit + extra + missed)}')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        sys.exit(f'평가하지 못했습니다: {error}')
