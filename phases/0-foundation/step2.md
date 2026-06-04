# Step 2: db-migrations

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "DB 스키마 (요약)" 섹션(테이블·유니크키·RLS·RPC·cascade)과 "보안 & 프라이버시"
- `/docs/ADR.md` — ADR-002(동기 처리 + RPC 단일 트랜잭션), ADR-005(웹훅 멱등·구독 진실원천), ADR-009(마스킹·hash), ADR-007(profiles/categories 테이블 없음)
- `/AGENTS.md` — RLS `auth.uid()=user_id`, 금액 numeric, RPC 단일 트랜잭션, 웹훅 멱등 CRITICAL 규칙
- step 1 산출물: `src/types/`(테이블 컬럼이 도메인 타입과 일치해야 함 — direction·signed_amount·masked_account·각종 hash)

## 작업

Supabase 마이그레이션 SQL을 **작성만** 한다(적용·push 금지). 파일 위치: `supabase/migrations/0001_init.sql`(필요 시 분할). 순수 `.sql`만 만들며 TS 코드는 건드리지 않는다.

### 테이블 (ARCHITECTURE.md 스키마 요약 기준)

1. `statements` — `id uuid pk`, `user_id uuid references auth.users(id) on delete cascade`, `status text check (status in ('ready','failed'))`, `source_hash text`, `created_at timestamptz default now()`, **`unique(user_id, source_hash)`**.
2. `transactions` — `id uuid pk`, `statement_id uuid references statements(id) on delete cascade`, `user_id uuid references auth.users(id) on delete cascade`, `txn_date date`, `merchant text`, `signed_amount numeric(14,2)`, `direction text check (direction in ('debit','credit','refund'))`, `category text`, `masked_account text`, `currency text`, `row_hash text`, **`unique(statement_id, row_hash)`**.
3. `analyses` — `id uuid pk`, `user_id uuid references auth.users(id) on delete cascade`, `input_hash text`, `model text`, `result jsonb`, `created_at timestamptz default now()`, **`unique(user_id, input_hash)`**.
4. `subscriptions` — `user_id uuid primary key references auth.users(id) on delete cascade`, `polar_subscription_id text`, `status text`, `current_period_end timestamptz`, `updated_at timestamptz default now()`.
5. `processed_webhook_events` — `event_id text primary key`, `processed_at timestamptz default now()`. (웹훅 멱등용; user_id 없음 — 아래 RLS 주석 참고)
6. `ai_usage_daily` — `user_id uuid references auth.users(id) on delete cascade`, `usage_date date`, `count int not null default 0`, **`primary key (user_id, usage_date)`**(= `unique(user_id, usage_date)`).

### RLS

- 위 모든 테이블에 `alter table ... enable row level security;`.
- `user_id`를 가진 테이블(statements·transactions·analyses·subscriptions·ai_usage_daily): 정책을 **`auth.uid() = user_id`**(subscriptions/ai_usage_daily는 `auth.uid() = user_id`)로 select/insert/update/delete를 제한한다.
- `processed_webhook_events`: user_id가 없다. RLS는 enable하되 authenticated용 정책을 만들지 마라(웹훅 모듈이 **service_role**로 접근하며 service_role은 RLS를 우회한다). 주석으로 그 의도를 남겨라.
- 각 `user_id` 컬럼에 인덱스를 만든다.

### RPC — `save_statement_analysis`

- `create or replace function save_statement_analysis(...) returns ... language plpgsql security definer ...`
- **단일 트랜잭션**으로 statement insert → transactions 다중 insert → (있으면) analysis insert를 묶는다. 함수 본문은 원자적이므로 중간 실패 시 전체 rollback된다.
- transactions insert는 dedup을 위해 **`on conflict (statement_id, row_hash) do nothing`**.
- analyses insert는 **`on conflict (user_id, input_hash) do nothing`**(캐시 키).
- `security definer`라도 입력 `user_id`가 `auth.uid()`와 일치하는지 함수 내부에서 검증해 RLS 우회를 막아라(틀리면 raise exception).
- 입력 시그니처(파라미터 형태)는 재량이되, step 1의 `SaveStatementAnalysisInput`(statement.source_hash/status, transactions[], analysis{input_hash,model,result})과 개념적으로 일치시켜라.

### 핵심 규칙 (벗어나지 마라)

- **금액은 `numeric(14,2)`** — float/real/double 금지. 이유: CRITICAL 정합성.
- **전 테이블 RLS** + **전 체인 `on delete cascade`**(auth.users → statements → transactions, 그리고 user_id FK들).
- 유니크키 4종을 정확히: `statements(user_id,source_hash)`, `transactions(statement_id,row_hash)`, `analyses(user_id,input_hash)`, `ai_usage_daily(user_id,usage_date)`.
- **forward-only 마이그레이션** — `drop table`/`drop schema` 등 파괴적 구문을 쓰지 마라. 이유: (1) 마이그레이션은 전진만 (2) dangerous-command 가드가 `DROP TABLE`을 차단한다. 멱등이 필요하면 `create table if not exists` / `create or replace function`을 써라.

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test   # SQL만 추가 — 기존 green 유지

# SQL 내용 점검 (forward-only · 핵심 구조 존재)
test "$(grep -ci 'create table' supabase/migrations/*.sql)" -ge 6
grep -qi 'enable row level security' supabase/migrations/*.sql
grep -qi 'numeric(14,2)' supabase/migrations/*.sql
grep -qi 'save_statement_analysis' supabase/migrations/*.sql
grep -qi 'on delete cascade' supabase/migrations/*.sql
! grep -qiE 'drop[[:space:]]+table' supabase/migrations/*.sql   # 파괴적 구문 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 6개 테이블 + 유니크키 4종 + 전 테이블 RLS가 있는가?
   - `save_statement_analysis` RPC가 단일 트랜잭션 + `on conflict do nothing` dedup인가?
   - `signed_amount numeric(14,2)`, `direction` check, cascade FK가 맞는가?
   - SQL만 추가했고 TS/빌드는 green인가?
3. 결과에 따라 `phases/0-foundation/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 마이그레이션 파일·테이블·RPC 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- `supabase db push`·`supabase link`·실제 DB 연결을 시도하지 마라. 이유: 자격증명이 비어 있어 실패/blocked된다. MVP는 SQL 작성만(적용은 수동).
- `drop table` 등 파괴적 구문을 쓰지 마라. 이유: forward-only + dangerous-command 가드 차단.
- Supabase 클라이언트 어댑터·TS 코드를 작성하지 마라. 이유: 다음 페이즈(core-loop) 범위.
- `profiles`·`categories` 테이블을 만들지 마라. 이유: ADR-007 — user_id는 auth.users 직접 FK, category는 코드 상수 union.
- 기존 테스트를 깨뜨리지 마라.
