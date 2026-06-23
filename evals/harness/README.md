# 하네스 Eval — CLAUDE.md 룰 준수

> 코드에 테스트가 있다면, 하네스엔 Eval이 있다.

이 Eval은 finsight의 비즈니스 로직이 아니라 **하네스 품질**을 측정한다. CLAUDE.md
한 줄·프롬프트 한 문장이 에이전트 행동을 바꾸므로, 하네스도 코드처럼 회귀한다.
두 축을 본다:

- **review 트랙** — 리뷰 하네스가 `CLAUDE.md`의 CRITICAL 룰 위반을 일관되게
  잡아내고, 정상 코드를 오탐하지 않는지.
- **qa 트랙** — `CLAUDE.md`가 코드베이스 질문(규약·예외처리·gotcha)에 정확히
  답할 만큼 충분한지, 그리고 응답자가 틀린 전제에 동조하지 않는지(환각 방지).
  gotcha 한 줄을 CLAUDE.md에서 지우면 해당 qa 케이스가 회귀로 잡힌다.

## 메커니즘

```
golden set → subject(리뷰어/응답자) 실행 → LLM-as-judge 채점 → 회귀 게이트
```

- **golden set**(`cases/*.md`): 입력 + 기대 라벨. `kind: review|qa`로 트랙을 가른다.
  - review(5): 본문=코드, 라벨=`expect`/`severity`/`rule`. 위반 4 + 정상(오탐 방지) 1.
  - qa(4): 본문=질문, 라벨=`must`(반드시 담겨야 할 사실)·`must_not`(말하면 안 되는 오답).
    사실 검증 3 + 전제반박 가드 1.
- **리뷰어**(`reviewer.ts`): review 트랙 대상. CLAUDE.md 룰 요약(`rules.ts`)을 적용해
  코드를 리뷰하는 경량 단일 호출(Sonnet, temperature 0). 산문 리뷰를 출력한다.
- **응답자**(`responder.ts`): qa 트랙 대상. **라이브 `CLAUDE.md`**를 컨텍스트로 받아
  질문에 답하는 경량 단일 호출(Sonnet, temperature 0). 산문 답변을 출력한다.
- **judge**(`judge.ts`): 다른 모델(Opus)이 "subject가 기대대로 했나"를 pass/fail로
  채점한다(`judge`=review, `judgeQa`=qa).
- **게이트**(`run.ts`): kind로 분기해 실행하고, 하나라도 실패하면 `exit 1`.

## 구조

```
evals/harness/
  cases/                  golden set (라벨 + 입력); kind=review|qa
  lib/case.ts             frontmatter 파서 (순수, 테스트 O)
  lib/verdict.ts          집계·리포트 (순수, 테스트 O)
  rules.ts                CLAUDE.md 룰 요약 → 리뷰어 시스템 프롬프트
  reviewer.ts             review 트랙 대상 (Claude 호출)
  responder.ts            qa 트랙 대상 — 라이브 CLAUDE.md 컨텍스트 (Claude 호출)
  judge.ts                LLM-as-judge: judge(review) / judgeQa(qa) (Claude 호출)
  run.ts                  러너 + 회귀 게이트 (kind로 분기)
```

## 실행

```bash
# 전체 Eval (Claude 호출 — ANTHROPIC_API_KEY 필요, .env 자동 로드)
npm run eval

# golden set 무결성 + 순수 함수 (키 불필요 — npm test에 포함)
npm test
```

`npm run eval`은 네트워크·비용·비결정성이 있어 `npm test`(키 없는 green 게이트)와
분리돼 있다. 순수 함수와 golden set 무결성(review 위반4+정상1, qa must/가드)만
`npm test`가 지킨다.

## golden set 키우기

처음부터 크게 만들지 않는다. 운영 중 발견한 실패를 한 개씩 `cases/`에 `.md`로
추가한다(테스트 스위트가 버그 하나당 한 줄씩 자라듯). 새 케이스의 라벨
(review=`expect`/`severity`, qa=`must`/`must_not`)은 **사람이 검수해 박제**한다 —
자동 라벨은 judge와 같은 모델 편향을 공유해 회귀를 놓친다.

## 한계 (의도된 트레이드오프)

- **judge는 흔들린다.** 리뷰어는 temperature 0으로 고정하지만 judge(Opus 4.8)는
  temperature를 지원하지 않아, LLM 채점이 완벽히 결정적이지는 않다. 판정이 애매하면
  사람이 최종 검토한다(judge 맹신 금지).
- **경량 리뷰어 ≠ 실제 `/review-code`.** 강의 시연·게이트 속도를 위해 단일 호출로
  대리한다. 산문 입출력이라 `reviewer.ts`만 headless `/review-code`로 교체하면
  실제 워크플로우를 eval할 수 있다(judge·게이트는 불변).
- **qa 응답자는 CLAUDE.md를 통째로 받는다.** 따라서 사실이 CLAUDE.md에 있으면
  거의 맞힌다 — 즉 positive qa 케이스는 추론력 테스트가 아니라 **CLAUDE.md 커버리지
  회귀 센티넬**이다(그 줄을 지우면 red). 진짜 변별력은 전제반박 가드(틀린 전제에
  동조 안 하나)와, CLAUDE.md에 아직 없는 사실을 묻는 케이스에서 나온다.
