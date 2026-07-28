/*
# Dealer company preferences: language + social handles

Adds five nullable columns to the existing per-org `app_settings` singleton
(not `organizations` - that table is tenant identity, `app_settings` is
already the home for business-wide configuration, e.g. the estimated
profit margin range). Purely additive: existing rows get NULL, which
satisfies every "is null or ..." check below.

Handles are stored WITHOUT a leading `@` (stripped on save by the client,
prepended only for display) - this is the convention a sibling in-flight
feature (automated ad creation) will rely on.

Also extends `create_organization()` (currently `create_organization(text)`,
defined in 20260727210000_assistant_security_control_plane.sql) to accept
an optional preferred-language argument and persist it into the
`app_settings` row it already inserts in the same transaction, so it's
captured at onboarding time without a second round trip.
*/

alter table public.app_settings
  add column if not exists preferred_language text,
  add column if not exists instagram_handle text,
  add column if not exists twitter_handle text,
  add column if not exists whatsapp_business_number text,
  add column if not exists website_url text;

alter table public.app_settings
  add constraint app_settings_preferred_language_check
  check (preferred_language is null or preferred_language in ('en','hi','ta','ml','kn','te'));

alter table public.app_settings
  add constraint app_settings_instagram_handle_check
  check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$');

alter table public.app_settings
  add constraint app_settings_twitter_handle_check
  check (twitter_handle is null or twitter_handle ~ '^[A-Za-z0-9_]{1,15}$');

alter table public.app_settings
  add constraint app_settings_website_url_check
  check (website_url is null or website_url ~ '^https?://');

alter table public.app_settings
  add constraint app_settings_whatsapp_number_check
  check (whatsapp_business_number is null or char_length(whatsapp_business_number) <= 20);

-- Replace create_organization(text) with create_organization(text, text)
-- so a caller passing only the name keeps working (default null), while
-- onboarding can now also supply a preferred language in the same call.
drop function if exists public.create_organization(text);

create function public.create_organization(p_name text, p_preferred_language text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix int := 0;
  v_email text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  -- Serialize concurrent onboarding attempts by the same principal.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 73921)
  );

  if p_name is null
     or char_length(pg_catalog.btrim(p_name)) < 2
     or char_length(pg_catalog.btrim(p_name)) > 120 then
    raise exception using
      errcode = '22023',
      message = 'Organization name must be between 2 and 120 characters';
  end if;

  if p_preferred_language is not null
     and p_preferred_language not in ('en','hi','ta','ml','kn','te') then
    raise exception using
      errcode = '22023',
      message = 'Unsupported preferred language';
  end if;

  if exists (
    select 1 from public.memberships m where m.user_id = v_user_id
  ) or exists (
    select 1 from public.partners p where p.auth_user_id = v_user_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'This account is already linked to an organization';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_user_id;

  if v_email is null then
    raise exception using errcode = '28000', message = 'Authenticated user record not found';
  end if;

  v_base_slug := pg_catalog.lower(
    pg_catalog.regexp_replace(pg_catalog.btrim(p_name), '[^a-zA-Z0-9]+', '-', 'g')
  );
  v_base_slug := pg_catalog.btrim(v_base_slug, '-');
  if v_base_slug = '' then
    v_base_slug := 'dealership';
  end if;
  v_base_slug := pg_catalog.substr(v_base_slug, 1, 80);
  v_slug := v_base_slug;

  loop
    begin
      insert into public.organizations (name, slug, status)
      values (pg_catalog.btrim(p_name), v_slug, 'active')
      returning id into v_org_id;
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      if v_suffix > 50 then
        v_slug := v_base_slug || '-' || pg_catalog.substr(gen_random_uuid()::text, 1, 8);
      else
        v_slug := v_base_slug || '-' || v_suffix::text;
      end if;
    end;
  end loop;

  insert into public.memberships (
    org_id, user_id, role, status, email, joined_at
  ) values (
    v_org_id, v_user_id, 'owner', 'active', v_email, pg_catalog.now()
  );

  -- New organizations otherwise have no app_settings singleton.
  insert into public.app_settings (
    org_id,
    estimated_profit_margin_low_pct,
    estimated_profit_margin_high_pct,
    preferred_language,
    updated_at,
    updated_by
  ) values (
    v_org_id, 10, 30, p_preferred_language, pg_catalog.now(), v_email
  ) on conflict (org_id) do nothing;

  return v_org_id;
end;
$$;

revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
