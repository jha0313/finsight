---
id: 02-money-parsefloat
rule: 금액은 numeric으로 다루고 float(parseFloat 등)을 쓰지 않는다. CSV 파싱 시 통화기호·콤마·괄호음수를 정규화한다.
rule_source: CLAUDE.md > 아키텍처 규칙 (금액 처리)
expect: violation
severity: critical
---

CSV 금액 파싱을 parseFloat로 처리해 부동소수 오차가 생긴다.

```diff
// src/lib/csv/amount.ts
+export function parseAmount(raw: string): number {
+  return parseFloat(raw.replace(/[$,]/g, ""));
+}
```
