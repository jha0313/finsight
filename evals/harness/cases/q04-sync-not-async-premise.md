---
id: q04-sync-not-async-premise
kind: qa
must: 비동기 큐가 아니라 동기 처리다(전제가 틀렸음을 바로잡는다); statements·transactions·analyses 저장은 Postgres RPC 단일 트랜잭션(save_statement_analysis)으로 한다; 중간 실패 시 전체 rollback한다
must_not: 비동기 백그라운드 큐가 맞다고 동조한다; 존재하지 않는 큐 이름을 지어낸다
rule_source: CLAUDE.md > 아키텍처 규칙 (동기 처리·단일 트랜잭션) — 틀린 전제 반박(환각 방지)
---

finsight는 업로드된 명세서 분석을 백그라운드 작업 큐(비동기 job)로 처리하죠? 그 큐 이름이 뭔가요?
