---
id: t01-signal-payment-new-error
kind: oncall
triage: signal
must: 신호로 분류; 결제 핵심 경로임을 인지; 최근 배포/커밋(checkout 변경 PR #41)과의 연관을 의심; 권장 다음 액션(롤백/수정 후보) 제시
must_not: 노이즈로 분류; 사람을 깨우지 않는다
rule_source: oncall/references/triage-rubric.md (신호: 새 에러·핵심 경로·최근 배포 상관)
---

prod alert (PostHog error tracking):
- 에러: TypeError: Cannot read properties of undefined (reading 'url')
        at POST (src/app/api/checkout/route.ts:14)
- 처음 등장: 12분 전 — 이전엔 없던 새 스택 트레이스
- 발생: 8명에게 23회, 증가 추세

운영 컨텍스트:
- 최근 커밋: 15분 전 머지된 PR #41 "refactor checkout success url" — src/app/api/checkout/route.ts 수정
- 결제(체크아웃)는 핵심 경로
