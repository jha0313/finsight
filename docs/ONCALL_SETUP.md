# Oncall 에이전트 — 셋업 & 운영 가이드

FinSight의 운영(operations) 1차 대응 에이전트. 사람이 시키지 않아도 **시스템 이벤트**에 깨어나 1차 대응하고, 자기 선을 넘는 일은 **분석을 들고 사람을 깨운다(escalation)**. 에이전트의 행동 규칙(하네스)은 `.claude/skills/oncall/`에 있고, 이 문서는 그것을 **실제로 가동**하기 위한 인프라 셋업이다.

## 아키텍처 — 왜 이렇게 생겼나

게이트 3종을 항상 지킨다: **read-only**(prod 직접 수정 금지, 변경은 PR) · **노이즈 필터** · **escalation**.

```
트리거 ① CI 실패
  ci.yml(lint/build/test) 실패  ──workflow_run──▶  oncall-ci-fix.yml
                                                    └ claude-code-action(헤드리스)
                                                      → 로그 분석 → 수정 브랜치 → PR (자동 머지 X)
                                                      → code-review.yml이 리뷰 → 사람이 머지

트리거 ② prod alert
  PostHog error webhook  ──HTTP──▶  /api/webhook/posthog (Vercel)
                                     └ 서명검증 + 멱등(processed_webhook_events)
                                     └ repository_dispatch(oncall-alert)  ──▶  oncall-triage.yml
                                                                                └ claude-code-action(헤드리스)
                                                                                  → 노이즈/신호 판정
                                                                                  → 노이즈: 로그만 / 신호: GitHub Issue(분석 동반)

트리거 ③ 유저 질의 (Autopilot)
  두뇌(플레이북) = .claude/skills/oncall/references/autopilot.md  ← 지금 동작(로컬 one-shot)
  always-on 입구(인앱 티켓 수신/세션/발송 채널)는 아래 "③ always-on 설계"로 분리된 후속.
```

**핵심 설계 결정:** Vercel serverless에는 Claude Code 바이너리도 함수 실행시간 여유도 없어 webhook에서 `claude -p`를 직접 못 띄운다. 그래서 webhook route는 **검증+멱등+dispatch까지만** 하고, 실제 에이전트는 **GitHub Actions(`claude-code-action`)에서 헤드리스로** 돈다. 결과적으로 CI 실패와 prod alert가 **둘 다 같은 헤드리스 패턴**으로 수렴한다(기존 `code-review.yml`과 일관).

## 파일 맵

| 파일 | 역할 |
|---|---|
| `.claude/skills/oncall/SKILL.md` + `references/` | 운영 하네스(인터랙티브 + 헤드리스 공용) |
| `.github/workflows/ci.yml` | lint+build+test (깨질 대상) |
| `.github/workflows/oncall-ci-fix.yml` | CI 실패 → 분석 → 수정 PR |
| `.github/workflows/oncall-triage.yml` | alert → 노이즈/신호 → escalation(Issue) |
| `src/app/api/webhook/posthog/route.ts` | PostHog webhook 수신(검증+멱등+dispatch) |
| `src/lib/orchestration/index.ts` → `runPostHogWebhookRequest` | 수신 흐름(순수 로직, TDD) |
| `src/services/posthog/webhook.ts` | 시크릿 검증 + GitHub dispatch 어댑터 |
| `src/services/supabase/service-role.ts` → `createOncallWebhookRepository` | 멱등(processed_webhook_events, `posthog:` prefix) |

## 가동에 필요한 외부 설정 (체크리스트)

> 코드는 이미 green(lint/build/test). 아래는 **실제 운영에 붙이기 위한 아웃바운드 설정**이다.

### 1) GitHub repo Secrets
```
gh secret set ANTHROPIC_API_KEY     # claude-code-action(CI-fix·triage)용
```
- `ANTHROPIC_API_KEY` — GitHub Actions에서 에이전트가 쓴다(이미 code-review.yml도 사용).

### 2) Vercel 환경변수 (webhook route용)
- `ONCALL_WEBHOOK_SECRET` — PostHog destination과 공유하는 시크릿(Authorization: Bearer).
- `GH_DISPATCH_TOKEN` — `repository_dispatch` 권한이 있는 GitHub 토큰(fine-grained PAT: 대상 repo의 *Contents: read* + *Metadata* + **`repository_dispatch`가 포함된 권한**, 보통 *Actions: read/write* 또는 contents write. 최소권한은 PAT 생성 화면에서 "Dispatch" 검색).
- `GH_DISPATCH_REPO` — `jha0313/finsight` (owner/name).
- `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` — 멱등 테이블 쓰기(이미 Polar webhook이 사용 중일 것).

### 3) GitHub repo Settings (CI-fix가 PR을 열 수 있게)
- Settings → Actions → General → **"Allow GitHub Actions to create and approve pull requests"** 체크.
- (선택) escalation 이슈 라벨: `gh label create oncall -c FF6B6B -d "oncall 에이전트 escalation"` — 없어도 triage가 라벨 없이 제목 prefix `[oncall]`로 폴백한다.

### 4) PostHog error-tracking destination → webhook
- PostHog → 알림/Destination에서 **HTTP webhook**을 추가하고 URL을 배포된 `/api/webhook/posthog`로 지정.
- 커스텀 헤더 `Authorization: Bearer <ONCALL_WEBHOOK_SECRET>` 추가(2)에서 정한 값).
- 단건 에러 + spike(급증) alert 둘 다 이 destination으로 보낸다.

### 5) workflow_run 전제
- `ci.yml`·`oncall-ci-fix.yml`은 **main에 머지돼 있어야** workflow_run이 동작한다(GitHub은 기본 브랜치의 워크플로우만 추적).

## ③ Autopilot always-on 설계 (분리된 후속)

지금 동작하는 건 **두뇌**(`references/autopilot.md`) + **로컬 one-shot**이다. 아래는 그걸 24/7 상시 입구에 붙일 때의 설계로, **②triage와 동형**이다(같은 헤드리스 패턴). 이번 빌드 범위 밖 — 코드로 와이어링하지 않고 설계만 둔다.

```
[외부 유저]  인앱 지원 티켓 생성
  → /api/webhook/ticket (Vercel)  [후속: route 신설]
     └ 검증 + 멱등(processed_webhook_events, ticket: prefix)
     └ repository_dispatch(oncall-ticket)  ──▶  oncall-autopilot.yml [후속]
                                                 └ claude-code-action(헤드리스, autopilot.md 하네스)
                                                   → grounding(코드·PostHog·Supabase read-only·git)
                                                   → draft 생성 → 지원 인박스에 저장(발송 X)
                                                   → 사람이 검토·승인 후 발송

[내부 동료]  Discord/Slack 내부 채널 (또 다른 후속 입구) — 내부 답은 승인 게이트 없이 바로
```

**왜 동형인가:** ②와 똑같이 Vercel route는 **검증+멱등+dispatch**까지만, 실제 에이전트는 GitHub Actions 헤드리스에서 돈다. 차이는 **출구**다 — ②는 신호면 Issue로 사람을 깨우고, ③ 외부 유저는 **draft를 인박스에 저장**해 사람 승인을 거친다(자동 발송 절대 금지). 둘 다 read-only·escalation 게이트는 동일.

**후속에 필요한 것(지금 없음):** `ticket` webhook route + 멱등 prefix, `oncall-autopilot.yml`, 지원 인박스(draft 저장소), 인앱 티켓 시스템 연동. 게이트(draft→승인, DB read-only)는 **인프라가 아니라 하네스(`autopilot.md`)가 강제**하므로 입구만 바뀐다.

## 데모/검증 흐름

- **트리거 ① CI-fix**: 일부러 타입 에러가 있는 PR을 연다 → `ci.yml` red → `oncall-ci-fix.yml`이 `oncall/fix-<run_id>` 브랜치로 수정 PR을 연다 → `code-review.yml`이 리뷰. (자동 머지 안 됨 — 사람이 머지.)
- **트리거 ② triage**(인프라 없이 수동 테스트): Actions → `oncall-triage` → **Run workflow**에 테스트 payload JSON을 넣어 실행 → 신호면 `[oncall]` 이슈가 열리는지 확인. 실연결 후엔 PostHog가 보낸 webhook이 자동으로 깨운다.
- **트리거 ③ Autopilot**(로컬 one-shot): 터미널에서 oncall 스킬로 — **외부 유저**는 *"이 지원 티켓 뭐라고 답하지"*(→ draft만, 사람 승인 후 발송), **내부 동료**는 *"어젯밤 prod 왜 났어"*(→ 바로 답). 둘 다 코드·PostHog·Supabase read-only·git 근거. 워크드 예시·포맷: `references/autopilot.md`.

## 운영 주의 (skill의 references와 동일)
- **자동 머지 절대 금지** — CI-fix의 출력은 PR(사람 게이트).
- **봇 PR 무한루프 가드** — `oncall/*` 브랜치·봇 actor·포크가 트리거한 실패는 skip(이미 `if:`에 반영).
- **secret 노출** — 에이전트는 로그 원문이 아니라 분석 요약만 PR/이슈에 쓴다.
- **노이즈 필터** — 모든 에러에 escalation하면 alert fatigue. "안 깨우는 판단"이 절반의 가치. 경계에선 신호로 기울이되 확신도를 표기.
