/*
# Self-serve organization creation

## Overview
Until now the only organization was the one seeded in 20260727090000 -
there was no path for a brand-new signup to ever get their own
dealership; they'd hit the "no access" dead end forever unless someone
else invited them. This adds an optional self-serve path: a signed-up
user with no membership and no partner link can create their own
organization and immediately becomes its `owner`.

This is deliberately optional and secondary to the invite flow - most
users of a given dealership will still be invited by their Owner. This
is for a brand-new dealer with nobody to invite them yet.

## `create_organization(p_name)`
SECURITY DEFINER so it can insert into `organizations`/`memberships`
regardless of RLS (there's still no client-facing INSERT policy on
either table - only this function, and the invite Edge Function, can
create rows in them). Safety comes entirely from using `auth.uid()`
internally rather than trusting any caller-supplied id: a caller can
only ever create a new org and make *themselves* its owner, never join
an existing one or act as anyone else. Slug is derived from the name
and auto-suffixed on collision.

## organizations SELECT policy
Widened to also let a partner-linked user read their own org's row
(previously only staff `memberships` could) - needed so the Partner
Portal can show the dealership's name too.
*/

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix int := 0;
  v_email text;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'Organization name is required';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'Must be signed in to create an organization';
  end if;

  v_base_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then
    v_base_slug := 'dealership';
  end if;
  v_slug := v_base_slug;

  loop
    begin
      insert into organizations (name, slug, status) values (trim(p_name), v_slug, 'active') returning id into v_org_id;
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '-' || v_suffix;
      if v_suffix > 50 then
        raise exception 'Could not generate a unique organization slug';
      end if;
    end;
  end loop;

  insert into memberships (org_id, user_id, role, status, email, joined_at)
  values (v_org_id, auth.uid(), 'owner', 'active', v_email, now());

  return v_org_id;
end;
$$;

grant execute on function public.create_organization(text) to authenticated;

drop policy if exists "select_own_org" on public.organizations;
create policy "select_own_org" on public.organizations for select to authenticated
  using (
    is_org_member(id)
    or exists (select 1 from public.partners p where p.org_id = organizations.id and p.auth_user_id = auth.uid())
  );
