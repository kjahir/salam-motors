/*
# Subscription billing (Razorpay Subscriptions + UPI AutoPay)

SaaS billing for the dealership tenants themselves - NOT to be confused
with the vehicle-level money already in this schema (`purchase_payments`,
`sale_payments`, `profit_distributions`) which is a dealer's trade with
their own customers. Nothing here touches those tables.

Gateway is Razorpay (locked in with the user; Cashfree/PayU explicitly
rejected). No merchant credentials exist yet, so the same pattern as
PROTEAN_* / GOOGLE_BUSINESS_PROFILE_* applies: the schema, functions and
Edge Functions are real-shaped, the secrets are placeholders, and the
checkout path reports "not configured" rather than pretending to succeed.

## Tables
1. `subscription_plans` - the plan catalog. Global, NOT org-scoped: every
   dealer sees the same menu.
2. `org_subscriptions` - one row per organization, its current plan and
   lifecycle state.
3. `billing_events` - append-only ledger of verified Razorpay webhooks,
   idempotent on Razorpay's own event id.

## Money
All amounts are **integer paise, exclusive of GST** (`bigint`, never
numeric/float - money in this table is compared and summed, and the
pricing page already states "+ 18% GST"). 18% GST is added at checkout by
Razorpay and appears on the Razorpay-issued invoice; we deliberately do
not store a GST-inclusive figure anywhere, so there is exactly one price
of record.

## Prices are data, not code
`monthly_price_paise` / `annual_price_paise` seed as NULL. Real commercial
terms are not decided yet - the marketing PricingPage.tsx has shown "₹—"
placeholders since it shipped. Seeding NULL keeps that honest: the UI
renders "—" for an unpriced plan instead of a plausible-looking wrong
number, and setting the real price is a single UPDATE with no code change
and no redeploy. Same for the numeric entitlement limits (see below).

## Status vocabulary
`org_subscriptions.status` is OUR vocabulary, not Razorpay's. Razorpay has
its own set (created/authenticated/active/pending/halted/cancelled/
completed/expired/paused) which is mapped onto ours in the billing-webhook
Edge Function. Keeping them separate means a Razorpay API change, or a
second gateway later, does not leak into every gating check in the app.

  trialing  - free trial, full access, no mandate authorized yet
  active    - mandate authorized and current period paid
  past_due  - a renewal failed; still FULL access during the grace window
              while Razorpay retries the UPI mandate (grace_ends_at)
  lapsed    - grace expired, or trial ended without payment -> READ-ONLY
  cancelled - dealer cancelled; keeps full access until current_period_end,
              then a sweep moves them to `lapsed`
  comped    - never billed, always full access (grandfathered dealers and
              internal/demo orgs - see the backfill note below)

## Enforcement: grace, then read-only
Settled with the user: a failed payment gives a grace window at full
access, and only then drops the org to read-only - view and export
everything, create and edit nothing. Data is NEVER deleted or hidden for
non-payment.

Client-side gating alone would be advisory only, so the block is enforced
in the database by `enforce_billing_write_access()`, a BEFORE trigger
attached to the dealer-authored business tables. This deliberately mirrors
the `audit_row_change()` backbone from 20260728130000 rather than
rewriting the WITH CHECK clause of every write policy on 12+ live tables -
it is additive, reviewable in one place, and revertible by dropping
triggers.

System-generated tables are intentionally NOT guarded: `alerts`,
`audit_logs`, `vehicle_ad_posts`, `stock_number_counters` and the
`assistant_*` family keep working for a read-only org, because a dealer
who cannot pay should still be able to read their alerts, and because
silently breaking the audit trail on non-payment would be worse than the
non-payment. The billing tables themselves are obviously not guarded
either - that would make paying to get out of read-only impossible.

## Backfill safety
This runs against a LIVE production database with real dealerships on it.
Every organization that already exists is seeded as `comped`, not
`trialing` - a migration must never be the reason a paying-in-good-faith
dealer loses write access to their own inventory overnight. Converting a
grandfathered dealer onto a real paid plan is a deliberate commercial act,
done by updating their row, not a side effect of deploying this file.
New organizations created after this migration get a trial (see the
`trg_start_org_trial` trigger).
*/

-- ============================================================
-- Step 1: plan catalog
-- ============================================================
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tagline text,
  -- NULL price = "not priced here" (Enterprise/custom, or simply not yet
  -- decided). Never 0 - 0 would mean a genuinely free plan.
  monthly_price_paise bigint check (monthly_price_paise is null or monthly_price_paise > 0),
  annual_price_paise bigint check (annual_price_paise is null or annual_price_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  -- Self-serve plans can be bought with a card/UPI mandate from the
  -- pricing page. Non-self-serve (Enterprise) routes to sales instead.
  is_self_serve boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  -- Populated lazily the first time a subscription is created for this
  -- plan+cycle, then reused. Razorpay plans are immutable once created,
  -- so a price change means creating a NEW Razorpay plan and overwriting
  -- these - existing subscribers stay on the old plan id until they
  -- actively change plans, which is the intended grandfathering.
  razorpay_plan_id_monthly text,
  razorpay_plan_id_annual text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscription_plans is
  'Global SaaS plan catalog (not org-scoped). Prices are integer paise exclusive of GST; NULL means unpriced/custom. Editing a price here is a data change, not a deploy.';
comment on column public.subscription_plans.limits is
  'Entitlements as jsonb so a new limit does not need a migration. Numeric limits use NULL for "unlimited"; booleans gate a whole feature. Read via public.org_entitlements().';
comment on column public.subscription_plans.razorpay_plan_id_monthly is
  'Razorpay plan id, created lazily on first checkout for this plan+cycle. NULL until then.';

alter table public.subscription_plans enable row level security;

-- The catalog is public-readable: the marketing pricing page renders it
-- for signed-out visitors. It contains no tenant data.
create policy "public_read_active_plans" on public.subscription_plans for select to anon, authenticated
  using (is_active);
-- No insert/update/delete policy: the catalog is edited by an operator
-- with the service role, not from the app. Pricing is not self-serve.

-- ============================================================
-- Step 2: per-organization subscription
-- ============================================================
create table if not exists public.org_subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- One subscription per org. A dealer upgrading/downgrading updates this
  -- row (and gets a new razorpay_subscription_id); we do not accumulate
  -- historical rows here - billing_events is the history.
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id),
  billing_cycle text check (billing_cycle in ('monthly', 'annual')),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'lapsed', 'cancelled', 'comped')),

  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  -- Set when a renewal fails; while now() < grace_ends_at the org keeps
  -- full access. Cleared on successful payment.
  grace_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,

  razorpay_subscription_id text unique,
  razorpay_customer_id text,
  last_payment_at timestamptz,
  last_payment_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_subscriptions_status on public.org_subscriptions (status);
create index if not exists idx_org_subscriptions_razorpay on public.org_subscriptions (razorpay_subscription_id)
  where razorpay_subscription_id is not null;
-- Supports the lapse sweep: find rows whose trial/grace/period has run out.
create index if not exists idx_org_subscriptions_expiring on public.org_subscriptions (status, current_period_end, trial_ends_at, grace_ends_at)
  where status in ('trialing', 'past_due', 'cancelled');

comment on table public.org_subscriptions is
  'One row per organization: current plan and billing lifecycle state. status is this codebase''s vocabulary, mapped from Razorpay''s in the billing-webhook function.';
comment on column public.org_subscriptions.grace_ends_at is
  'While now() < grace_ends_at a past_due org keeps FULL write access so Razorpay can retry the UPI mandate. Past it, public.expire_lapsed_subscriptions() moves the org to read-only.';

alter table public.org_subscriptions enable row level security;

-- Any active member can see their org's billing state - the read-only
-- banner and the plan badge need it on every screen, for every role.
create policy "org_select_subscription" on public.org_subscriptions for select to authenticated
  using (public.is_org_member(org_id));
-- Deliberately NO insert/update/delete policy for authenticated users.
-- Subscription state is written only by the billing Edge Functions using
-- the service role, off the back of a signature-verified Razorpay webhook.
-- A dealer must not be able to set their own status to 'active'.

drop trigger if exists trg_audit_org_subscriptions on public.org_subscriptions;
create trigger trg_audit_org_subscriptions
  after insert or update on public.org_subscriptions
  for each row execute function public.audit_row_change();

-- ============================================================
-- Step 3: webhook event ledger
-- ============================================================
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  -- Razorpay's `x-razorpay-event-id` header. UNIQUE is the idempotency
  -- guarantee: Razorpay retries webhooks on any non-2xx, and duplicate
  -- delivery of `subscription.charged` must not extend a period twice.
  razorpay_event_id text not null unique,
  event_type text not null,
  org_id uuid references public.organizations(id) on delete set null,
  razorpay_subscription_id text,
  razorpay_payment_id text,
  amount_paise bigint,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_events_org on public.billing_events (org_id, created_at desc);
create index if not exists idx_billing_events_subscription on public.billing_events (razorpay_subscription_id);
create index if not exists idx_billing_events_unprocessed on public.billing_events (created_at)
  where processed_at is null;

comment on table public.billing_events is
  'Append-only ledger of signature-verified Razorpay webhooks. UNIQUE(razorpay_event_id) makes redelivery idempotent. Also the source of the payment history shown on the Billing page.';
comment on column public.billing_events.payload is
  'Raw verified webhook body, kept whole - the Razorpay payload carries invoice/GST detail we do not model, and a billing dispute is exactly when you want the original.';

alter table public.billing_events enable row level security;

-- Owners can read their own org's billing history (the Billing page is
-- owner-only, matching who can change a plan). Writes are service-role
-- only - this is a ledger of externally-verified facts.
create policy "owner_select_billing_events" on public.billing_events for select to authenticated
  using (org_id is not null and public.is_org_member(org_id, array['owner']));

-- ============================================================
-- Step 4: entitlement resolution
-- ============================================================
/*
Single source of truth for "what can this org do right now", used by the
DB write guard below AND by the frontend (via the org_entitlements RPC),
so gating cannot drift between the two.

`access` is the important output:
  full      - trialing, active, comped, past_due-within-grace, or
              cancelled-but-period-not-over
  read_only - lapsed, or any of the above whose deadline has passed

Note this evaluates deadlines live against now() rather than trusting
`status` alone. That means an org whose trial quietly ran out is read-only
from the exact second it expires, even if the sweep function has not run
yet - the sweep only persists what this function already computes.

Deliberately split in two:

  org_entitlements_internal() - SECURITY DEFINER, granted to NOBODY. The
    write guard and the sweep call it, and it must bypass RLS to do so
    (the guard fires inside a trigger during someone else's write).

  org_entitlements()          - the frontend-facing wrapper, which returns
    NULL unless the caller is actually a member of that org.

Without that split, a single SECURITY DEFINER function taking an arbitrary
org id and granted to `authenticated` would let any signed-in user read any
dealership's plan, status and renewal dates by guessing an org id - RLS is
bypassed inside a definer function, so the org_subscriptions SELECT policy
would not save us.
*/
create or replace function public.org_entitlements_internal(p_org_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'org_id', p_org_id,
    'status', s.status,
    'plan_code', p.code,
    'plan_name', p.name,
    'billing_cycle', s.billing_cycle,
    'trial_ends_at', s.trial_ends_at,
    'current_period_end', s.current_period_end,
    'grace_ends_at', s.grace_ends_at,
    'cancel_at_period_end', s.cancel_at_period_end,
    'limits', coalesce(p.limits, '{}'::jsonb),
    'access', case
      when s.status = 'comped' then 'full'
      when s.status = 'active' then 'full'
      when s.status = 'trialing'
        then case when s.trial_ends_at is null or s.trial_ends_at > pg_catalog.now() then 'full' else 'read_only' end
      when s.status = 'past_due'
        then case when s.grace_ends_at is not null and s.grace_ends_at > pg_catalog.now() then 'full' else 'read_only' end
      when s.status = 'cancelled'
        then case when s.current_period_end is not null and s.current_period_end > pg_catalog.now() then 'full' else 'read_only' end
      else 'read_only'
    end
  )
  from public.org_subscriptions s
  left join public.subscription_plans p on p.id = s.plan_id
  where s.org_id = p_org_id;
$$;

comment on function public.org_entitlements_internal(uuid) is
  'Unchecked entitlement resolution, including access=full|read_only evaluated against now(). Granted to nobody - the write guard and sweep call it internally. Use org_entitlements() from the app.';

revoke all on function public.org_entitlements_internal(uuid) from public, anon, authenticated;

-- Caller-facing wrapper: same answer, but only about your OWN org.
create or replace function public.org_entitlements(p_org_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_org_member(p_org_id) then public.org_entitlements_internal(p_org_id)
    else null
  end;
$$;

comment on function public.org_entitlements(uuid) is
  'Membership-checked entitlements for the calling user''s own org; NULL for any other org. This is the function the frontend calls.';

revoke all on function public.org_entitlements(uuid) from public, anon;
grant execute on function public.org_entitlements(uuid) to authenticated;

/*
Boolean fast path for the write guard. Returns TRUE (allow) when the org
has no subscription row at all - fail-open is the deliberate choice here.
A missing billing row is our bug, not the dealer's, and the failure mode
of fail-closed would be locking a paying dealership out of its own
inventory. Non-payment is signalled by an explicit `lapsed` row, never by
absence.
*/
create or replace function public.org_has_write_access(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (public.org_entitlements_internal(p_org_id) ->> 'access') = 'full',
    true
  );
$$;

comment on function public.org_has_write_access(uuid) is
  'TRUE when the org may write. Fail-OPEN when no subscription row exists: a missing billing row is our bug, and locking a dealer out of their own inventory is the worse failure. Internal only - the app reads `access` from org_entitlements().';

revoke all on function public.org_has_write_access(uuid) from public, anon, authenticated;

-- ============================================================
-- Step 5: the read-only write guard
-- ============================================================
create or replace function public.enforce_billing_write_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  -- DELETEs carry the org on OLD; INSERT/UPDATE on NEW.
  if TG_OP = 'DELETE' then
    v_org_id := OLD.org_id;
  else
    v_org_id := NEW.org_id;
  end if;

  if v_org_id is null then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  if not public.org_has_write_access(v_org_id) then
    raise exception 'SUBSCRIPTION_READ_ONLY: this dealership''s subscription has lapsed, so records cannot be created or changed. Existing data remains fully readable and exportable.'
      using errcode = 'check_violation',
            hint = 'Reactivate the subscription from Settings > Billing to restore write access.';
  end if;

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

comment on function public.enforce_billing_write_access() is
  'BEFORE trigger: blocks writes by an org whose subscription is read-only. Raises SUBSCRIPTION_READ_ONLY, which the frontend matches on to show the reactivate prompt.';

revoke all on function public.enforce_billing_write_access() from public, anon, authenticated;

/*
Attached to dealer-authored business tables only. This is the same list
the generic audit trigger (20260728130000) covers, plus sale_payments,
inspections and investments - i.e. "records a dealer creates by working".

Explicitly NOT attached to: alerts, audit_logs, vehicle_ad_posts,
stock_number_counters, assistant_* (system-generated - a read-only org
must still receive alerts and keep an audit trail), memberships and
app_settings (an owner locked out for non-payment must still be able to
manage their team and update their own company details), and the billing
tables themselves (guarding those would make it impossible to pay your
way out of read-only).
*/
do $$
declare
  t text;
  guarded_tables text[] := array[
    'vehicles',
    'purchases',
    'purchase_payments',
    'sales',
    'sale_payments',
    'expenses',
    'listings',
    'parties',
    'partners',
    'vehicle_documents',
    'vehicle_media',
    'profit_distributions',
    'compliance_policies',
    'inspections',
    'investments'
  ];
begin
  foreach t in array guarded_tables loop
    -- Skip anything not present on this environment rather than failing
    -- the whole migration; the table list spans several earlier migrations.
    if to_regclass('public.' || t) is null then
      raise notice 'enforce_billing_write_access: skipping missing table %', t;
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'org_id'
    ) then
      raise notice 'enforce_billing_write_access: skipping % (no org_id column)', t;
      continue;
    end if;

    execute format('drop trigger if exists trg_billing_guard_%I on public.%I', t, t);
    execute format(
      'create trigger trg_billing_guard_%I before insert or update or delete on public.%I
         for each row execute function public.enforce_billing_write_access()',
      t, t
    );
  end loop;
end;
$$;

-- ============================================================
-- Step 6: lifecycle automation
-- ============================================================
/*
Persists what org_entitlements() already computes live, so the Billing
page and any operator query see a truthful `status` rather than a stale
one. Safe to run repeatedly; intended to be called on a schedule (pg_cron
or a scheduled Edge Function). Access control does NOT depend on this
having run - org_entitlements() evaluates deadlines against now().
*/
create or replace function public.expire_lapsed_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.org_subscriptions s
     set status = 'lapsed',
         updated_at = pg_catalog.now()
   where s.status in ('trialing', 'past_due', 'cancelled')
     and (public.org_entitlements_internal(s.org_id) ->> 'access') = 'read_only';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_lapsed_subscriptions() is
  'Sweep: persists status=lapsed for orgs whose trial/grace/cancelled period has run out. Returns the number of rows moved. Access control does not depend on this running.';

revoke all on function public.expire_lapsed_subscriptions() from public, anon, authenticated;

/*
Every new organization starts a trial automatically. Length lives in one
place here (14 days) rather than being duplicated across the signup flow
and the pricing page.

Deliberately picks the cheapest ACTIVE self-serve plan by sort_order
rather than hardcoding 'starter', so renaming or reordering the catalog
does not silently break signup. If the catalog is empty the trial still
starts with a NULL plan_id - full access, no plan - which is strictly
better than blocking org creation on a billing catalog.
*/
create or replace function public.start_org_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
begin
  select id into v_plan_id
    from public.subscription_plans
   where is_active and is_self_serve
   order by sort_order, code
   limit 1;

  insert into public.org_subscriptions (org_id, plan_id, status, trial_ends_at)
  values (NEW.id, v_plan_id, 'trialing', pg_catalog.now() + interval '14 days')
  on conflict (org_id) do nothing;

  return NEW;
end;
$$;

comment on function public.start_org_trial() is
  'Starts a 14-day trial for every newly created organization. Trial length is defined here only.';

revoke all on function public.start_org_trial() from public, anon, authenticated;

drop trigger if exists trg_start_org_trial on public.organizations;
create trigger trg_start_org_trial
  after insert on public.organizations
  for each row execute function public.start_org_trial();

-- ============================================================
-- Step 7: seed the catalog
-- ============================================================
/*
Names, taglines and the feature split mirror what PricingPage.tsx already
publishes, so the marketing page and the database agree from day one.

Prices stay NULL until commercial terms are set - see the header note.
The numeric limits (active_vehicles, team_members) are also NULL, meaning
UNLIMITED. That is deliberate: the pricing page's "Up to — vehicles" has
always been a placeholder, and shipping an invented cap would start
blocking real dealers on a number nobody has agreed to. The boolean
feature gates below are NOT invented - they are exactly the split the
pricing page already advertises (AI assistant and partner/finance
tracking are Growth-and-above).
*/
insert into public.subscription_plans
  (code, name, tagline, is_self_serve, sort_order, limits)
values
  (
    'starter',
    'Starter',
    'For a single dealership getting off spreadsheets',
    true,
    10,
    jsonb_build_object(
      'active_vehicles', null,
      'team_members', null,
      'ai_assistant', false,
      'partner_investment', false,
      'compliance_engine', 'basic'
    )
  ),
  (
    'growth',
    'Growth',
    'For dealerships managing finance & investment partners',
    true,
    20,
    jsonb_build_object(
      'active_vehicles', null,
      'team_members', null,
      'ai_assistant', true,
      'partner_investment', true,
      'compliance_engine', 'full'
    )
  ),
  (
    'enterprise',
    'Enterprise',
    'For multi-location dealer groups & networks',
    false,
    30,
    jsonb_build_object(
      'active_vehicles', null,
      'team_members', null,
      'ai_assistant', true,
      'partner_investment', true,
      'compliance_engine', 'full'
    )
  )
on conflict (code) do nothing;

-- ============================================================
-- Step 8: backfill existing organizations as comped
-- ============================================================
/*
See the header. Existing dealerships are grandfathered to full access
rather than dropped into a trial that would expire under them. Moving one
onto a paid plan is a deliberate UPDATE, not a consequence of this deploy.
*/
insert into public.org_subscriptions (org_id, status)
select o.id, 'comped'
  from public.organizations o
on conflict (org_id) do nothing;
