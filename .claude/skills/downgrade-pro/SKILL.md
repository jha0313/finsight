---
name: downgrade-pro
description: finsight 테스트 계정의 Pro 구독을 Free로 강제 다운그레이드하는 스킬. Polar 구독을 즉시 revoke 하고 Supabase `subscriptions` 행을 비활성으로 갱신해 Pro 게이팅을 떨어뜨린다. "구독 다운그레이드", "pro 다운그레이드", "pro에서 free로", "pro 내려줘", "구독 취소(테스트)", "pro 해지", "downgrade pro", "downgrade to free", "다시 free로", "구독 초기화" 같은 요청에 트리거. Pro→Free 전환을 반복 검증할 때 사용한다.
user-invocable: true
---

finsight 테스트 계정을 **Pro→Free로 강제 다운그레이드**한다. Pro 결제 흐름을 반복 테스트할 때, 매번 깨끗한 Free 상태로 되돌리는 도구.

## 무엇을 하는가

`scripts/downgrade-pro.mjs` 한 방으로 두 시스템을 동시에 내린다:

1. **Polar**: `subscriptions.revoke()` — 구독 즉시 취소(sandbox)
2. **Supabase**: `subscriptions` 행을 `status=canceled`, `current_period_end=now`, `event_ts=now`로 갱신 (서비스롤, RLS 우회)

게이팅 판정은 `status='active' AND current_period_end > now()` **두 조건 AND**(`src/services/supabase/index.ts`). `status`만 깨도 Free로 떨어지며, `event_ts`를 올려 두면 뒤늦게 도착하는 stale active 웹훅의 재활성 upsert도 막힌다.

## 실행

```bash
node scripts/downgrade-pro.mjs --list          # 변경 없이 현재 구독 상태만 출력 (먼저 이걸로 확인)
node scripts/downgrade-pro.mjs                  # status='active'인 모든 구독을 다운그레이드
node scripts/downgrade-pro.mjs jaeha3510@gmail.com   # 이메일로 한 명만
node scripts/downgrade-pro.mjs <user_id-uuid>        # uuid로 한 명만
```

- `.env`를 자동 로드한다(프로젝트 루트 어디서 실행해도 상위 탐색). 별도 export 불필요.
- 자격증명: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_SERVER`.
- 멱등하다 — 이미 취소된 구독은 Polar "이미 취소됨 (skip)"으로 넘어가고 DB만 다시 맞춘다.
- 마지막에 대상 행을 재조회해 **모두 `is_active_pro=false`인지 검증**하고 `✅ 완료`를 찍는다.

## 권장 절차

1. `node scripts/downgrade-pro.mjs --list` 로 누가 Pro인지 확인.
2. `node scripts/downgrade-pro.mjs <email>` 로 대상만 콕 집어 다운그레이드(무인자 전체 실행은 활성 구독이 여럿일 때 주의).
3. 출력의 `✅ 완료` 확인. 미심쩍으면 다시 `--list`.

## 주의 / 함정

- **배포 웹훅이 DB를 되돌리는 것처럼 보일 수 있다.** Polar revoke가 실제 `subscription.canceled` 웹훅을 쏘면, 배포된 엔드포인트가 `current_period_end`를 Polar의 원래 기간값(미래)으로 다시 써넣는다. 하지만 같은 웹훅이 `status=canceled`도 세팅하므로 게이팅은 여전히 Free다 — `period_end`가 미래여도 정상이다. **판정 기준은 `status`다.**
- **다운그레이드만 한다.** 다시 Pro로 올리려면 정상 결제 흐름(`/api/checkout` → Polar 결제)을 타거나, 테스트라면 Polar 대시보드에서 구독을 재생성한다.
- Polar revoke가 네트워크 등으로 실패해도 DB 갱신은 계속 진행한다(`⚠` 경고 후 진행). 이 경우 Polar와 DB가 일시적으로 어긋날 수 있으니 경고가 보이면 재실행한다.
- 운영 DB가 아니라 **테스트/sandbox 전용**으로 쓸 것. service_role 키로 RLS를 우회해 직접 쓴다.

## 관련 코드

- 구독 스키마: `supabase/migrations/0001_init.sql` (`public.subscriptions`)
- 게이팅 판정: `src/services/supabase/index.ts` (`getSubscriptionSummary`, `createSubscriptionGateway`)
- 웹훅 동기화: `src/services/polar/index.ts` (`toSubscriptionUpsert`), `src/lib/orchestration/index.ts` (`runPolarWebhookRequest`)
