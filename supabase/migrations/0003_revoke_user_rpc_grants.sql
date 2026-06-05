-- SECURITY DEFINER RPC의 외부 노출 차단.
-- public 스키마 함수는 생성 시 anon·authenticated에 EXECUTE가 default privilege로
-- '직접' grant된다. 0001/0002의 `revoke ... from public`은 PUBLIC 의사역할만
-- 제거할 뿐 이 직접 grant는 지우지 못해, RPC가 PostgREST `/rest/v1/rpc/*`로 외부에
-- 노출돼 있었다. 코드의 실제 호출 주체에 맞춰 역할별 EXECUTE를 잠근다.

-- upsert_subscription: 웹훅(service_role) 전용. 본문에 auth.uid() 강제가 없어
-- 일반 역할에 노출되면 임의 user_id를 active로 만들어 결제 없이 Pro를 우회할 수
-- 있다(서버측 게이팅 우회). anon·authenticated 직접 EXECUTE를 모두 제거한다.
revoke execute on function public.upsert_subscription(uuid, text, text, timestamptz, timestamptz)
  from anon, authenticated;

-- 아래 3개는 서버가 authenticated 세션으로 호출하고 본문에서 auth.uid() = p_user_id를
-- 강제하므로 실익 있는 우회는 없지만, anon EXECUTE는 불필요하고 어드바이저 WARN을
-- 유발하므로 defense-in-depth로 제거한다(authenticated 호출 경로는 유지).
revoke execute on function public.consume_ai_quota(uuid, date, int) from anon;
revoke execute on function public.release_ai_quota(uuid, date) from anon;
revoke execute on function public.save_statement_analysis(uuid, text, text, jsonb, jsonb) from anon;
