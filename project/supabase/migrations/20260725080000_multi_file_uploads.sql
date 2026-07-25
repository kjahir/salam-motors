/*
# Multiple files per upload

## Overview
Every upload point in the app (vehicle documents, expense evidence,
partner investments, profit-settlement payments) only ever stored a single
file per record, unlike `purchase_payments.proof_urls` which already
supports an array. This migration brings the rest of the app in line with
that pattern so any of these can carry multiple attachments (e.g. front +
back of an RC book, several pages of a bill).

## Approach
- Add a new `*_urls text[]` array column alongside each existing singular
  column (`file_url`, `bill_url`, `proof_url`).
- Backfill the array from the existing singular value where present, so no
  existing production upload is lost or orphaned.
- The old singular columns are left in place (not dropped) — purely
  additive and reversible. The app will stop writing to them going
  forward and read the new array columns instead.
*/

ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS file_urls text[] NOT NULL DEFAULT '{}';
UPDATE vehicle_documents SET file_urls = ARRAY[file_url] WHERE file_url IS NOT NULL AND file_urls = '{}';

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bill_urls text[] NOT NULL DEFAULT '{}';
UPDATE expenses SET bill_urls = ARRAY[bill_url] WHERE bill_url IS NOT NULL AND bill_urls = '{}';

ALTER TABLE investments ADD COLUMN IF NOT EXISTS proof_urls text[] NOT NULL DEFAULT '{}';
UPDATE investments SET proof_urls = ARRAY[proof_url] WHERE proof_url IS NOT NULL AND proof_urls = '{}';

ALTER TABLE profit_settlement_payments ADD COLUMN IF NOT EXISTS proof_urls text[] NOT NULL DEFAULT '{}';
UPDATE profit_settlement_payments SET proof_urls = ARRAY[proof_url] WHERE proof_url IS NOT NULL AND proof_urls = '{}';
