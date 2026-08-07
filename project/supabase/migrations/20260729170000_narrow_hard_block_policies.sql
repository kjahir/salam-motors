/*
# Narrow auto_only hard-block policies to RC book + amount reconciliation

## Overview
Product decision: of the 8 default compliance policies, only two should
remain genuine hard blockers on completing a sale — "RC book required"
(an unregistered/undocumented vehicle changing hands) and "Purchase
payments must match price" (money not reconciling to the agreed price).
The other 6 defaults (Insurance, PUC, Seller identity, Purchase payments
need proof, Expenses need bills, Vehicle investments need proof) become
dealer-acknowledgeable ("manual") — still flagged, still visible, but a
dealer can consciously acknowledge and proceed instead of being blocked.

`src/lib/constants.ts`'s DEFAULT_COMPLIANCE_POLICIES already reflects
this for anything seeded from here on. This migration is the retroactive
half: 20260725100000_policy_resolution_mode.sql, which introduced the
resolution_mode column, explicitly left existing rows on the 'manual'
column default and said so in its own comment ("not retroactively
changed here") — but every row seeded before *that* migration ran came
in with resolution_mode implicitly 'auto_only' in spirit (the app's
"Load Recommended Defaults" button always inserted DEFAULT_COMPLIANCE_
POLICIES verbatim, and every entry was 'auto_only' until this change).
Net effect: any org that clicked "Load Recommended Defaults" before this
migration has all 8 of its default policies sitting at 'auto_only' today.
Without this migration those 6 stay incorrectly hard-blocking, out of
sync with the new default.

## Safety: only touches untouched rows
Each UPDATE below is scoped to rows that still match the *exact* original
seeded shape — name, category, rule_type, params, and severity all equal
to what DEFAULT_COMPLIANCE_POLICIES shipped, and resolution_mode still
'auto_only' (its unmodified seed value). A row where an admin has since
edited any of those fields (including one who deliberately flipped
resolution_mode to 'manual' or back to 'auto_only' themselves, or
changed the severity, or reworded the name/description) will not match
and is left exactly as the admin left it. Custom (non-default) policies
are never touched — they don't match on name/rule_type/params to begin
with. RC book required and Purchase payments must match price are not
touched by this migration at all: their default resolution_mode was
already 'auto_only' before and after this change, so pristine rows need
no update, and hand-edited rows are (as with everything else here) left
alone either way.
*/

update public.compliance_policies
set resolution_mode = 'manual', updated_at = now()
where name = 'Insurance required'
  and category = 'document'
  and rule_type = 'document_required'
  and params = '{"document_type": "Insurance"}'::jsonb
  and severity = 'High'
  and resolution_mode = 'auto_only'
  and deleted_at is null;

update public.compliance_policies
set resolution_mode = 'manual', updated_at = now()
where name = 'PUC required'
  and category = 'document'
  and rule_type = 'document_required'
  and params = '{"document_type": "PUC"}'::jsonb
  and severity = 'Warning'
  and resolution_mode = 'auto_only'
  and deleted_at is null;

update public.compliance_policies
set resolution_mode = 'manual', updated_at = now()
where name = 'Seller identity required'
  and category = 'document'
  and rule_type = 'document_required'
  and params = '{"document_type": "Seller identity"}'::jsonb
  and severity = 'Warning'
  and resolution_mode = 'auto_only'
  and deleted_at is null;

update public.compliance_policies
set resolution_mode = 'manual', updated_at = now()
where name = 'Purchase payments need proof'
  and category = 'financial_evidence'
  and rule_type = 'evidence_required'
  and params = '{"entity": "purchase_payment"}'::jsonb
  and severity = 'High'
  and resolution_mode = 'auto_only'
  and deleted_at is null;

update public.compliance_policies
set resolution_mode = 'manual', updated_at = now()
where name = 'Expenses need bills'
  and category = 'financial_evidence'
  and rule_type = 'evidence_required'
  and params = '{"entity": "expense"}'::jsonb
  and severity = 'Warning'
  and resolution_mode = 'auto_only'
  and deleted_at is null;

update public.compliance_policies
set resolution_mode = 'manual', updated_at = now()
where name = 'Vehicle investments need proof'
  and category = 'financial_evidence'
  and rule_type = 'evidence_required'
  and params = '{"entity": "investment"}'::jsonb
  and severity = 'Warning'
  and resolution_mode = 'auto_only'
  and deleted_at is null;
