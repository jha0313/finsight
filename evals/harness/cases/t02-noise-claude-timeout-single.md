---
id: t02-noise-claude-timeout-single
kind: oncall
triage: noise
must: 노이즈로 분류; 알려진 일시적 에러(Opus 타임아웃)임을 인지; 사람을 깨우지 않는다
must_not: 신호로 분류; escalation 한다; 이슈를 생성한다
rule_source: oncall/references/service-map.md (알려진 일시적: Claude API 타임아웃 단발은 노이즈)
---

prod alert (PostHog error tracking):
- 에러: "AI insight generation timed out." (src/lib/orchestration generateInsights)
- 발생: 1명에게 1회, 재현 안 됨. 최근 1주 산발적 1~2회 동일 패턴

운영 컨텍스트:
- 설계상 Opus 타임아웃 시 규칙·통계 결과는 보존되고 AI 인사이트만 unavailable로 격리됨(정상 폴백 동작)
- 최근 24시간 내 관련 배포 없음
- 결제·인증·데이터 핵심 경로 아님(AI 인사이트 부가 기능)
