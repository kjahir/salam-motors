/*
# create_organization(): also populate preferred_languages

`create_organization()` (20260728140500_org_preferences_and_social_handles.sql)
writes the singular `preferred_language` column on the `app_settings` row it
inserts, but never touched the plural `preferred_languages text[]` added
later (20260731090000_company_preferred_languages.sql). That array - not the
singular column - is what `LanguageSwitcher` and the onboarding screen's own
language picker actually read. Onboarding was silently leaving new orgs on
`preferred_languages = array['en']` (the column default) regardless of what
was chosen at signup, so a dealer who picked e.g. Tamil at setup would not
see it in the switcher until someone re-saved Team > Company.

Signature is unchanged (`p_name text, p_preferred_language text default
null`), so this is a plain `create or replace` - no drop/grant dance needed.
The derivation mirrors `updateCompanyPreferences` in src/lib/queries.ts:
English is always a member, plus the chosen language if one was given.
*/

create or replace function public.create_organization(p_name text, p_preferred_language text default null)
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
  v_preferred_languages text[];
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

  v_preferred_languages := case
    when p_preferred_language is null or p_preferred_language = 'en' then array['en']
    else array['en', p_preferred_language]
  end;

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
    preferred_languages,
    updated_at,
    updated_by
  ) values (
    v_org_id, 10, 30, p_preferred_language, v_preferred_languages, pg_catalog.now(), v_email
  ) on conflict (org_id) do nothing;

  return v_org_id;
end;
$$;
