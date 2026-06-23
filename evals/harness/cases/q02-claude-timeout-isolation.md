---
id: q02-claude-timeout-isolation
kind: qa
must: 요청 전체를 실패시키지 않는다; 규칙·통계 결과는 보존한다; AI 인사이트만 unavailable로 격리한다; Opus 호출에 timeout(예 30s)을 둔다
must_not: 요청 전체를 500으로 실패시킨다; 규칙·통계 결과까지 버린다
rule_source: CLAUDE.md > 아키텍처 규칙 (AI 호출 격리)
---

Pro 심층 분석 중 Claude(Opus) 호출이 너무 오래 걸려 타임아웃됩니다. 요청 전체를 500으로 실패시키면 되나요? 어떻게 처리해야 하죠?
