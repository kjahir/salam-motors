/*
# Payment proof on sale payments

## Why
Every other money movement in the app can carry a proof attachment —
`purchase_payments.proof_urls` (20260725060000), `investments.proof_urls` and
`profit_settlement_payments.proof_urls` (20260725080000) — and the compliance
policies "Purchase payments need proof" / "Vehicle investments need proof" are
built on exactly that column.

`sale_payments`, the one payment the dealer actually *receives*, had nowhere to
put the buyer's UPI screenshot or receipt. The Record Sale screen now offers a
paperclip; this is where what it uploads goes.

## Changes
`sale_payments.proof_urls text[]` — array of object paths in the existing
private `finance-proofs` bucket, same shape and same bucket as the three
columns above, so the Lightbox/signed-URL read path needs no special case.

## Data handling
Additive nullable column. Existing rows get NULL (= no proof on file), which is
exactly what they are. Nothing is rewritten or removed. Deliberately NOT
`NOT NULL DEFAULT '{}'`: `purchase_payments.proof_urls` is nullable and the
compliance predicates already treat NULL and empty-array alike
(`proof_urls IS NULL OR cardinality(proof_urls) = 0`), so matching it keeps the
two columns interchangeable.
*/

ALTER TABLE sale_payments ADD COLUMN IF NOT EXISTS proof_urls text[];

COMMENT ON COLUMN sale_payments.proof_urls IS
  'Paths in the private finance-proofs bucket: screenshots/receipts evidencing this sale payment. Same convention as purchase_payments.proof_urls.';
