-- auth_rls_initplan: RLS 정책의 auth.uid()를 (select auth.uid())로 래핑.
-- 행별 재평가 → init-plan 1회 평가로 전환(동작 불변, 대규모 성능 개선).
-- 소스: Supabase advisor lint 0003 (performance). 5개 사용자 소유 테이블.
-- 적용: 2026-06-22 supabase-db-advisor 스킬 (MCP apply_migration).

alter policy "statements_owner_access" on public.statements
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "transactions_owner_access" on public.transactions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "analyses_owner_access" on public.analyses
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "subscriptions_owner_access" on public.subscriptions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "ai_usage_daily_owner_access" on public.ai_usage_daily
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
