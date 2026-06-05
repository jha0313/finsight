-- 기간 말 취소(cancel at period end) 추적. Polar에서 "기간 말 취소"를 예약하면
-- 구독은 status=active로 유지되고 cancel_at_period_end=true가 된다. 게이팅
-- (status active AND current_period_end > now)은 기간 종료까지 Pro를 유지하지만,
-- UI에 "현재 기간 종료 후 Free 전환 예정"을 보여주려면 이 플래그가 필요하다.
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

-- upsert_subscription에 p_cancel_at_period_end를 추가한다. 파라미터가 늘어 시그니처가
-- 바뀌므로 기존 5-인자 함수를 drop하고 재생성한다(웹훅 경로는 6-인자 버전을 호출).
drop function if exists public.upsert_subscription(uuid, text, text, timestamptz, timestamptz);

create or replace function public.upsert_subscription(
  p_user_id uuid,
  p_polar_subscription_id text,
  p_status text,
  p_current_period_end timestamptz,
  p_event_ts timestamptz default null,
  p_cancel_at_period_end boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.subscriptions as s (
    user_id,
    polar_subscription_id,
    status,
    current_period_end,
    event_ts,
    cancel_at_period_end,
    updated_at
  )
  values (
    p_user_id,
    p_polar_subscription_id,
    p_status,
    p_current_period_end,
    p_event_ts,
    p_cancel_at_period_end,
    now()
  )
  on conflict (user_id) do update
    set polar_subscription_id = excluded.polar_subscription_id,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        event_ts = excluded.event_ts,
        cancel_at_period_end = excluded.cancel_at_period_end,
        updated_at = now()
    where s.event_ts is null
       or excluded.event_ts is null
       or excluded.event_ts >= s.event_ts;
end;
$$;

-- drop+recreate한 새 함수는 Supabase default privilege로 anon·authenticated에
-- EXECUTE가 '직접' grant된다. PUBLIC 제거만으로는 그 직접 grant가 남아 RPC가
-- PostgREST로 외부 노출되고, 본문에 auth.uid() 강제가 없어 결제 없이 Pro를
-- 우회할 수 있다(0003과 동일 이유). anon·authenticated EXECUTE를 명시 제거하고
-- 웹훅 경로(service_role)에만 허용한다.
revoke all on function public.upsert_subscription(uuid, text, text, timestamptz, timestamptz, boolean) from public;
revoke execute on function public.upsert_subscription(uuid, text, text, timestamptz, timestamptz, boolean)
  from anon, authenticated;
grant execute on function public.upsert_subscription(uuid, text, text, timestamptz, timestamptz, boolean) to service_role;
