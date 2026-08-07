/*
# Company preferred languages: one language becomes a set

`app_settings.preferred_language` (added in
20260728140500_org_preferences_and_social_handles.sql) holds a single code
- the dealership's "own" language alongside English. Dealers want to choose
more than one: a Chennai forecourt that serves both Tamil and Hindi
speakers should be able to offer English + Tamil + Hindi in the language
switcher, not English + exactly one other.

This adds `preferred_languages text[]`, which becomes the authoritative
list of languages the app offers. English is always a member: it is the
fallback locale (src/i18n/index.ts sets `fallbackLng: 'en'`), so a
company that removed it could land a user on untranslated keys with no way
back.

`preferred_language` is deliberately kept, not dropped:
- `create_organization(text, text)` writes it at onboarding time,
- it is what a company chose before this migration, and the backfill below
  reads it.
It now means "the company's own language" - the first non-English entry of
the set - and the client keeps the two in step on every save
(src/lib/queries.ts `updateCompanyPreferences`). Nothing reads it as the
switcher's source of truth any more.

Purely additive: no column is dropped or renamed, and every existing row
gets a value from the backfill.
*/

alter table public.app_settings
  add column if not exists preferred_languages text[] not null default array['en'];

-- Existing rows: English plus whatever single language they had chosen.
update public.app_settings
set preferred_languages = case
  when preferred_language is null or preferred_language = 'en'
    then array['en']
  else array['en', preferred_language]
end;

/*
Membership and bounds only. A "no duplicates" rule would need
`count(distinct ...)` over `unnest(...)`, i.e. a subquery, which CHECK
constraints do not allow - and a repeated code is harmless: the client
de-duplicates, and the language switcher renders from a Set either way.
*/
alter table public.app_settings
  drop constraint if exists app_settings_preferred_languages_check;

alter table public.app_settings
  add constraint app_settings_preferred_languages_check
  check (
    preferred_languages <@ array['en','hi','ta','ml','kn','te']
    and 'en' = any(preferred_languages)
    and array_length(preferred_languages, 1) between 1 and 6
  );

comment on column public.app_settings.preferred_languages is
  'Languages this dealership offers in the in-app language switcher. Always includes ''en'' (the i18n fallback locale). Supersedes preferred_language, which is kept as the single "company''s own language" and mirrors the first non-English entry.';
