/*
# Uppercase existing manufacturer/model values

New vehicle entries now store manufacturer and model in uppercase (see
`normalizeUpperCase` in src/lib/vehicleForm.ts, applied on input and again at
every write - the same belt-and-suspenders pattern already used for
registration_number). Otherwise "Honda"/"HONDA"/"honda" sit as different
strings purely by how each dealer happened to type them in, which breaks
grouping and exact-match search in the inventory list.

This backfills every existing row so already-onboarded vehicles match the new
convention. Text-only normalization, no schema change, idempotent (the WHERE
clause means re-running this touches zero rows the second time). Scoped to
manufacturer/model only, per the request - `brand` is left as entered.
*/

update public.vehicles
set manufacturer = upper(manufacturer),
    model = upper(model)
where manufacturer <> upper(manufacturer)
   or model <> upper(model);
