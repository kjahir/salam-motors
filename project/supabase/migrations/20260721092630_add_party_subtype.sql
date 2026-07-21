/*
# Add party_subtype to parties table

## Overview
Extends the unified parties (sellers/buyers) record with a `party_subtype`
column that classifies HOW a party relates to the dealership:
  - Sellers: 'individual' (counter drop) | 'bank_auction' (bank auction)
  - Buyers:  'individual' (person) | 'agent' (buys on behalf of clients)

## Modified Tables
1. `parties`
   - NEW column `party_subtype` (text, nullable).
   - Backfilled existing seed sellers -> 'individual', buyers -> 'individual'.
   - CHECK constraint allowing documented values per party_type, or NULL.

## Security
- RLS already enabled with anon + authenticated full CRUD. No policy changes.

## Notes
- Nullable on purpose: edge cases aren't forced into a sub-category.
*/

ALTER TABLE parties
  ADD COLUMN IF NOT EXISTS party_subtype text;

UPDATE parties
  SET party_subtype = 'individual'
  WHERE party_type = 'seller' AND party_subtype IS NULL;

UPDATE parties
  SET party_subtype = 'individual'
  WHERE party_type = 'buyer' AND party_subtype IS NULL;

ALTER TABLE parties
  DROP CONSTRAINT IF EXISTS parties_party_subtype_check;

ALTER TABLE parties
  ADD CONSTRAINT parties_party_subtype_check CHECK (
    party_subtype IS NULL
    OR (party_type = 'seller' AND party_subtype IN ('individual', 'bank_auction'))
    OR (party_type = 'buyer'  AND party_subtype IN ('individual', 'agent'))
  );

CREATE INDEX IF NOT EXISTS idx_parties_type_subtype
  ON parties (party_type, party_subtype);
