create or replace function public.enforce_membership_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.org_id is distinct from old.org_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Membership organization and user are immutable';
  end if;

  if old.role = 'owner' and old.status = 'active' and (
    tg_op = 'DELETE'
    or new.role <> 'owner'
    or new.status <> 'active'
  ) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(old.org_id::text, 64193)
    );
    if not exists (
      select 1
      from public.memberships m
      where m.org_id = old.org_id
        and m.id <> old.id
        and m.role = 'owner'
        and m.status = 'active'
    ) then
      raise exception using
        errcode = '23514',
        message = 'An organization must retain at least one active owner';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_membership_integrity()
  from public, anon, authenticated;

drop trigger if exists trg_membership_integrity on public.memberships;
create trigger trg_membership_integrity
  before update or delete on public.memberships
  for each row
  execute function public.enforce_membership_integrity();

comment on function public.enforce_membership_integrity() is
  'Keeps membership identity immutable and prevents concurrent removal of the last active organization owner.';
