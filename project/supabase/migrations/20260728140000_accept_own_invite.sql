/*
# Fix: invited team members can never actually join an org

## Bug
`invite-team-member` (Edge Function, supabase/functions/invite-team-member)
inserts a new `memberships` row with `status = 'invited'` when an owner
invites a staff member. Nothing anywhere ever transitions that row from
`'invited'` to `'active'` - `loadAccess()` in `src/lib/auth.tsx` only ever
looks up a `memberships` row filtered on `status = 'active'`. An invited
user who follows the Supabase invite email, sets a password, and signs in
therefore finds no active membership at all, and lands on
`CreateOrganization` ("set up your own dealership") instead of joining the
org they were actually invited to.

## Fix
`accept_own_invite()` - SECURITY DEFINER because RLS would not otherwise
let a newly-invited user touch their own row: `owner_update_memberships`
requires the *caller* to already be an active owner of that org, which an
invited-but-not-yet-active user, by definition, is not. Safety comes
entirely from scoping every update to `auth.uid()`'s own row(s) - a caller
can only ever accept their own pending invite(s), never anyone else's, and
never any other field. Called from `loadAccess()` in `src/lib/auth.tsx`
right after the "active membership" lookup comes back empty, before
falling through to the "no org" state.
*/

create or replace function public.accept_own_invite()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.memberships
  set status = 'active', joined_at = coalesce(joined_at, pg_catalog.now())
  where user_id = auth.uid() and status = 'invited';

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.accept_own_invite() from public, anon;
grant execute on function public.accept_own_invite() to authenticated;
