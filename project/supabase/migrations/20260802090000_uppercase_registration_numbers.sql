/*
# Registration numbers are stored uppercase

## The problem
`vehicles.registration_number` was stored exactly as typed. Production has a
mix — 'TN60BW5457' alongside 'tn65bt7605' and 'Tn64AB7639' — because the Add
Vehicle field never normalized it.

That is not just cosmetic. Both uniqueness checks compare exactly:

  - `vehicles_registration_number_active_key`, the partial unique index from
    20260726090000_soft_delete_user_facing_tables.sql
  - `check_registration_available()`, which the "is this plate already on the
    books?" indicator in every add/edit form calls

so 'tn65bt7605' and 'TN65BT7605' are two different plates to the database and
the same bike could be onboarded twice. An Indian registration plate has no
lowercase form, so uppercase is the only correct stored representation.

## Changes
1. Backfill every existing row to uppercase (all orgs, including soft-deleted
   rows — they still hold the plate for the unique index's purposes).
2. A BEFORE INSERT/UPDATE trigger, so this cannot drift again regardless of
   write path. The app normalizes on input too (lib/vehicleForm.ts
   `normalizeRegistration`), but the assistant RPCs and any future writer go
   through the trigger rather than that code.
3. `check_registration_available()` compares case-insensitively, so the
   availability indicator agrees with the trigger even if a caller passes
   lowercase.

## Data handling
Step 1 rewrites real production rows. It is guarded: if two *active* vehicles
would collide once uppercased (e.g. 'tn01ab1234' and 'TN01AB1234' both live),
the migration raises and changes nothing, so the partial unique index can
never be violated half-way through. Resolve the duplicates by hand and re-run.
Soft-deleted rows are exempt from that check because the index ignores them.
*/

-- ============================================================
-- Step 1: refuse to run if uppercasing would collide
-- ============================================================
do $$
declare
  conflicts text;
begin
  select string_agg(format('%s (%s rows)', reg, n), ', ')
    into conflicts
  from (
    select upper(registration_number) as reg, count(*) as n
    from vehicles
    where deleted_at is null and registration_number is not null
    group by upper(registration_number)
    having count(*) > 1
  ) dupes;

  if conflicts is not null then
    raise exception
      'Cannot uppercase registration numbers: these would become duplicates among active vehicles: %',
      conflicts;
  end if;
end $$;

-- ============================================================
-- Step 2: backfill
-- ============================================================
UPDATE vehicles
SET registration_number = upper(registration_number)
WHERE registration_number IS NOT NULL
  AND registration_number <> upper(registration_number);

-- ============================================================
-- Step 3: keep it uppercase from here on, whatever the writer
-- ============================================================
CREATE OR REPLACE FUNCTION public.uppercase_registration_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.registration_number IS NOT NULL THEN
    NEW.registration_number := upper(btrim(NEW.registration_number));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehicles_uppercase_registration ON vehicles;
CREATE TRIGGER trg_vehicles_uppercase_registration
  BEFORE INSERT OR UPDATE OF registration_number ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_registration_number();

-- ============================================================
-- Step 4: availability check agrees with the trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_registration_available(reg_number text, exclude_vehicle_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM vehicles
    WHERE upper(registration_number) = upper(btrim(reg_number))
      AND deleted_at IS NULL
      AND (exclude_vehicle_id IS NULL OR id <> exclude_vehicle_id)
  );
$$;
