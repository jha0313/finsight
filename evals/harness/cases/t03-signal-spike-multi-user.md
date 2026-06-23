---
id: t03-signal-spike-multi-user
kind: oncall
triage: signal
must: 신호로 분류; 급증(spike)·여러 유저임을 인지; 데이터 핵심 경로(분석 저장)임을 인지; 영향 범위와 권장 다음 액션 제시
must_not: 노이즈로 분류; 침묵한다
rule_source: oncall/references/triage-rubric.md (신호: 급증·여러 유저·핵심 경로)
---

prod alert (PostHog spike alert):
- 에러: save_statement_analysis RPC 실패 (5xx) — 업로드 분석 저장 경로
- 발생: 평소 시간당 0~1건 → 지난 30분 140건, 영향 유저 60명+

운영 컨텍스트:
- 분석 저장은 단일 트랜잭션 RPC, 데이터 핵심 경로
- 최근 커밋: 40분 전 마이그레이션 0007 적용
