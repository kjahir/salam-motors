/* Remove pre-authentication allow-all policies that remain permissive OR branches. */
do $$
declare
  v_table text;
  v_policy text;
begin
  foreach v_table in array array[
    'partners','parties','vehicles','vehicle_status_history',
    'vehicle_documents','vehicle_media','inspections','inspection_items',
    'purchases','purchase_payments','expenses','investments','listings',
    'enquiries','sales','sale_payments','vehicle_profit_share_allocations',
    'profit_distributions','alerts','audit_logs','mechanic_inspection_feedback'
  ] loop
    if pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(v_table)) is null then
      continue;
    end if;
    foreach v_policy in array array[
      'anon_select_' || v_table,
      'anon_insert_' || v_table,
      'anon_update_' || v_table,
      'anon_delete_' || v_table
    ] loop
      execute pg_catalog.format('drop policy if exists %I on public.%I', v_policy, v_table);
    end loop;
    execute pg_catalog.format('revoke all on table public.%I from anon', v_table);
  end loop;
end;
$$;

comment on function public.is_active_org_principal(uuid) is
  'Membership helper used after the legacy allow-all RLS cutover; anonymous access to tenant business tables is denied.';
