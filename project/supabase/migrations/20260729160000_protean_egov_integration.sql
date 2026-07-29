/*
# Protean eGov integration: eSign/eStamp requests + vehicle/owner/insurance/challan lookups

## Overview
Backing tables for the shared Protean (formerly NSDL eGov) client added at
supabase/functions/_shared/protean/. Combines what were originally two
separate feature requests into one migration, per the same product
decision that put both behind one client:

- Task 7 (eSign/eStamp for vehicle sale documents) -> protean_document_requests
- Task 8 (vehicle/owner/insurance/challan lookups) -> protean_lookup_requests

Both tables are org-scoped (`org_id`) and follow the same RLS shape as
`assistant_trace_events` (20260729140000): `is_active_org_staff(org_id, roles)`
gates access, `service_role` gets a full grant for server-side writes that
have no caller JWT (the Protean webhook callback - see protean-webhook
edge function - is called by Protean's servers, not by a signed-in user).

## Why two tables instead of one
protean_document_requests and protean_lookup_requests are NOT merged into a
single generic "protean_requests" table: document requests are a write
action with real-world legal/financial consequences (a signed document, a
paid stamp duty) that this app never lets a caller delete and tracks
through a multi-step status lifecycle (initiated -> pending -> completed/
failed/cancelled/expired), typically completed asynchronously via the
webhook. Lookups are read-only, single-shot, and cacheable (see
`requested_at` + the edge function's cache-TTL check) - conflating the two
would mean either loosening the document table's invariants or adding
unused columns to the lookup table. This mirrors the same reasoning
`compliance_policies` (20260725090000) and `vehicle_documents` use for
`params`/jsonb "let the specific column list stay only what's the same
across a genuine family of rows" rather than one giant sometimes-null table.

## Compliance-policy system: considered, not added here
The task brief asked whether eSign/eStamp completion or lookup results
should feed the existing document/evidence/reconciliation compliance-rule
system as a new rule kind (see src/lib/compliance.ts). Decided NOT to do
that in this pass: `evaluateVehicleCompliance()` runs client-side over an
already-fetched `VehicleWithRelations`, so a new rule kind would require
also extending `fetchVehicleFull()`/`VehicleWithRelations`/`queries.ts` to
join these two new tables everywhere a vehicle is loaded - that's a
plumbing change across the read path, not the "small, natural extension"
the brief asked to stay within. The tables are still shaped so a future
pass can add that rule kind cheaply: both carry `org_id` + `vehicle_id`
and a `status`, which is all a `protean_verification_required` rule type
would need to query.

## What this does NOT do
- No existing table is altered.
- No RLS policy is added for `anon` - both tables are staff-only (no
  partner-portal read/write), unlike some existing tables that allow
  `is_active_org_partner`.
- No delete policy on either table - both are append-only logs of
  externally-consequential actions/lookups; corrections happen by
  inserting a new row, not editing history.
*/

-- ============================================================
-- protean_document_requests (eSign + eStamp)
-- ============================================================

create table if not exists public.protean_document_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  request_type text not null check (request_type in ('esign', 'estamp')),
  status text not null default 'initiated'
    check (status in ('initiated', 'pending', 'completed', 'failed', 'cancelled', 'expired')),
  document_label text not null check (char_length(document_label) between 1 and 200),
  -- Best-effort placeholder shape (see _shared/protean/types.ts header) - not a fixed schema,
  -- since the exact Protean request/response fields are unverified.
  signer_details jsonb not null default '{}'::jsonb check (jsonb_typeof(signer_details) = 'object'),
  request_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(request_payload) = 'object'),
  response_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(response_payload) = 'object'),
  protean_reference_id text,
  document_url text,
  stamp_duty_amount numeric(12,2) check (stamp_duty_amount is null or stamp_duty_amount >= 0),
  error_code text,
  error_message text,
  initiated_by uuid references auth.users(id) on delete set null,
  initiated_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_protean_doc_requests_org
  on public.protean_document_requests (org_id, initiated_at desc);
create index if not exists idx_protean_doc_requests_vehicle
  on public.protean_document_requests (vehicle_id)
  where vehicle_id is not null;
create index if not exists idx_protean_doc_requests_sale
  on public.protean_document_requests (sale_id)
  where sale_id is not null;
create unique index if not exists uq_protean_doc_requests_reference
  on public.protean_document_requests (protean_reference_id)
  where protean_reference_id is not null;

comment on table public.protean_document_requests is
  'eSign and eStamp requests initiated against Protean eGov. request_payload/response_payload/signer_details are best-effort placeholder shapes pending verification against real Protean API docs (see _shared/protean/types.ts).';
comment on column public.protean_document_requests.status is
  'Lifecycle: initiated (row created, Protean call sent) -> pending (Protean accepted, awaiting signer/processing) -> completed|failed|cancelled|expired (terminal, usually set by protean-webhook or a manual status poll).';

alter table public.protean_document_requests enable row level security;

create policy "org_staff_select_protean_document_requests"
  on public.protean_document_requests
  for select
  to authenticated
  using (public.is_active_org_staff(org_id, null));

create policy "org_staff_insert_protean_document_requests"
  on public.protean_document_requests
  for insert
  to authenticated
  with check (
    public.is_active_org_staff(org_id, array['owner', 'manager', 'sales_executive'])
    and initiated_by = auth.uid()
  );

-- Update is needed for a manual "check status" call (client re-invokes the
-- edge function, which re-fetches status from Protean and writes it back
-- through the caller-scoped client) as well as the webhook path, which
-- uses service_role and therefore bypasses this policy entirely.
create policy "org_staff_update_protean_document_requests"
  on public.protean_document_requests
  for update
  to authenticated
  using (public.is_active_org_staff(org_id, array['owner', 'manager', 'sales_executive']))
  with check (public.is_active_org_staff(org_id, array['owner', 'manager', 'sales_executive']));

revoke all on table public.protean_document_requests from public, anon;
grant select, insert, update on table public.protean_document_requests to authenticated;
grant all on table public.protean_document_requests to service_role;

drop trigger if exists trg_audit_protean_document_requests on public.protean_document_requests;
create trigger trg_audit_protean_document_requests
  after insert or update on public.protean_document_requests
  for each row execute function public.audit_row_change();

-- ============================================================
-- protean_lookup_requests (vehicle / owner / insurance / challan)
-- ============================================================

create table if not exists public.protean_lookup_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  lookup_type text not null check (lookup_type in ('vehicle', 'owner', 'insurance', 'challan')),
  registration_number text not null check (char_length(registration_number) between 1 and 20),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  request_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(request_payload) = 'object'),
  response_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(response_payload) = 'object'),
  error_code text,
  error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now()
);

create index if not exists idx_protean_lookup_requests_org_reg
  on public.protean_lookup_requests (org_id, registration_number, requested_at desc);
create index if not exists idx_protean_lookup_requests_vehicle
  on public.protean_lookup_requests (vehicle_id)
  where vehicle_id is not null;
-- Supports the edge function's cache check: "is there a recent completed
-- lookup of this type for this registration number".
create index if not exists idx_protean_lookup_requests_cache_lookup
  on public.protean_lookup_requests (org_id, lookup_type, registration_number, requested_at desc)
  where status = 'completed';

comment on table public.protean_lookup_requests is
  'Vehicle/owner/insurance/challan lookups against Protean eGov. Doubles as a short-lived cache (see protean-lookup edge function) to avoid paying for a repeat lookup within the cache TTL. response_payload is a best-effort placeholder shape pending verification against real Protean API docs (see _shared/protean/types.ts).';

alter table public.protean_lookup_requests enable row level security;

create policy "org_staff_select_protean_lookup_requests"
  on public.protean_lookup_requests
  for select
  to authenticated
  using (public.is_active_org_staff(org_id, null));

create policy "org_staff_insert_protean_lookup_requests"
  on public.protean_lookup_requests
  for insert
  to authenticated
  with check (
    public.is_active_org_staff(org_id, array['owner', 'manager', 'sales_executive', 'accountant'])
    and requested_by = auth.uid()
  );

revoke all on table public.protean_lookup_requests from public, anon;
grant select, insert on table public.protean_lookup_requests to authenticated;
grant all on table public.protean_lookup_requests to service_role;

drop trigger if exists trg_audit_protean_lookup_requests on public.protean_lookup_requests;
create trigger trg_audit_protean_lookup_requests
  after insert or update on public.protean_lookup_requests
  for each row execute function public.audit_row_change();
