/*
# Extension namespace prerequisite

Supabase normally installs pgcrypto in `extensions`. Local PostgreSQL and some
older projects may have installed it in `public`. Security-definer functions
in the assistant migrations call extension functions with a qualified schema,
so normalize this relocatable extension first.
*/

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_schema text;
begin
  select n.nspname
  into v_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if v_schema is distinct from 'extensions' then
    alter extension pgcrypto set schema extensions;
  end if;
end
$$;
