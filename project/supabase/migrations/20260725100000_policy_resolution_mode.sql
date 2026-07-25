/*
# Policy resolution mode

## Overview
Compliance alerts could previously be Acknowledged/Resolved manually like any
other alert, letting staff wave off a real compliance gap (e.g. "RC book
missing") without ever fixing it. This adds a per-policy switch so a policy
can require its alerts to only clear automatically (once the underlying
data is actually fixed, via the existing syncVehicleAlerts/
syncAllVehiclesCompliance diff) rather than by manual Acknowledge/Resolve.

## Values
- 'manual' (default) — Acknowledge/Resolve work as before. Safe default for
  already-existing policy rows, which are not retroactively changed here.
- 'auto_only' — the app UI hides both Acknowledge and Resolve for alerts
  tied to this policy; only the automatic sync can move them to Resolved.
  This is a UI-level gate, not DB/RLS enforcement.

No CHECK constraint, matching the existing convention (category/rule_type/
severity are plain text validated by a TS array + <Select>, not the
database).
*/

ALTER TABLE compliance_policies ADD COLUMN IF NOT EXISTS resolution_mode text NOT NULL DEFAULT 'manual';
