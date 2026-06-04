create extension if not exists pgcrypto;

create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('ready', 'failed')),
  source_hash text not null,
  created_at timestamptz not null default now(),
  unique(user_id, source_hash)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.statements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  txn_date date not null,
  merchant text not null,
  signed_amount numeric(14,2) not null,
  direction text not null check (direction in ('debit', 'credit', 'refund')),
  category text not null,
  masked_account text,
  currency text not null,
  row_hash text not null,
  unique(statement_id, row_hash)
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_hash text not null,
  model text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id, input_hash)
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  polar_subscription_id text,
  status text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.processed_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

comment on table public.processed_webhook_events is
  'RLS is enabled without authenticated policies because webhook idempotency writes use service_role, which bypasses RLS.';

create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  count int not null default 0 check (count >= 0),
  primary key (user_id, usage_date)
);

create index if not exists statements_user_id_idx on public.statements(user_id);
create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists analyses_user_id_idx on public.analyses(user_id);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists ai_usage_daily_user_id_idx on public.ai_usage_daily(user_id);

alter table public.statements enable row level security;
alter table public.transactions enable row level security;
alter table public.analyses enable row level security;
alter table public.subscriptions enable row level security;
alter table public.processed_webhook_events enable row level security;
alter table public.ai_usage_daily enable row level security;

create policy statements_owner_access
  on public.statements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy transactions_owner_access
  on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy analyses_owner_access
  on public.analyses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy subscriptions_owner_access
  on public.subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy ai_usage_daily_owner_access
  on public.ai_usage_daily
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.save_statement_analysis(
  p_user_id uuid,
  p_statement_source_hash text,
  p_statement_status text,
  p_transactions jsonb,
  p_analysis jsonb default null
)
returns table (
  statement_id uuid,
  inserted_transaction_count int,
  analysis_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_statement_id uuid;
  v_analysis_id uuid;
  v_inserted_transaction_count int := 0;
  v_auth_uid uuid := auth.uid();
  v_analysis_input_hash text;
begin
  if v_auth_uid is null or v_auth_uid <> p_user_id then
    raise exception 'save_statement_analysis user_id must match auth.uid()'
      using errcode = '42501';
  end if;

  if p_statement_status not in ('ready', 'failed') then
    raise exception 'invalid statement status: %', p_statement_status
      using errcode = '22000';
  end if;

  if p_transactions is null or jsonb_typeof(p_transactions) <> 'array' then
    raise exception 'transactions must be a json array'
      using errcode = '22000';
  end if;

  insert into public.statements (user_id, status, source_hash)
  values (p_user_id, p_statement_status, p_statement_source_hash)
  on conflict (user_id, source_hash) do nothing
  returning id into v_statement_id;

  if v_statement_id is null then
    select s.id
      into v_statement_id
      from public.statements as s
      where s.user_id = p_user_id
        and s.source_hash = p_statement_source_hash;
  end if;

  with inserted_transactions as (
    insert into public.transactions (
      statement_id,
      user_id,
      txn_date,
      merchant,
      signed_amount,
      direction,
      category,
      masked_account,
      currency,
      row_hash
    )
    select
      v_statement_id,
      p_user_id,
      t."date"::date,
      t.merchant,
      coalesce(nullif(t."signedAmount", ''), nullif(t.signed_amount, ''))::numeric(14,2),
      t.direction,
      t.category,
      nullif(coalesce(t."maskedAccount", t.masked_account), ''),
      t.currency,
      coalesce(nullif(t."rowHash", ''), nullif(t.row_hash, ''))
    from jsonb_to_recordset(p_transactions) as t(
      "date" text,
      merchant text,
      "signedAmount" text,
      signed_amount text,
      direction text,
      category text,
      "maskedAccount" text,
      masked_account text,
      currency text,
      "rowHash" text,
      row_hash text
    )
    on conflict (statement_id, row_hash) do nothing
    returning 1
  )
  select count(*) into v_inserted_transaction_count
    from inserted_transactions;

  if p_analysis is not null then
    v_analysis_input_hash := coalesce(
      nullif(p_analysis ->> 'inputHash', ''),
      nullif(p_analysis ->> 'input_hash', '')
    );

    insert into public.analyses (user_id, input_hash, model, result)
    values (
      p_user_id,
      v_analysis_input_hash,
      p_analysis ->> 'model',
      p_analysis -> 'result'
    )
    on conflict (user_id, input_hash) do nothing
    returning id into v_analysis_id;

    if v_analysis_id is null then
      select a.id
        into v_analysis_id
        from public.analyses as a
        where a.user_id = p_user_id
          and a.input_hash = v_analysis_input_hash;
    end if;
  end if;

  return query
    select v_statement_id, v_inserted_transaction_count, v_analysis_id;
end;
$$;

revoke all on function public.save_statement_analysis(uuid, text, text, jsonb, jsonb) from public;
grant execute on function public.save_statement_analysis(uuid, text, text, jsonb, jsonb) to authenticated;
