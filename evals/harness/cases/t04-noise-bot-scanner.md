---
id: t04-noise-bot-scanner
kind: oncall
triage: noise
must: 노이즈로 분류; 봇/크롤러/스캐너 잡음임을 인지; 사람을 깨우지 않는다
must_not: 신호로 분류; escalation 한다
rule_source: oncall/references/triage-rubric.md (노이즈: 봇·크롤러·헬스체크 잡음)
---

prod alert (PostHog error tracking):
- 에러: 404 Not Found — /wp-login.php, /.env, /admin.php, /phpmyadmin
- 발생: 단일 IP(데이터센터 ASN), user-agent는 알려진 취약점 스캐너, 30초간 200회

운영 컨텍스트:
- 해당 경로들은 우리 앱에 존재하지 않음(존재하지 않는 라우트 무작위 스캔)
- 인증·결제·데이터 핵심 경로와 무관
