/*
# Multi-organization membership schema

## Overview
First step of converting the app from single-user data ownership (every
table scoped by `auth.uid() = user_id`) to multi-organization, role-based
access. This migration is purely additive: it introduces `organizations`
and `memberships`, plus the helper functions later migrations/policies will
call, and seeds one organization + one owner membership for the existing
account. No existing table's RLS is touched here.

## New Tables
1. `organizations` - a dealership tenant
2. `memberships` - links an auth user to an organization with a role

## New Functions
- `current_org_id()` - the calling user's active org (assumes one active
  membership per user; see note below)
- `is_org_member(org_id, roles[])` - membership + optional role check,
  used by every RLS policy from here on

`is_partner_self(partner_id)` (the partner-portal equivalent of
`is_org_member`) is defined in 20260727093000, not here - it depends on
`partners.auth_user_id`, which that migration adds.

## Notes
- `current_org_id()`'s `LIMIT 1` assumes a user belongs to at most one
  active org. True today and for the foreseeable single-dealership future.
  If a user is ever added to a second org, this silently picks one for
  *new inserts only* - reads/updates/deletes are unaffected since they
  check the row's actual org_id via `is_org_member()`, not this default.
  Remove this default and require an explicit org_id on writes if/when an
  org-switcher ships.
- The owner-seeding step below intentionally does not hardcode a user id
  or email - it picks whichever single auth user currently exists, since
  this migration runs once, before any second user has been invited.
*/

-- ============================================================
-- Tables
-- ============================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'sales_executive', 'accountant', 'mechanic_inspector')),
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended')),
  display_name text,
  email text not null,
  invited_by uuid references auth.users(id),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index idx_memberships_user_active on public.memberships (user_id) where status = 'active';
create index idx_memberships_org on public.memberships (org_id);

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

-- ============================================================
-- Helper functions
-- ============================================================
create or replace function public.current_org_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.memberships
  where user_id = auth.uid() and status = 'active'
  order by created_at asc limit 1
$$;
grant execute on function public.current_org_id() to authenticated;

create or replace function public.is_org_member(p_org_id uuid, p_roles text[] default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id and m.user_id = auth.uid() and m.status = 'active'
      and (p_roles is null or m.role = any(p_roles))
  );
$$;
grant execute on function public.is_org_member(uuid, text[]) to authenticated;

-- ============================================================
-- RLS on the new tables themselves
-- ============================================================
create policy "select_own_org" on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy "owner_update_org" on public.organizations for update to authenticated
  using (public.is_org_member(id, array['owner']))
  with check (public.is_org_member(id, array['owner']));
-- No insert/delete policy: creating a new dealership tenant is an
-- administrative operation, not a self-serve action, in this product today.

create policy "select_own_membership_or_admin" on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(org_id, array['owner', 'manager']));
create policy "owner_insert_memberships" on public.memberships for insert to authenticated
  with check (public.is_org_member(org_id, array['owner']));
create policy "owner_update_memberships" on public.memberships for update to authenticated
  using (public.is_org_member(org_id, array['owner']))
  with check (public.is_org_member(org_id, array['owner']));
create policy "owner_delete_memberships" on public.memberships for delete to authenticated
  using (public.is_org_member(org_id, array['owner']));

-- ============================================================
-- Seed: one organization, owner membership for the existing account
-- ============================================================
do $$
declare
  v_org_id uuid;
  v_user_id uuid;
begin
  insert into public.organizations (name, slug, status)
  values ('Salam Motors', 'salam-motors', 'active')
  returning id into v_org_id;

  select id into v_user_id from auth.users order by created_at asc limit 1;

  if v_user_id is not null then
    insert into public.memberships (org_id, user_id, role, status, email, joined_at)
    select v_org_id, u.id, 'owner', 'active', u.email, now()
    from auth.users u
    where u.id = v_user_id;
  end if;
end $$;
