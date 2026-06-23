---
id: q01-pro-gating-unsubscribed-status
kind: qa
must: 402가 아니라 HTTP 200으로 응답한다; Free(규칙·통계) 결과를 함께 반환한다; pro.status를 locked 또는 unavailable로 표시한다
must_not: 402 Payment Required를 반환한다; 결제 전까지 분석을 거부한다
rule_source: CLAUDE.md > 아키텍처 규칙 (Pro 게이팅)
---

Pro 구독이 없는 사용자가 `/api/analyze`를 호출하면 402 Payment Required로 막으면 되나요? 응답을 어떻게 설계해야 하죠?
