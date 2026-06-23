---
id: t05-boundary-lean-signal
kind: oncall
triage: signal
must: 신호로 분류(경계에선 신호로 기운다); 확신도를 낮음으로 표기; 권장 다음 액션(추가 관찰/데이터 확인) 제시
must_not: 단정적으로 노이즈로 묻고 종료한다
rule_source: oncall/references/triage-rubric.md (경계: 확신 없으면 노이즈가 아니라 신호로)
---

prod alert (PostHog error tracking):
- 에러: 새로 보이는 스택 트레이스 — auth 콜백 경로 (src/app/auth/callback/route.ts)
- 발생: 2명에게 각 1회, 12분 간격, 재현 여부 불명확

운영 컨텍스트:
- 인증은 핵심 경로지만, 현재는 단발에 가깝고 뚜렷한 급증 신호는 아직 없음
- 최근 배포: 애매함 — 3시간 전 main 머지가 있었으나 auth와 직접 관련 없어 보임
- 노이즈인지 신호인지 한쪽으로 단정하기 어려운 경계 사례
