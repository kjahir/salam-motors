/*
# Multiple payment proofs per purchase payment

## Overview
A purchase payment can be settled as several separate transactions — a
partial payment to the seller, a broker commission payment, an "other fee"
payment — each producing its own screenshot/receipt. The single scalar
`proof_url` pattern used elsewhere (investments, settlement payments) only
covers one attachment, so `purchase_payments` gets an array column instead.

## Changes
1. `purchase_payments.proof_urls` — array of paths (one per attachment) in
   the existing private `finance-proofs` bucket. Same bucket/policy posture
   as investment and settlement proofs — no new storage setup needed.
*/

ALTER TABLE purchase_payments ADD COLUMN IF NOT EXISTS proof_urls text[];
