# 2주차 활동지 — 코딩 에이전트와 컨텍스트

|     |                     |
| :-- | :------------------ |
| 팀명  | 세션 제한의 90%를 사용했습니다. |
| 작성일 | 9월9일                |
| 참여자 | 황병주, 이혁준, 이학준, 이재곤  |

---

## 0. 준비

 `memo-seed` 저장소를 엽니다. 다음 파일이 있는지 확인하세요.

- [x] `schema.sql`
- [x] `service.js`
- [x] `routes.js`
- [x] `CONVENTIONS.md`

---

## 1. 조 나누기

팀을 두 조로 나눕니다. (4인 → 2:2 / 3인 → 1:2)

| 조   | 참여자      |
| :-- | :------- |
| A조  | 황병주, 이학준 |
| B조  | 이혁준, 이재곤 |

**두 조는 같은 과제를 동시에 수행합니다.** 서로의 화면을 보지 마세요.

### 오늘의 과제 (두 조 공통)

> 메모 검색 기능을 추가하라. 제목과 본문에서 키워드로 찾을 수 있어야 한다.

---

## 2. 에이전트에게 준 것

### A조 — 이것만 붙여넣습니다

```
메모 검색 기능 만들어줘. 제목이랑 본문에서 키워드로 찾을 수 있게.
```

파일은 **하나도 주지 않습니다.**

### B조 — 네 칸을 모두 채웁니다

```
[지시]
메모 검색 기능을 추가해줘. 제목과 본문에서 키워드로 검색된다.

[규약]
(CONVENTIONS.md 내용 전체를 붙여넣기)

[근거]
(schema.sql, service.js, routes.js 내용 전체를 붙여넣기)

[종료조건]
- GET /memos/search?q=키워드 로 호출된다
- 제목 또는 본문에 키워드가 포함된 메모만 반환한다
- 본인 메모만 반환한다
- q가 비어 있으면 400과 { ok: false, error } 를 반환한다
```

### 실제로 붙여넣은 것 (원문 그대로, 요약 금지)

```
예시 그대로 붙여넣음
```

> 요약하지 마세요. 나중에 이 기록이 무엇이 결과를 만들었는지 확인하는 근거가 됩니다.

---

## 3. 결과 확인

**A조**


~~~

1. A조 def search_memos(memos, keyword): result = [] # 검색어의 대소문자를 통일하여 정확도 향상 search_keyword = keyword.lower() for memo in memos: title = memo.get('title', '').lower() content = memo.get('content', '').lower() # 제목이나 본문에 키워드가 포함되어 있는지 확인 if search_keyword in title or search_keyword in content: result.append(memo) return result
    
    # 테스트용 메모 데이터
    
    memo_database = [ {"id": 1, "title": "이번 주 장보기 목록", "content": "사과, 우유, 계란, 파스타 면"}, {"id": 2, "title": "프로그래밍 과제", "content": "리스트와 딕셔너리 구조 복습하기"}, {"id": 3, "title": "주말 일정", "content": "친구들이랑 사과 농장 체험 가기"} ]
    
    # '사과' 키워드 검색 실행
    
    found_memos = search_memos(memo_database, "사과") for memo in found_memos: print(f"[{memo['title']}] {memo['content']}")
~~~

① 실행 성공까지 걸린 시간: 2분 
② 없는 함수·컬럼을 지어낸 개수: [ 함수1, 컬럼2 ]개 → 지어낸 이름: [ db.execute(), memo_id, content] 
③ CONVENTIONS.md 위반 개수: 5개 → 무엇을 어겼는가: [ 계층 분리, 응답 형식, 명명 규칙, 입력 검증, 권한 위반 ] 
④ 사람이 직접 고친 지점: [ ]곳 → 어디를 어떻게: [ ] 
⑤ 본인 메모만 반환되는가: 예



**B조**

~~~
1. ### service.js
    
    function searchMemos(userId, keyword) { const pattern = `%${escapeLike(keyword)}%`; return db.all( `SELECT id, title, created_at FROM memos WHERE user_id = ? AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') ORDER BY created_at DESC`, [userId, pattern, pattern] ); }
    
    ### routes.js
    
    router.get('/memos/search', async (req, res) => { const { q } = req.query; if (typeof q !== 'string' || q.trim() === '') { return res.status(400).json({ ok: false, error: 'SEARCH_QUERY_REQUIRED' }); } const memos = await service.searchMemos(req.user.id, q.trim()); res.json({ ok: true, data: memos }); });
~~~

① 실행 성공까지 걸린 시간: 3분 
② 없는 함수·컬럼을 지어낸 개수: [ 0 ]개 → 지어낸 이름: [ 없음 ] 
③ CONVENTIONS.md 위반 개수: 0개 → 무엇을 어겼는가: [ 없음 ] 
④ 사람이 직접 고친 지점: [ ]곳 → 어디를 어떻게: [ ] 
⑤ 본인 메모만 반환되는가: 아니오

### ⑤번을 반드시 확인하세요

생성된 SQL에 `user_id` 조건이 들어 있는지 보세요.

없다면 **코드는 정상 동작하지만 남의 메모까지 검색됩니다.** 에러도 나지 않습니다.

**A** : user_id 전혀 없음 
**B** : user_id 존재


---

## 4. 두 조의 결과 비교

작업이 끝나면 두 조가 만든 코드를 나란히 놓고 함께 답하세요.

**4-1. 두 결과의 가장 큰 차이는 무엇입니까?**

```
A조는 문제를 스스로 상상해서 풀었고, B조는 주어진 시스템 안에서 풀었다.

A조의 에이전트는 모든 기술 스택을 전부 가정하여 파일을 생성했다.
B조는 실제 컬럼명(body, user_id)을 쓰고 계층 분리와 응답 형식을 지켰다. 

시간은 A조가 1분 빨랐지만(2분 vs 3분)수정이 필요한 상황이고,ㅡ B조는 수정 없이 그대로 쓸 수 있었다.
```

**4-2. A조의 실패는 모델 탓입니까, 우리가 주지 않은 탓입니까? 근거를 들어 적으세요.**

```
규칙 총 5개 중 아무것도 적용되지 않았다. 

언어도 스키마도 규약도 조건도 없었고, 가장 그럴듯한 값을 채워 넣도록 만들어진 시스템이었다. 
오작동은 없었지만, 입력하는 조건의 부재로 인한 실패였다고 판단하였다.

```

**4-3. B조가 준 자료 중 결과를 가장 크게 바꾼 것 하나를 꼽는다면 무엇입니까? 왜 그렇게 생각합니까?**

```
[근거] 칸에 붙여넣은 실제 코드(schema.sql, service.js, routes.js)

컬럼명, 언어, 파일 구조, DB 접근 방식이 전부 여기서 나왔다. 규약과 종료조건만 주고 코드를 주지 않았다면 여전히 파이썬으로 하드코딩된 결과가 나왔을 것이다.

다만 ⑤번(본인 메모만 반환)은 [종료조건]의 "본인 메모만 반환한다"와 [규약]의 권한 규칙이 함께 막았다. 보안 결함 하나를 막은 것은 그 한 줄이다.
```

---

## 5. PROMPTS.md 기록

위 2번의 프롬프트 원문을 저장소의 `PROMPTS.md`에 추가하고 커밋하세요.

```markdown
## 2026-__-__ · 메모 검색 기능 (2주차 활동)

**지시**
(붙여넣은 프롬프트 원문)

**채택 여부**
(전체 채택 / 일부 채택 — 무엇을 어떻게 수정했는지 / 미채택)

**참고**
(있으면)
```

- [x] `PROMPTS.md`에 추가하고 커밋했습니다

---

## 6. 제출 확인

- [x] 이 활동지를 저장소에 커밋했습니다
- [x] `PROMPTS.md`를 커밋했습니다
