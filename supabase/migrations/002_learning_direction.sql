-- =============================================================================
-- Vokabeltrainer – learning direction
--
-- Stores in which direction a card was asked:
--   forward = question (source language) shown, answer asked
--   reverse = answer (target language) shown, question asked
-- The counters on public.vocabulary stay shared for both directions; the
-- direction is kept in the answer history for later per-direction analysis.
--
-- Run once in the Supabase SQL editor after 001_initial_schema.sql.
-- =============================================================================

alter table public.learning_events
  add column direction text not null default 'forward'
  check (direction in ('forward', 'reverse'));

comment on column public.learning_events.direction is 'forward = source → target, reverse = target → source';

-- Replace record_answer with a version that accepts the direction.
-- The old signature is dropped so there is exactly one function (no ambiguous overloads).
drop function if exists public.record_answer(uuid, uuid, boolean, timestamptz);

create or replace function public.record_answer(
  p_event_id uuid,
  p_vocabulary_id uuid,
  p_was_correct boolean,
  p_answered_at timestamptz default now(),
  p_direction text default 'forward'
)
returns public.vocabulary
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_answered_at timestamptz := least(coalesce(p_answered_at, now()), now());
  v_inserted integer;
  v_row public.vocabulary;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  perform 1 from public.vocabulary
   where id = p_vocabulary_id and user_id = v_user_id;
  if not found then
    return null;
  end if;

  insert into public.learning_events (id, user_id, vocabulary_id, was_correct, created_at, direction)
  values (p_event_id, v_user_id, p_vocabulary_id, p_was_correct, v_answered_at, coalesce(p_direction, 'forward'))
  on conflict (id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    -- Already recorded (retry): return the current state without counting again.
    select * into v_row from public.vocabulary
     where id = p_vocabulary_id and user_id = v_user_id;
    return v_row;
  end if;

  update public.vocabulary
     set correct_count   = correct_count   + case when p_was_correct then 1 else 0 end,
         incorrect_count = incorrect_count + case when p_was_correct then 0 else 1 end,
         last_asked_at   = greatest(coalesce(last_asked_at, v_answered_at), v_answered_at)
   where id = p_vocabulary_id and user_id = v_user_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_answer(uuid, uuid, boolean, timestamptz, text) from public, anon;
grant execute on function public.record_answer(uuid, uuid, boolean, timestamptz, text) to authenticated;

-- Make the API (PostgREST) pick up the new function signature immediately.
notify pgrst, 'reload schema';
