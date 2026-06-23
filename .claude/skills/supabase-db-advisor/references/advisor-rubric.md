# Supabase Advisor 루브릭 (finsight)

`get_advisors`가 내는 lint를 **4티어**로 분류하고, 티어별 처리·수정 SQL 패턴을 정의한다. 보안 WARN↑은 코드 교차분석을 거친다. finsight 고정 사실을 포함한다.

## 4 티어
| 티어 | 의미 | 적용 정책 |
|---|---|---|
| 🟢 auto | 동작 불변의 기계적 수정. 위험 ≈ 0 | 승인 시 파일+MCP 적용 |
| 🟡 judgment | 앱 맥락에 따라 정/오답이 갈림. 코드 교차분석 필수 | 코드 확인 후 제안, 승인 시 적용 |
| ⚙️ config | SQL로 못 고침(Auth/플랫폼 설정) | 수동 절차 안내(자동 적용 X) |
| ⚪ keep | 오탐 가능성 높거나 의도된 상태 | 적용 금지. 유지 근거 설명 |

## 공통 lint → 기본 티어 (목록에 없는 lint도 이 표로 추론)
| lint | cat | level | 기본 티어 | 처리 요지 |
|---|---|---|---|---|
| `auth_rls_initplan` | PERF | WARN | 🟢 auto | 정책의 `auth.x()` → `(select auth.x())` 래핑 |
| `function_search_path_mutable` | SEC | WARN | 🟢 auto | `ALTER FUNCTION … SET search_path = ''` |
| `policy_exists_rls_disabled` | SEC | ERROR | 🟢 auto | 정책은 있는데 RLS off → `ENABLE ROW LEVEL SECURITY` |
| `duplicate_index` | PERF | WARN | 🟡 judgment | 중복 인덱스 DROP — **파괴적**, 판단 후 파일만 |
| `unindexed_foreign_keys` | PERF | INFO | 🟡 judgment | FK 인덱스 추가(보통 이득, 쓰기비용·실사용 확인) |
| `multiple_permissive_policies` | PERF | WARN | 🟡 judgment | 정책 통합(의미 바뀔 수 있음 — 코드 확인) |
| `security_definer_view` | SEC | ERROR | 🟡 judgment | 뷰를 `security_invoker=on`으로 재정의 |
| `rls_disabled_in_public` | SEC | ERROR | 🟡 judgment | RLS 켜고 정책 추가 — **앱 깨질 수 있어 신중** |
| `authenticated_security_definer_function_executable` | SEC | WARN | 🟡 judgment | 아래 결정 트리 |
| `extension_in_public` | SEC | WARN | 🟡 judgment | 확장을 별도 스키마로 이동(의존성 확인) |
| `rls_references_user_metadata` | SEC | ERROR | 🟡 judgment | user_metadata는 변조 가능 — 정책 재설계 |
| `rls_enabled_no_policy` | SEC | INFO | ⚪ keep* | service_role 전용 테이블이면 의도된 deny-all |
| `unused_index` | PERF | INFO | ⚪ keep* | 저트래픽이면 오탐. 트래픽 근거 없으면 유지 |
| `auth_leaked_password_protection` | SEC | WARN | ⚙️ config | Auth 설정. 비번 로그인 없으면(OAuth 전용) N/A |
| `auth_insufficient_mfa_options` | SEC | WARN | ⚙️ config | Auth 설정(MFA) |
| `vulnerable_postgres_version` | SEC | WARN | ⚙️ config | 플랫폼 업그레이드(수동) |

\* `keep`는 **기본값이지 절대 규칙이 아니다** — 코드/맥락으로 진짜 갭이면 🟡/🟢로 승격하라.

---

## 티어별 수정 패턴

### 🟢 `auth_rls_initplan` — RLS 정책 함수 호출 캐싱
대규모에서 `auth.uid()`가 행마다 재평가되는 문제. **동작 불변**, 순수 성능 이득.

1. 현재 정책 정의 조회:
   ```sql
   select policyname, cmd, qual, with_check, roles, permissive
   from pg_policies
   where schemaname = 'public' and tablename = '<table>';
   ```
2. `qual`(USING)·`with_check` 안의 `auth.uid()`·`auth.jwt()`·`auth.role()`·`current_setting(...)`를 `(select auth.uid())` 형태로 **그것만** 감싼다. 정책 의미·`cmd`·`roles`·`permissive`는 그대로.
3. 재적용(USING/WITH CHECK 교체):
   ```sql
   alter policy "<policyname>" on public.<table>
     using ( <wrapped qual> )
     with check ( <wrapped with_check> );
   ```
   - `with_check`가 null이면 `with check` 절 생략. 정책이 여러 개면 각각 처리.
   - `(select auth.uid())`는 init-plan으로 1회 평가되어 행마다 재호출되지 않는다.

### 🟢 `function_search_path_mutable`
```sql
alter function public.<fn>(<args>) set search_path = '';
```
함수 본문이 비정규 스키마 객체를 참조하면 `set search_path = pg_catalog, public` 등으로 조정. 본문 schema-qualify 여부 확인.

### 🟡 `authenticated_security_definer_function_executable` — 결정 트리
SECURITY DEFINER 함수를 `authenticated`가 REST RPC로 호출 가능할 때. **인자에 식별자(`p_user_id` 등)가 있으면 IDOR 위험.** 반드시 함수 본문 + 호출부를 읽어라.

```
함수가 식별자 인자(p_user_id 등)를 받고 authenticated가 호출 가능한가?
├─ 본문이 소유권을 강제하는가? (p_user_id = auth.uid() 아니면 raise, 또는 내부에서 auth.uid()만 사용)
│   ├─ 예 → 안전. ⚪ keep. verdict에 "본문 L# 에서 소유권 검증" 근거. (SECURITY DEFINER 정당)
│   └─ 아니오 ↓
├─ 앱이 service_role(서버 전용)로만 호출하는가? (src/ grep — 누가 어떤 클라이언트로 호출하나)
│   ├─ 예 → 🟡 authenticated EXECUTE 회수:
│   │        revoke execute on function public.<fn>(<args>) from anon, authenticated;
│   │        (참고: public 함수는 anon/authenticated에 직접 grant됨 → from public revoke로는 안 막힘. [[supabase-rpc-grant-lockdown]])
│   └─ 아니오(클라이언트가 사용자 토큰으로 호출) ↓
└─ 🟡 하드닝: 본문 첫 줄에 소유권 가드 추가
        if p_user_id <> auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
      또는 인자 p_user_id 제거 후 본문에서 auth.uid() 사용(호출부 동반 수정 — 코드까지 보고 제안).
```
- 함수 재정의는 `create or replace function …`(시그니처 동일)로. 시그니처를 바꾸면 호출부·grant 영향 → judgment.

### 🟡 `rls_disabled_in_public` / `security_definer_view`
- `rls_disabled_in_public`: `alter table public.<t> enable row level security;` + **반드시** 적절한 정책 추가(없으면 deny-all로 앱이 깨진다). 소유권 모델(`auth.uid() = user_id`) 확인 후 정책 작성 → 승인.
- `security_definer_view`: `alter view public.<v> set (security_invoker = on);` (뷰 정의가 RLS를 우회하지 않도록).

### ⚪ `unused_index` — 저트래픽 오탐
`pg_stat_user_indexes.idx_scan = 0`은 "안 쓰임"이 아니라 "**아직** 조회가 없었음"일 수 있다. MVP/저트래픽이면 대부분 오탐.
- DROP 전 확인: 이 인덱스가 RLS `user_id` 필터·FK 조회·정렬을 받치는가? 받친다면 **유지**(트래픽 늘면 풀스캔으로 전락).
- 진짜 제거 대상은 "충분한 트래픽 기간에도 idx_scan=0 + 다른 인덱스로 대체됨"이 입증될 때뿐. 그때도 DROP은 파괴적 → 파일만, 수동 push.

### ⚪ `rls_enabled_no_policy`
RLS on + 정책 0 = **service_role 외 전원 deny**. 이게 의도면(쓰기 전용/내부 테이블) **안전한 상태**다.
- 테이블이 service_role로만 쓰이는가(웹훅·내부 카운터)? → 유지(verdict에 "deny-all 의도").
- 사용자 접근이 필요한 테이블인데 정책이 빠진 거면 → 🟡로 승격, 소유권 정책 추가.

### ⚙️ `auth_leaked_password_protection` / MFA / PG 업그레이드
SQL로 못 고친다. 수동 절차를 정확히 안내:
- **Leaked password protection**: Dashboard → Authentication → Policies(Password) → "Leaked password protection" 활성. 또는 Management API `PATCH /v1/projects/{ref}/config/auth` `{"password_hibp_enabled": true}`.
- **비번 로그인이 없으면(OAuth 전용) 사실상 N/A** — 우선순위 낮음으로 표기.
- **PG 업그레이드**: Dashboard → Settings → Infrastructure. 다운타임·호환성 사전 고지.

---

## Posture 판정
- 보안 ERROR ≥ 1 → **Action Required** (`red`)
- 보안 WARN ≥ 1 또는 성능 WARN ≥ 1 → **Hardening Recommended** (`amber`)
- WARN 0, INFO만 → **Healthy** (`green`)

---

## finsight 고정 사실 (티어 판정에 활용)
- **public 테이블**: `statements`·`transactions`·`analyses`·`subscriptions`·`ai_usage_daily`(사용자 소유, RLS `auth.uid() = user_id`) + `processed_webhook_events`(service_role 전용).
- `processed_webhook_events`의 `rls_enabled_no_policy` → **의도된 deny-all**. ⚪ keep.
- `*_user_id_idx`(각 사용자 테이블) → RLS `user_id` 필터·FK 받침. `unused_index`여도 ⚪ keep(저트래픽 오탐).
- **인증 = Google OAuth 전용**(비번 로그인 없음) → `auth_leaked_password_protection`은 ⚙️ config이지만 **사실상 N/A**.
- **SECURITY DEFINER RPC**: `consume_ai_quota`·`release_ai_quota`(쿼터 원자 카운터), `save_statement_analysis`(분석 저장 단일 트랜잭션) — 모두 `p_user_id` 인자 + `authenticated` 호출 가능. 결정 트리 적용: 본문이 `p_user_id`를 `auth.uid()`로 강제하는지(또는 service_role 전용 호출인지) **코드로 확인** 후 keep/하드닝/revoke 결정. (이미 잠근 `upsert_subscription` 계열과 동일 주제 — [[supabase-rpc-grant-lockdown]].)
