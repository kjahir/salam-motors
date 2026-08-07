/*
# Raise the default estimated-profit-margin upper bound to 50%

The Sale tab's new negotiate-price tool (Minimum Price / Maximum Price / Negotiate Price)
uses this org-level margin range as its slider bounds. The product default for that range
is being changed from 10%-30% to 10%-50%.

This only changes what a *new* org's app_settings row gets on insert. Existing rows are
left untouched - a dealer who already has 30% may have set that deliberately via the
margin editor, and this migration has no way to distinguish that from an unconfigured
default, so it does not touch existing data.
*/

alter table public.app_settings
  alter column estimated_profit_margin_high_pct set default 50;
