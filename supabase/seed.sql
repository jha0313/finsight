-- finsight seed — 브랜치/로컬 전용 합성 데이터
-- ============================================================================
-- CRITICAL: 100% 합성 데이터. 실제 PAN/계좌/이메일 절대 금지.
--   - 카드/계좌는 마스킹 형태(****1234)만, 전체값 평문 저장 금지.
--   - 이메일은 *.test 도메인(실제로 닿지 않는 예약 TLD).
-- 이 파일은 브랜치가 데이터 0으로 시작하므로 데모/테스트용 데이터를 채운다.
-- 프로덕션 데이터 복제가 아니다(브랜칭은 데이터를 복사하지 않는다).
--
-- 멱등: Seed 단계는 커밋마다 재실행되므로 모든 INSERT는 ON CONFLICT DO NOTHING.
--
-- 데모 계정(브랜치에서 이메일 로그인):
--   free@finsight.test / finsight-demo   (구독 없음 = Free)
--   pro@finsight.test  / finsight-demo   (status=active, 기간 미래 = Pro)
-- ============================================================================

set search_path = public, extensions, auth;

-- 고정 UUID(멱등·참조 일관성).
-- 11..11 = Free 데모, 22..22 = Pro 데모.

-- 1) auth 유저 2명 -----------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'free@finsight.test',
   crypt('finsight-demo', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Free"}',
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'pro@finsight.test',
   crypt('finsight-demo', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Pro"}',
   '', '', '', '')
on conflict do nothing;

-- 이메일/비번 로그인이 되도록 identities도 채운다.
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values
  ('11111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"free@finsight.test"}',
   'email', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"pro@finsight.test"}',
   'email', now(), now(), now())
on conflict do nothing;

-- 2) statements (고정 id로 transactions가 참조) --------------------------------
insert into public.statements (id, user_id, status, source_hash, created_at)
values
  ('5acef111-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'ready', 'seed-free-stmt-2026-06', now()),
  ('5acef222-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'ready', 'seed-pro-stmt-2026-06', now())
on conflict do nothing;

-- 3) transactions — 합성. 부호 규약: 지출 양수 / 입금·환불 음수 --------------------
-- Free 데모: 일상 카드 지출 + 구독 + 환불 1건
insert into public.transactions (
  statement_id, user_id, txn_date, merchant, signed_amount, direction,
  category, masked_account, currency, row_hash
)
values
  ('5acef111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   '2026-06-01', 'Whole Foods Market',   84.20, 'debit',  'Food',         '****1234', 'USD', 'seed-free-001'),
  ('5acef111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   '2026-06-03', 'Uber',                 23.50, 'debit',  'Transport',    '****1234', 'USD', 'seed-free-002'),
  ('5acef111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   '2026-06-05', 'Netflix',              15.49, 'debit',  'Subscription', '****1234', 'USD', 'seed-free-003'),
  ('5acef111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   '2026-06-07', 'Spotify',               9.99, 'debit',  'Subscription', '****1234', 'USD', 'seed-free-004'),
  ('5acef111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   '2026-06-10', 'Amazon',              132.00, 'debit',  'Shopping',     '****1234', 'USD', 'seed-free-005'),
  ('5acef111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   '2026-06-12', 'Amazon Refund',       -41.30, 'refund', 'Shopping',     '****1234', 'USD', 'seed-free-006')
on conflict do nothing;

-- Pro 데모: 입금(급여) + 더 넓은 카테고리 + 환불 1건
insert into public.transactions (
  statement_id, user_id, txn_date, merchant, signed_amount, direction,
  category, masked_account, currency, row_hash
)
values
  ('5acef222-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
   '2026-06-02', 'Payroll ACME Corp', -5200.00, 'credit', 'Income',       '****5678', 'USD', 'seed-pro-001'),
  ('5acef222-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
   '2026-06-02', 'Blue Bottle Coffee',    6.75, 'debit',  'Food',         '****5678', 'USD', 'seed-pro-002'),
  ('5acef222-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
   '2026-06-04', 'Shell Gas',            58.40, 'debit',  'Transport',    '****5678', 'USD', 'seed-pro-003'),
  ('5acef222-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
   '2026-06-06', 'Adobe Creative Cloud', 54.99, 'debit',  'Subscription', '****5678', 'USD', 'seed-pro-004'),
  ('5acef222-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
   '2026-06-06', 'AWS',                 213.77, 'debit',  'Software',     '****5678', 'USD', 'seed-pro-005'),
  ('5acef222-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
   '2026-06-09', 'Costco',              287.65, 'debit',  'Shopping',     '****5678', 'USD', 'seed-pro-006'),
  ('5acef222-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
   '2026-06-11', 'Delta Airlines',      642.30, 'debit',  'Travel',       '****5678', 'USD', 'seed-pro-007'),
  ('5acef222-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
   '2026-06-14', 'United Refund',      -120.00, 'refund', 'Travel',       '****5678', 'USD', 'seed-pro-008')
on conflict do nothing;

-- 4) analyses — 캐시된 AI 결과(합성 jsonb). Free=Sonnet / Pro=Opus -------------
insert into public.analyses (user_id, input_hash, model, result, created_at)
values
  ('11111111-1111-1111-1111-111111111111', 'seed-free-analysis-2026-06', 'claude-sonnet-4-6',
   '{"summary":"6월 지출은 식비·구독이 중심. 환불 1건 반영.","categoryBreakdown":[{"category":"Food","total":84.20},{"category":"Transport","total":23.50},{"category":"Subscription","total":25.48},{"category":"Shopping","total":90.70}],"insights":["구독 2건(Netflix·Spotify)으로 월 25.48 고정 지출"],"anomalies":[]}'::jsonb,
   now()),
  ('22222222-2222-2222-2222-222222222222', 'seed-pro-analysis-2026-06', 'claude-opus-4-8',
   '{"summary":"급여 입금 대비 지출 건전. 여행·소프트웨어 비중 높음.","categoryBreakdown":[{"category":"Food","total":6.75},{"category":"Transport","total":58.40},{"category":"Subscription","total":54.99},{"category":"Software","total":213.77},{"category":"Shopping","total":287.65},{"category":"Travel","total":522.30}],"insights":["여행 지출이 환불 후 순 522.30","AWS 213.77은 전월 대비 점검 권장"],"anomalies":[{"merchant":"Delta Airlines","amount":642.30,"reason":"단건 고액"}]}'::jsonb,
   now())
on conflict do nothing;

-- 5) subscriptions — Pro 데모만 active(기간 미래). Free는 행 없음(=Free) ----------
insert into public.subscriptions (
  user_id, polar_subscription_id, status, current_period_end,
  event_ts, cancel_at_period_end, updated_at
)
values
  ('22222222-2222-2222-2222-222222222222', 'sub_seed_pro_demo', 'active',
   now() + interval '20 days', now(), false, now())
on conflict do nothing;

-- 6) ai_usage_daily — 오늘자 사용량 약간(quota 카운터 동작 확인용) -----------------
insert into public.ai_usage_daily (user_id, usage_date, count)
values
  ('11111111-1111-1111-1111-111111111111', current_date, 1),
  ('22222222-2222-2222-2222-222222222222', current_date, 3)
on conflict do nothing;
