/*
# Global stock-number and registration-number uniqueness

## The bug
`vehicles.stock_number` and `vehicles.registration_number` both carry
database-wide UNIQUE constraints (registration_number's was added in
20260721130222_vehicle_mechanic_docs_changes.sql). But the frontend
computed "next stock number" and checked "is this registration number
free" by querying the `vehicles` table directly — and every one of
those queries is scoped by the owner RLS added in
20260721144753_add_auth_user_ownership_rls.sql (`auth.uid() = user_id`).

So each authenticated user only ever sees *their own* vehicles when
generating a stock number or checking a registration number. Two staff
accounts each onboarding their first vehicle both compute
`BIKE-<year>-000001` — the second INSERT dies with a 23505 conflict.
Worse, the registration-number "available ✓" check can say "available"
for a number some other staff account already used, only to fail at
submit time.

## The fix
Two SECURITY DEFINER functions that intentionally bypass the per-owner
RLS for these two specific, inherently-global lookups — same pattern
already used for the public passport view. Nothing about the ownership
model changes; these functions don't expose any row data, just a
boolean and a generated string.

`stock_number_counters` is a private counter table backing atomic,
per-year stock number generation (INSERT ... ON CONFLICT DO UPDATE
RETURNING is a single atomic row-level operation, so concurrent callers
can't both get the same number). RLS is enabled on it with zero
policies — no client role can read or write it directly; only the
SECURITY DEFINER function (running as its owner) can.
*/

CREATE TABLE IF NOT EXISTS stock_number_counters (
  year int PRIMARY KEY,
  last_value int NOT NULL DEFAULT 0
);

ALTER TABLE stock_number_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_stock_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr int := extract(year from now())::int;
  next_val int;
BEGIN
  INSERT INTO stock_number_counters (year, last_value)
  VALUES (yr, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = stock_number_counters.last_value + 1
  RETURNING last_value INTO next_val;

  RETURN 'BIKE-' || yr || '-' || lpad(next_val::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_stock_number() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_registration_available(reg_number text, exclude_vehicle_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM vehicles
    WHERE registration_number = reg_number
      AND (exclude_vehicle_id IS NULL OR id <> exclude_vehicle_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_registration_available(text, uuid) TO authenticated;
