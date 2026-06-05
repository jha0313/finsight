-- Fix: save_statement_analysis 의 "statement_id is ambiguous" 수정.
-- returns table 의 OUT 변수 statement_id 가 transactions insert 의
-- on conflict (statement_id, row_hash) 컬럼 참조와 충돌해 실행 시 실패하던 것을,
-- #variable_conflict use_column 으로 모호 시 컬럼을 우선해 해소한다.
-- create or replace 라 기존 권한(0003 grant)은 보존된다.

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
#variable_conflict use_column
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
