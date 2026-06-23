---
id: q03-csv-summary-rows-gotcha
kind: qa
must: 합계·소계 같은 요약행을 필터링한다; 통화기호·콤마·괄호음수를 정규화한다; float이 아니라 numeric으로 다룬다; 부호 규약을 direction(debit/credit/refund)으로 단일화한다
must_not: parseFloat로 금액을 파싱한다; 요약행을 거래처럼 그대로 합산한다
rule_source: CLAUDE.md > 아키텍처 규칙 (금액 처리)
---

은행 CSV에 '합계'·'소계' 같은 요약행이 섞여 있고, 금액 칸에는 통화기호·콤마·괄호음수가 들어 있습니다. 금액 파싱에서 무엇을 주의해야 하나요?
