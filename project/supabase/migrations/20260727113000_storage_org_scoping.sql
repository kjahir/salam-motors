/*
# Org-scope storage bucket policies

## Overview
`vehicle-documents`, `finance-proofs`, `vehicle-photos` were, from the
day each was created, gated only by `bucket_id = '...'` - no per-owner or
per-tenant check at the storage layer at all (pre-existing gap, confirmed
across 20260721160000/20260725000000/20260726080000: none of their
policies reference `auth.uid()` or any ownership predicate). Any
authenticated user could already read/delete any other user's uploaded
files before this migration.

This closes that gap by requiring the first path segment of every object
name to be an `org_id` the caller is a member of, matching the frontend
convention of prefixing every upload path with the org id (see the
`pathPrefix` changes shipped alongside this migration in AddVehicle.tsx,
EditVehicleModal.tsx, VehicleDetail.tsx, AddInvestmentModal.tsx,
SettlementModal.tsx, and the mobile equivalents).

Legacy objects uploaded before this cutover won't have a valid-uuid first
segment. Rather than bulk-moving them (risky: `storage.objects.name` is
metadata, not the blob's actual location - a raw rename would desync the
two), a grandfather clause lets the seeded organization read/manage any
object whose first path segment isn't a UUID at all. Safe today because
there is exactly one organization - no legacy object can leak to "the
wrong org" when no other org's data exists yet. Real relocation, if ever
needed, is lazy off-peak cleanup via the Storage API's move(), not part
of this migration.
*/

create or replace function public.safe_uuid(v text)
returns uuid
language plpgsql
immutable
as $$
begin
  return v::uuid;
exception when others then
  return null;
end;
$$;

do $$
declare
  b text;
  buckets text[] := array['vehicle-documents', 'finance-proofs', 'vehicle-photos'];
begin
  foreach b in array buckets loop
    execute format('drop policy if exists "auth_upload_%s" on storage.objects', replace(b, '-', '_'));
    execute format('drop policy if exists "auth_read_%s" on storage.objects', replace(b, '-', '_'));
    execute format('drop policy if exists "auth_delete_%s" on storage.objects', replace(b, '-', '_'));

    execute format(
      'create policy "org_upload_%1$s" on storage.objects for insert to authenticated with check (' ||
      '  bucket_id = %2$L and (' ||
      '    is_org_member(safe_uuid((storage.foldername(name))[1]))' ||
      '    or (safe_uuid((storage.foldername(name))[1]) is null and is_org_member((select id from organizations order by created_at asc limit 1)))' ||
      '  ))',
      replace(b, '-', '_'), b
    );

    execute format(
      'create policy "org_read_%1$s" on storage.objects for select to authenticated using (' ||
      '  bucket_id = %2$L and (' ||
      '    is_org_member(safe_uuid((storage.foldername(name))[1]))' ||
      '    or (safe_uuid((storage.foldername(name))[1]) is null and is_org_member((select id from organizations order by created_at asc limit 1)))' ||
      '  ))',
      replace(b, '-', '_'), b
    );

    execute format(
      'create policy "org_delete_%1$s" on storage.objects for delete to authenticated using (' ||
      '  bucket_id = %2$L and (' ||
      '    is_org_member(safe_uuid((storage.foldername(name))[1]), array[''owner'',''manager''])' ||
      '    or (safe_uuid((storage.foldername(name))[1]) is null and is_org_member((select id from organizations order by created_at asc limit 1), array[''owner'',''manager'']))' ||
      '  ))',
      replace(b, '-', '_'), b
    );
  end loop;
end $$;
