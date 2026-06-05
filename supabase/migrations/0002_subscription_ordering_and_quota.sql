-- 웹훅 순서 보장(event_ts 기반 조건부 upsert)과 일일 AI quota 원자 카운터를
-- 위한 추가 마이그레이션. (코드 리뷰 H4/M2/M3/L2 대응)

-- 구독 이벤트의 변경 시각. 순서 보장이 없는 Polar 웹훅에서 stale 이벤트가
-- 최신 상태를 덮어쓰지 않도록 조건부 upsert의 기준으로 쓴다.
alter table public.subscriptions
  add column if not exists event_ts timestamptz;

-- 조건부 구독 upsert: incoming event_ts가 기존보다 오래되었으면 갱신하지 않는다.
-- service_role 웹훅 경로 전용(RLS 우회). markEventProcessed와 분리된 호출이지만
-- upsert 자체가 멱등이며, 마킹을 이 upsert 성공 이후에 수행해 유실을 막는다.
create or replace function public.upsert_subscription(
  p_user_id uuid,
  p_polar_subscription_id text,
  p_status text,
  p_current_period_end timestamptz,
  p_event_ts timestamptz default null
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
    updated_at
  )
  values (
    p_user_id,
    p_polar_subscription_id,
    p_status,
    p_current_period_end,
    p_event_ts,
    now()
  )
  on conflict (user_id) do update
    set polar_subscription_id = excluded.polar_subscription_id,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        event_ts = excluded.event_ts,
        updated_at = now()
    where s.event_ts is null
       or excluded.event_ts is null
       or excluded.event_ts >= s.event_ts;
end;
$$;

revoke all on function public.upsert_subscription(uuid, text, text, timestamptz, timestamptz) from public;
grant execute on function public.upsert_subscription(uuid, text, text, timestamptz, timestamptz) to service_role;

-- 일일 AI quota 원자 소비: 단일 INSERT ... ON CONFLICT로 경합 없이 1건을
-- 소비하거나(count < quota), 한도 초과 시 false를 반환한다.
create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_usage_date date,
  p_quota int
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'consume_ai_quota user_id must match auth.uid()'
      using errcode = '42501';
  end if;

  insert into public.ai_usage_daily as u (user_id, usage_date, count)
  values (p_user_id, p_usage_date, 1)
  on conflict (user_id, usage_date) do update
    set count = u.count + 1
    where u.count < p_quota
  returning count into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, date, int) from public;
grant execute on function public.consume_ai_quota(uuid, date, int) to authenticated;

-- 완료되지 못한 Claude 호출(타임아웃·에러·fallback)에 소비된 quota 환불.
create or replace function public.release_ai_quota(
  p_user_id uuid,
  p_usage_date date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'release_ai_quota user_id must match auth.uid()'
      using errcode = '42501';
  end if;

  update public.ai_usage_daily
    set count = greatest(count - 1, 0)
    where user_id = p_user_id
      and usage_date = p_usage_date;
end;
$$;

revoke all on function public.release_ai_quota(uuid, date) from public;
grant execute on function public.release_ai_quota(uuid, date) to authenticated;
