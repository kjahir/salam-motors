/*
# Multilingual intent classification for Ask Salam

## Why
The prefetch that lets a turn start with evidence instead of a routing round matches English
keywords. Five of the six supported locales therefore never match, and every question from
those users pays a full model round (~3.4s measured) purely to be told which tool to call.
Patterns cannot fix this: a Tamil question shares no characters with an English one.

This stores example questions per intent, in every locale, embedded into a shared vector
space. An incoming question is embedded and matched by cosine distance, so "எந்த பைக்குகள்
விற்கப்படவில்லை" reaches the same intent as "which bikes are unsold".

## Design notes
Embeddings are 384-dimensional (gte-small, the model built into Supabase Edge Runtime) and
are computed lazily by the edge function, not here — a migration cannot call a model. Rows
are seeded with a NULL embedding and filled on first use; `idx_assistant_intent_pending`
makes finding the unfilled ones cheap.

Matching only ever *adds* a prefetch. A wrong match costs one read the model can ignore, so
this table can never change an answer — only how quickly one arrives.

## Data handling
Creates one new table of reference phrases. No business data, no user content, no existing
table touched. The phrases are authored here, not derived from anything users typed.
*/

create extension if not exists vector with schema extensions;

create table if not exists public.assistant_intent_examples (
  id bigint generated always as identity primary key,
  -- Must match a PrefetchPlan intent in prefetch.ts. Unmatched values are ignored by the
  -- edge function rather than erroring, so a stale row degrades to "no prefetch".
  intent text not null check (char_length(intent) between 1 and 60),
  locale text not null check (char_length(locale) between 2 and 10),
  phrase text not null check (char_length(phrase) between 3 and 300),
  embedding extensions.vector(384),
  created_at timestamptz not null default now(),
  unique (intent, locale, phrase)
);

create index if not exists idx_assistant_intent_pending
  on public.assistant_intent_examples (id) where embedding is null;

create index if not exists idx_assistant_intent_embedding
  on public.assistant_intent_examples
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.assistant_intent_examples enable row level security;

/*
No policy for `authenticated`: these are server-side routing hints with no per-org content,
and nothing in the client needs them. Only the edge function's service role reads or writes.
*/
revoke all on table public.assistant_intent_examples from public, anon, authenticated;
grant all on table public.assistant_intent_examples to service_role;
grant usage, select on sequence public.assistant_intent_examples_id_seq to service_role;

comment on table public.assistant_intent_examples is
  'Example questions per Ask Salam prefetch intent, in every supported locale, for embedding-based intent matching. Reference data only - contains no user or business content.';
comment on column public.assistant_intent_examples.embedding is
  'gte-small (384d), computed lazily by the assistant-turn edge function. NULL means not yet embedded.';

/*
Nearest example above a similarity threshold.

Returns the intent rather than the row: the caller needs a label, and exposing phrases would
invite treating them as content. `security definer` because the table is service-role only
and this is the single supported read path.
*/
create or replace function public.match_assistant_intent(
  query_embedding extensions.vector(384),
  similarity_threshold double precision default 0.72
)
returns table (intent text, similarity double precision, locale text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    e.intent,
    1 - (e.embedding <=> query_embedding) as similarity,
    e.locale
  from public.assistant_intent_examples e
  where e.embedding is not null
    and 1 - (e.embedding <=> query_embedding) >= similarity_threshold
  order by e.embedding <=> query_embedding
  limit 1;
$$;

revoke all on function public.match_assistant_intent(extensions.vector, double precision)
  from public, anon, authenticated;
grant execute on function public.match_assistant_intent(extensions.vector, double precision)
  to service_role;
