/*
# Seed stock_number_counters from existing data

next_stock_number() (previous migration) started every year's counter
at 0, ignoring stock numbers that already exist in `vehicles` — so the
very first call reissued 'BIKE-2026-000001', which was already taken,
recreating the exact collision the function exists to prevent.

This seeds each year's counter to the highest existing stock number
for that year (across all owners — this migration runs with elevated
privileges and intentionally ignores the per-owner RLS, same as the
function itself), so the next generated number is guaranteed unused.
GREATEST guards against lowering a counter that a real call may have
already advanced past this point.
*/

INSERT INTO stock_number_counters (year, last_value)
SELECT
  split_part(stock_number, '-', 2)::int AS year,
  max(split_part(stock_number, '-', 3)::int) AS last_value
FROM vehicles
WHERE stock_number ~ '^BIKE-[0-9]{4}-[0-9]+$'
GROUP BY split_part(stock_number, '-', 2)::int
ON CONFLICT (year) DO UPDATE SET last_value = GREATEST(stock_number_counters.last_value, EXCLUDED.last_value);
