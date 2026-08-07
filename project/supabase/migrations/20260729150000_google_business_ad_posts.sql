/*
# Automated Google Business Profile ad posting

Free Google Business Profile listings, NOT paid Google Ads - the posting
model settled on with the user is:
  1. A single VahanExchange-owned Google Business Profile account posts
     every actively-listed vehicle across every dealer (shared marketplace
     feed).
  2. If a dealer has also filled in their own Google Business Profile
     handle (Company tab, mirroring the instagram_handle/twitter_handle
     pattern from 20260728140500), the same vehicle is additionally
     cross-posted to the dealer's own account.

`google_business_handle` is stored WITHOUT a leading `@`, exactly like
instagram_handle/twitter_handle - that migration's header called this out
as a convention this feature would rely on.

`vehicle_ad_posts` tracks one row per (vehicle, platform) - "platform"
being which Google Business Profile account the post targets, not a
different ad network. A vehicle can have up to two rows: one for the
shared VahanExchange account (always queued once a vehicle is actively
listed) and one for the dealer's own account (only queued if they've
configured a handle). Re-listing (unpublish -> publish again) re-queues
both rows via ON CONFLICT rather than piling up history rows - this table
tracks current post status per platform, not a full audit log (audit_logs
already gets a trigger-sourced row on every insert/update via the generic
audit trigger attached below).

No live Google Business Profile credentials exist yet for the shared
VahanExchange account. GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN /
GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID / GOOGLE_BUSINESS_PROFILE_LOCATION_ID
are provisioned-but-empty Supabase secrets (same pattern as PROTEAN_*) -
the post-vehicle-ad Edge Function checks for them and marks the post
'skipped' with an explanatory error_message when absent, rather than
pretending to succeed.

Posting to a *dealer's own* account additionally needs a per-dealer OAuth
grant that does not exist yet - collecting a handle alone does not confer
API write access to that dealer's Google Business Profile. That row is
always marked 'skipped' for now; a future dealer-side "Connect Google
Business Profile" OAuth flow is a separate follow-up feature, not built
here.
*/

-- ============================================================
-- Step 1: google_business_handle on app_settings
-- ============================================================
alter table public.app_settings
  add column if not exists google_business_handle text;

alter table public.app_settings
  add constraint app_settings_google_business_handle_check
  check (google_business_handle is null or google_business_handle ~ '^[A-Za-z0-9._-]{1,100}$');

-- ============================================================
-- Step 2: vehicle_ad_posts
-- ============================================================
create table if not exists public.vehicle_ad_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  platform text not null check (platform in ('google_business_shared', 'google_business_dealer')),
  status text not null default 'queued' check (status in ('queued', 'posted', 'failed', 'skipped')),
  creative jsonb,
  external_post_id text,
  error_message text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, platform)
);

create index if not exists idx_vehicle_ad_posts_org on public.vehicle_ad_posts (org_id);
create index if not exists idx_vehicle_ad_posts_vehicle on public.vehicle_ad_posts (vehicle_id);
create index if not exists idx_vehicle_ad_posts_status on public.vehicle_ad_posts (status) where status in ('queued', 'failed');

comment on table public.vehicle_ad_posts is
  'Per-(vehicle, platform) Google Business Profile ad post status. platform=google_business_shared is the VahanExchange-owned marketplace account (always queued for every org); platform=google_business_dealer is the listing dealer''s own account (only queued if app_settings.google_business_handle is set for that org).';
comment on column public.vehicle_ad_posts.creative is
  'Snapshot of the placeholder ad creative payload (title/price/photo/specs) generated at queue/post time - deliberately loose jsonb so the creative template can change without a migration.';

alter table public.vehicle_ad_posts enable row level security;

-- Same read/write shape as vehicles/listings: everyone in the org can
-- read post status, owner/manager/sales_executive can write (the roles
-- that already manage listings), owner/manager can delete.
create policy "org_select_vehicle_ad_posts" on public.vehicle_ad_posts for select to authenticated
  using (public.is_org_member(org_id));
create policy "org_insert_vehicle_ad_posts" on public.vehicle_ad_posts for insert to authenticated
  with check (public.is_org_member(org_id, array['owner','manager','sales_executive']));
create policy "org_update_vehicle_ad_posts" on public.vehicle_ad_posts for update to authenticated
  using (public.is_org_member(org_id, array['owner','manager','sales_executive']))
  with check (public.is_org_member(org_id, array['owner','manager','sales_executive']));
create policy "org_delete_vehicle_ad_posts" on public.vehicle_ad_posts for delete to authenticated
  using (public.is_org_member(org_id, array['owner','manager']));

-- Participates in the generic audit trigger backbone (20260728130000) -
-- posting attempts/results are write-relevant history.
drop trigger if exists trg_audit_vehicle_ad_posts on public.vehicle_ad_posts;
create trigger trg_audit_vehicle_ad_posts
  after insert or update on public.vehicle_ad_posts
  for each row execute function public.audit_row_change();

-- ============================================================
-- Step 3: auto-queue on listing -> Active
-- ============================================================
/*
Trigger point: `listings.status` transitioning to 'Active' is this
codebase's existing definition of "vehicle is actively listed" - it's
exactly what Passport.tsx's togglePublish flips, and what the public
passport view (20260724103700 and later) already gates on
(`listings.status = 'Active'`). Reusing it here means no new vehicle
lifecycle concept is introduced.

This function only ever performs local INSERTs (queuing) - it never
makes a network call from Postgres. Actually posting happens out-of-band
in the post-vehicle-ad Edge Function, invoked by the client right after
a successful publish (see Passport.tsx). Queuing here independently of
that client call means a queued-but-never-posted row is always visible
and can be manually retried later (e.g. once real credentials exist)
even if the client-side invoke was lost (tab closed, network blip).
*/
create or replace function public.queue_vehicle_ad_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dealer_handle text;
begin
  if TG_OP = 'INSERT' then
    if NEW.status is distinct from 'Active' then
      return NEW;
    end if;
  elsif TG_OP = 'UPDATE' then
    if NEW.status is distinct from 'Active' or OLD.status is not distinct from NEW.status then
      return NEW;
    end if;
  else
    return NEW;
  end if;

  insert into public.vehicle_ad_posts (org_id, vehicle_id, listing_id, platform, status)
  values (NEW.org_id, NEW.vehicle_id, NEW.id, 'google_business_shared', 'queued')
  on conflict (vehicle_id, platform) do update
    set status = 'queued',
        listing_id = excluded.listing_id,
        error_message = null,
        updated_at = pg_catalog.now();

  select google_business_handle into v_dealer_handle
  from public.app_settings
  where org_id = NEW.org_id;

  if v_dealer_handle is not null then
    insert into public.vehicle_ad_posts (org_id, vehicle_id, listing_id, platform, status)
    values (NEW.org_id, NEW.vehicle_id, NEW.id, 'google_business_dealer', 'queued')
    on conflict (vehicle_id, platform) do update
      set status = 'queued',
          listing_id = excluded.listing_id,
          error_message = null,
          updated_at = pg_catalog.now();
  end if;

  return NEW;
end;
$$;

comment on function public.queue_vehicle_ad_posts() is
  'Queues (or re-queues) vehicle_ad_posts rows when a listing becomes Active. Pure local inserts only - no network call. Actual posting happens in the post-vehicle-ad Edge Function.';

revoke all on function public.queue_vehicle_ad_posts() from public, anon, authenticated;

drop trigger if exists trg_queue_vehicle_ad_posts on public.listings;
create trigger trg_queue_vehicle_ad_posts
  after insert or update on public.listings
  for each row execute function public.queue_vehicle_ad_posts();
