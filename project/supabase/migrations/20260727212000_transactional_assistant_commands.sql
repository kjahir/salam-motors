/*
# Transactional assistant business commands

Replaces the two highest-risk browser-side multi-write sequences with narrow
database commands. PostgreSQL supplies the transaction: any exception rolls
back every business row, proposal transition, idempotency record, and audit
event together.

Both commands:
- derive the actor from auth.uid();
- require explicit active organization and role;
- require a confirmed, unexpired, hash-bound action proposal;
- claim a scoped idempotency key;
- validate every referenced record belongs to the same organization;
- lock the aggregate root/counter;
- calculate monetary values with numeric;
- write both the legacy business audit and AI security audit.

The functions record ledger facts only. They do not transfer money.
*/

-- ============================================================
-- Vehicle onboarding: vehicle + status + purchase + payment +
-- optional draft listing
-- ============================================================

create or replace function public.assistant_create_vehicle_with_purchase(
  p_org_id uuid,
  p_action_proposal_id uuid,
  p_idempotency_key text,
  p_vehicle jsonb,
  p_purchase jsonb,
  p_payment jsonb,
  p_listing jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_arguments jsonb;
  v_argument_hash text;
  v_idempotency public.assistant_idempotency_keys%rowtype;
  v_proposal public.assistant_action_proposals%rowtype;
  v_vehicle_id uuid;
  v_purchase_id uuid;
  v_payment_id uuid;
  v_listing_id uuid;
  v_stock_number text;
  v_year integer := extract(year from pg_catalog.now())::integer;
  v_counter integer;
  v_registration text;
  v_manufacture_year integer;
  v_odometer integer;
  v_owner_count integer;
  v_asking_price numeric(14,2);
  v_minimum_price numeric(14,2);
  v_purchase_price numeric(14,2);
  v_broker_commission numeric(14,2);
  v_other_fee numeric(14,2);
  v_expected_payment numeric(14,2);
  v_supplied_payment numeric(14,2);
  v_seller_id uuid;
  v_proof_urls text[];
  v_listing_price numeric(14,2);
  v_listing_minimum numeric(14,2);
  v_slug_base text;
  v_result jsonb;
begin
  perform public.resolve_request_org(p_org_id, false);

  if v_actor is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if not public.is_active_org_staff(
    p_org_id, array['owner','manager']
  ) then
    raise exception using
      errcode = '42501',
      message = 'Owner or manager role is required to onboard a purchased vehicle';
  end if;

  if p_vehicle is null or jsonb_typeof(p_vehicle) <> 'object'
     or p_purchase is null or jsonb_typeof(p_purchase) <> 'object'
     or p_payment is null or jsonb_typeof(p_payment) <> 'object'
     or (
       p_listing is not null
       and jsonb_typeof(p_listing) <> 'object'
     ) then
    raise exception using errcode = '22023', message = 'Command payload sections must be JSON objects';
  end if;

  v_arguments := jsonb_build_object(
    'org_id', p_org_id,
    'vehicle', p_vehicle,
    'purchase', p_purchase,
    'payment', p_payment,
    'listing', p_listing
  );
  v_argument_hash := public.assistant_action_argument_hash(
    'vehicle.create_with_purchase',
    v_arguments,
    null,
    null
  );

  v_idempotency := public.assistant_begin_idempotency(
    p_org_id,
    v_actor,
    'vehicle.create_with_purchase',
    p_idempotency_key,
    v_argument_hash
  );

  if v_idempotency.status = 'completed' then
    return v_idempotency.response_redacted;
  end if;

  v_proposal := public.assistant_require_confirmed_action(
    p_action_proposal_id,
    p_org_id,
    v_actor,
    'vehicle.create_with_purchase',
    v_argument_hash
  );

  v_registration := pg_catalog.upper(
    pg_catalog.btrim(coalesce(p_vehicle->>'registration_number', ''))
  );
  if v_registration = '' or char_length(v_registration) > 40 then
    raise exception using errcode = '22023', message = 'Valid registration number is required';
  end if;

  if coalesce(pg_catalog.btrim(p_vehicle->>'manufacturer'), '') = ''
     or coalesce(pg_catalog.btrim(p_vehicle->>'model'), '') = '' then
    raise exception using errcode = '22023', message = 'Manufacturer and model are required';
  end if;

  begin
    v_manufacture_year := nullif(p_vehicle->>'manufacture_year', '')::integer;
    v_odometer := nullif(p_vehicle->>'odometer', '')::integer;
    v_owner_count := coalesce(
      nullif(p_vehicle->>'owner_count', '')::integer,
      1
    );
    v_asking_price := nullif(p_vehicle->>'asking_price', '')::numeric;
    v_minimum_price := nullif(p_vehicle->>'minimum_price', '')::numeric;
    v_purchase_price := nullif(p_purchase->>'agreed_price', '')::numeric;
    v_broker_commission := coalesce(
      nullif(p_purchase->>'broker_commission', '')::numeric,
      0
    );
    v_other_fee := coalesce(
      nullif(p_purchase->>'other_fee', '')::numeric,
      0
    );
    v_supplied_payment := nullif(p_payment->>'amount', '')::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'Invalid numeric field in vehicle onboarding payload';
  end;

  if v_manufacture_year is not null
     and (
       v_manufacture_year < 1900
       or v_manufacture_year > extract(year from pg_catalog.now())::integer + 1
     ) then
    raise exception using errcode = '22023', message = 'Manufacture year is outside the allowed range';
  end if;
  if v_odometer is not null and v_odometer < 0 then
    raise exception using errcode = '22023', message = 'Odometer cannot be negative';
  end if;
  if v_owner_count < 1 then
    raise exception using errcode = '22023', message = 'Owner count must be at least one';
  end if;
  if v_purchase_price is null or v_purchase_price <= 0 then
    raise exception using errcode = '22023', message = 'Purchase price must be positive';
  end if;
  if v_broker_commission < 0 or v_other_fee < 0 then
    raise exception using errcode = '22023', message = 'Purchase fees cannot be negative';
  end if;
  if v_asking_price is not null and v_asking_price < 0 then
    raise exception using errcode = '22023', message = 'Asking price cannot be negative';
  end if;
  if v_minimum_price is not null and v_minimum_price < 0 then
    raise exception using errcode = '22023', message = 'Minimum price cannot be negative';
  end if;
  if v_asking_price is not null
     and v_minimum_price is not null
     and v_minimum_price > v_asking_price then
    raise exception using errcode = '22023', message = 'Minimum price cannot exceed asking price';
  end if;

  begin
    v_seller_id := nullif(p_purchase->>'seller_party_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'Invalid seller identifier';
  end;

  if v_seller_id is null or not exists (
    select 1
    from public.parties pa
    where pa.id = v_seller_id
      and pa.org_id = p_org_id
      and pa.deleted_at is null
      and pa.party_type = 'seller'
  ) then
    raise exception using errcode = '23503', message = 'Seller does not belong to this organization';
  end if;

  if exists (
    select 1
    from public.vehicles v
    where v.org_id = p_org_id
      and pg_catalog.upper(pg_catalog.btrim(v.registration_number)) = v_registration
      and v.deleted_at is null
  ) then
    raise exception using errcode = '23505', message = 'Registration number is already active in this organization';
  end if;

  if p_payment ? 'proof_urls' then
    if jsonb_typeof(p_payment->'proof_urls') <> 'array' then
      raise exception using errcode = '22023', message = 'proof_urls must be an array';
    end if;
    select coalesce(array_agg(value), '{}'::text[])
    into v_proof_urls
    from jsonb_array_elements_text(p_payment->'proof_urls') as proof(value);
  else
    v_proof_urls := '{}'::text[];
  end if;

  if exists (
    select 1
    from unnest(v_proof_urls) as proof(path)
    where pg_catalog.strpos(
      proof.path,
      p_org_id::text || '/purchase-payments/'
    ) <> 1
  ) then
    raise exception using errcode = '42501', message = 'Payment proof path is outside this organization';
  end if;

  v_expected_payment := (
    v_purchase_price + v_broker_commission + v_other_fee
  )::numeric(14,2);
  if v_supplied_payment is not null
     and abs(v_supplied_payment - v_expected_payment) > 0.01 then
    raise exception using errcode = '22023', message = 'Payment amount must reconcile to purchase price and fees';
  end if;

  -- The counter row is the serialization point for org/year stock numbers.
  insert into public.stock_number_counters (org_id, year, last_value)
  values (p_org_id, v_year, 1)
  on conflict (org_id, year)
  do update
    set last_value = public.stock_number_counters.last_value + 1
  returning last_value into v_counter;

  v_stock_number := 'BIKE-' || v_year::text || '-'
    || pg_catalog.lpad(v_counter::text, 6, '0');

  insert into public.vehicles (
    org_id,
    user_id,
    stock_number,
    registration_number,
    category,
    manufacturer,
    brand,
    model,
    variant,
    fuel_type,
    colour,
    manufacture_year,
    registration_date,
    chassis_number,
    engine_number,
    odometer,
    owner_count,
    registration_city,
    registration_state,
    current_location,
    current_status,
    asking_price,
    minimum_price,
    notes
  ) values (
    p_org_id,
    v_actor,
    v_stock_number,
    v_registration,
    coalesce(nullif(pg_catalog.btrim(p_vehicle->>'category'), ''), 'Motorcycle'),
    pg_catalog.btrim(p_vehicle->>'manufacturer'),
    coalesce(
      nullif(pg_catalog.btrim(p_vehicle->>'brand'), ''),
      pg_catalog.btrim(p_vehicle->>'manufacturer')
    ),
    pg_catalog.btrim(p_vehicle->>'model'),
    nullif(pg_catalog.btrim(p_vehicle->>'variant'), ''),
    coalesce(nullif(pg_catalog.btrim(p_vehicle->>'fuel_type'), ''), 'Petrol'),
    nullif(pg_catalog.btrim(p_vehicle->>'colour'), ''),
    v_manufacture_year,
    nullif(p_vehicle->>'registration_date', '')::date,
    nullif(pg_catalog.btrim(p_vehicle->>'chassis_number'), ''),
    nullif(pg_catalog.btrim(p_vehicle->>'engine_number'), ''),
    v_odometer,
    v_owner_count,
    nullif(pg_catalog.btrim(p_vehicle->>'registration_city'), ''),
    nullif(pg_catalog.btrim(p_vehicle->>'registration_state'), ''),
    nullif(pg_catalog.btrim(p_vehicle->>'current_location'), ''),
    'PURCHASED',
    v_asking_price,
    v_minimum_price,
    nullif(pg_catalog.btrim(p_vehicle->>'notes'), '')
  )
  returning id into v_vehicle_id;

  insert into public.vehicle_status_history (
    org_id,
    user_id,
    vehicle_id,
    previous_status,
    new_status,
    reason
  ) values (
    p_org_id,
    v_actor,
    v_vehicle_id,
    'DRAFT',
    'PURCHASED',
    'Vehicle onboarded through confirmed assistant command'
  );

  insert into public.purchases (
    org_id,
    user_id,
    vehicle_id,
    seller_party_id,
    purchase_date,
    agreed_price,
    broker_commission,
    other_fee,
    payment_status,
    handover_location,
    odometer_at_purchase,
    keys_received,
    documents_received,
    notes
  ) values (
    p_org_id,
    v_actor,
    v_vehicle_id,
    v_seller_id,
    coalesce(
      nullif(p_purchase->>'purchase_date', '')::timestamptz,
      pg_catalog.now()
    ),
    v_purchase_price,
    v_broker_commission,
    v_other_fee,
    'Paid',
    nullif(pg_catalog.btrim(p_purchase->>'handover_location'), ''),
    coalesce(
      nullif(p_purchase->>'odometer_at_purchase', '')::integer,
      v_odometer
    ),
    coalesce((p_purchase->>'keys_received')::boolean, true),
    coalesce((p_purchase->>'documents_received')::boolean, false),
    nullif(pg_catalog.btrim(p_purchase->>'notes'), '')
  )
  returning id into v_purchase_id;

  insert into public.purchase_payments (
    org_id,
    user_id,
    purchase_id,
    amount,
    payment_method,
    reference,
    proof_urls,
    paid_at,
    notes
  ) values (
    p_org_id,
    v_actor,
    v_purchase_id,
    v_expected_payment,
    coalesce(
      nullif(pg_catalog.btrim(p_payment->>'payment_method'), ''),
      'Cash'
    ),
    nullif(pg_catalog.btrim(p_payment->>'reference'), ''),
    nullif(v_proof_urls, '{}'::text[]),
    coalesce(
      nullif(p_payment->>'paid_at', '')::timestamptz,
      pg_catalog.now()
    ),
    nullif(pg_catalog.btrim(p_payment->>'notes'), '')
  )
  returning id into v_payment_id;

  if p_listing is not null or coalesce(v_asking_price, 0) > 0 then
    begin
      v_listing_price := coalesce(
        nullif(p_listing->>'asking_price', '')::numeric,
        v_asking_price
      );
      v_listing_minimum := coalesce(
        nullif(p_listing->>'minimum_price', '')::numeric,
        v_minimum_price
      );
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'Invalid listing price';
    end;

    if v_listing_price is null or v_listing_price <= 0 then
      raise exception using errcode = '22023', message = 'Listing asking price must be positive';
    end if;
    if v_listing_minimum is not null
       and (
         v_listing_minimum < 0
         or v_listing_minimum > v_listing_price
       ) then
      raise exception using errcode = '22023', message = 'Invalid listing minimum price';
    end if;

    v_slug_base := pg_catalog.lower(
      coalesce(p_vehicle->>'manufacturer', '')
      || '-' || coalesce(p_vehicle->>'model', '')
      || '-' || coalesce(p_vehicle->>'manufacture_year', '')
      || '-' || v_registration
    );
    v_slug_base := pg_catalog.regexp_replace(
      v_slug_base, '[^a-z0-9]+', '-', 'g'
    );
    v_slug_base := pg_catalog.btrim(v_slug_base, '-');
    v_slug_base := pg_catalog.substr(v_slug_base, 1, 60);

    insert into public.listings (
      org_id,
      user_id,
      vehicle_id,
      asking_price,
      minimum_price,
      status,
      description,
      public_slug
    ) values (
      p_org_id,
      v_actor,
      v_vehicle_id,
      v_listing_price,
      v_listing_minimum,
      'Draft',
      coalesce(
        nullif(pg_catalog.btrim(p_listing->>'description'), ''),
        concat_ws(
          ' ',
          p_vehicle->>'manufacture_year',
          p_vehicle->>'manufacturer',
          p_vehicle->>'model'
        ) || case
          when v_odometer is null then '.'
          else '. ' || v_odometer::text || ' km.'
        end
      ),
      v_slug_base || '-' || pg_catalog.substr(v_vehicle_id::text, 1, 6)
    )
    returning id into v_listing_id;
  end if;

  select u.email into v_actor_email
  from auth.users u
  where u.id = v_actor;

  insert into public.audit_logs (
    org_id,
    user_id,
    entity_type,
    entity_id,
    action,
    new_value,
    performed_by,
    reason
  ) values (
    p_org_id,
    v_actor,
    'vehicle',
    v_vehicle_id,
    'created',
    jsonb_build_object(
      'stock_number', v_stock_number,
      'registration_number', v_registration,
      'purchase_id', v_purchase_id,
      'purchase_payment_id', v_payment_id,
      'listing_id', v_listing_id
    ),
    coalesce(v_actor_email, v_actor::text),
    'Atomic vehicle onboarding through confirmed assistant action'
  );

  v_result := jsonb_build_object(
    'vehicle_id', v_vehicle_id,
    'stock_number', v_stock_number,
    'purchase_id', v_purchase_id,
    'purchase_payment_id', v_payment_id,
    'listing_id', v_listing_id,
    'status', 'PURCHASED'
  );

  perform public.assistant_write_security_audit(
    p_org_id,
    'business_command',
    'vehicle.create_with_purchase',
    'completed',
    jsonb_build_object(
      'actor_user_id', v_actor,
      'conversation_id', v_proposal.conversation_id,
      'run_id', v_proposal.run_id,
      'tool_call_id', v_proposal.tool_call_id,
      'proposal_id', v_proposal.id,
      'target_type', 'vehicle',
      'target_id', v_vehicle_id,
      'idempotency_key', p_idempotency_key,
      'after_redacted', v_result,
      'details_redacted', jsonb_build_object(
        'purchase_total', v_expected_payment,
        'proof_count', cardinality(v_proof_urls)
      )
    )
  );

  perform public.assistant_finish_action(v_proposal.id, v_result);
  perform public.assistant_finish_idempotency(
    v_idempotency.id,
    v_result,
    'vehicle',
    v_vehicle_id
  );

  -- Preserve the existing onboarding behavior, but run evaluation with a
  -- finance-capable trusted function rather than client-visible rows.
  perform public.sync_org_compliance_alerts(p_org_id, v_vehicle_id);

  return v_result;
end;
$$;

revoke all on function public.assistant_create_vehicle_with_purchase(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.assistant_create_vehicle_with_purchase(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb
) to authenticated;

-- ============================================================
-- Sale completion: sale + receipt + vehicle/listing/status +
-- allocations + distributions
-- ============================================================

create or replace function public.assistant_complete_vehicle_sale(
  p_org_id uuid,
  p_action_proposal_id uuid,
  p_idempotency_key text,
  p_vehicle_id uuid,
  p_sale jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_arguments jsonb;
  v_argument_hash text;
  v_idempotency public.assistant_idempotency_keys%rowtype;
  v_proposal public.assistant_action_proposals%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_buyer_id uuid;
  v_sale_id uuid;
  v_sale_price numeric(14,2);
  v_discount numeric(14,2);
  v_buyer_charges numeric(14,2);
  v_net_revenue numeric(14,2);
  v_purchase_cost numeric(14,2);
  v_expense_cost numeric(14,2);
  v_total_cost numeric(14,2);
  v_gross_profit numeric(14,2);
  v_expected_cost numeric(14,2);
  v_expected_profit numeric(14,2);
  v_is_loss boolean;
  v_abs_profit numeric(14,2);
  v_delivery_status text;
  v_payment_status text;
  v_notes text;
  v_open_critical integer;
  v_allocation_count integer;
  v_allocation_total numeric;
  v_distribution_count integer := 0;
  v_unallocated_profit numeric(14,2) := 0;
  v_alloc record;
  v_principal numeric(14,2);
  v_profit_share numeric(14,2);
  v_loss_share numeric(14,2);
  v_total_entitlement numeric(14,2);
  v_result jsonb;
begin
  perform public.resolve_request_org(p_org_id, false);

  if v_actor is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  /*
  Current table policies intersect at owner for the full workflow:
  sales can be written by owner/manager/sales, but distributions by
  owner/accountant. Authorizing any broader role here would silently bypass
  the existing product policy through SECURITY DEFINER.
  */
  if not public.is_active_org_staff(p_org_id, array['owner']) then
    raise exception using errcode = '42501', message = 'Owner role is required to complete a sale with distributions';
  end if;

  if p_sale is null or jsonb_typeof(p_sale) <> 'object' then
    raise exception using errcode = '22023', message = 'Sale payload must be a JSON object';
  end if;

  v_arguments := jsonb_build_object(
    'org_id', p_org_id,
    'vehicle_id', p_vehicle_id,
    'sale', p_sale
  );
  v_argument_hash := public.assistant_action_argument_hash(
    'vehicle.complete_sale',
    v_arguments,
    'vehicle',
    p_vehicle_id
  );

  v_idempotency := public.assistant_begin_idempotency(
    p_org_id,
    v_actor,
    'vehicle.complete_sale',
    p_idempotency_key,
    v_argument_hash
  );

  if v_idempotency.status = 'completed' then
    return v_idempotency.response_redacted;
  end if;

  v_proposal := public.assistant_require_confirmed_action(
    p_action_proposal_id,
    p_org_id,
    v_actor,
    'vehicle.complete_sale',
    v_argument_hash
  );

  -- Serialize assistant commands for this vehicle, including the no-row-yet
  -- cases that SELECT FOR UPDATE cannot lock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_org_id::text || ':' || p_vehicle_id::text,
      91873
    )
  );

  select v.* into v_vehicle
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.org_id = p_org_id
    and v.deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Vehicle not found in organization';
  end if;

  if v_vehicle.current_status in ('SOLD','DELIVERED') or exists (
    select 1
    from public.sales s
    where s.org_id = p_org_id
      and s.vehicle_id = p_vehicle_id
      and s.status = 'Completed'
  ) then
    raise exception using errcode = '23505', message = 'Vehicle already has a completed sale';
  end if;

  if p_sale ? 'expected_vehicle_updated_at'
     and nullif(p_sale->>'expected_vehicle_updated_at', '') is not null
     and v_vehicle.updated_at is distinct from (
       p_sale->>'expected_vehicle_updated_at'
     )::timestamptz then
    raise exception using errcode = '40001', message = 'Vehicle changed after the sale preview';
  end if;

  begin
    v_buyer_id := nullif(p_sale->>'buyer_party_id', '')::uuid;
    v_sale_price := nullif(p_sale->>'sale_price', '')::numeric;
    v_discount := coalesce(nullif(p_sale->>'discount', '')::numeric, 0);
    v_buyer_charges := coalesce(
      nullif(p_sale->>'buyer_charges', '')::numeric,
      0
    );
    v_expected_cost := nullif(
      p_sale->>'expected_total_vehicle_cost', ''
    )::numeric;
    v_expected_profit := nullif(
      p_sale->>'expected_gross_profit', ''
    )::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'Invalid sale value';
  end;

  if v_buyer_id is null or not exists (
    select 1
    from public.parties pa
    where pa.id = v_buyer_id
      and pa.org_id = p_org_id
      and pa.deleted_at is null
      and pa.party_type = 'buyer'
  ) then
    raise exception using errcode = '23503', message = 'Buyer does not belong to this organization';
  end if;

  if v_sale_price is null or v_sale_price <= 0 then
    raise exception using errcode = '22023', message = 'Sale price must be positive';
  end if;
  if v_discount < 0 or v_buyer_charges < 0 then
    raise exception using errcode = '22023', message = 'Discount and buyer charges cannot be negative';
  end if;

  v_net_revenue := (
    v_sale_price + v_buyer_charges - v_discount
  )::numeric(14,2);
  if v_net_revenue <= 0 then
    raise exception using errcode = '22023', message = 'Net sale revenue must be positive';
  end if;

  v_delivery_status := coalesce(
    nullif(p_sale->>'delivery_status', ''),
    'Pending'
  );
  if v_delivery_status not in ('Pending','Delivered') then
    raise exception using errcode = '22023', message = 'Unsupported delivery status';
  end if;

  v_payment_status := coalesce(
    nullif(p_sale->>'payment_status', ''),
    'Paid'
  );
  if v_payment_status not in (
    'Not paid','Partially paid','Paid','Refunded','Disputed'
  ) then
    raise exception using errcode = '22023', message = 'Unsupported payment status';
  end if;

  v_notes := nullif(pg_catalog.btrim(p_sale->>'notes'), '');

  select count(*) into v_open_critical
  from public.alerts a
  where a.org_id = p_org_id
    and a.vehicle_id = p_vehicle_id
    and a.status = 'Open'
    and a.severity = 'Critical';

  if v_open_critical > 0 then
    raise exception using
      errcode = '55000',
      message = 'Resolve open Critical alerts before completing the sale';
  end if;

  select
    (
      pu.agreed_price
      + pu.broker_commission
      + pu.other_fee
    )::numeric(14,2)
  into v_purchase_cost
  from public.purchases pu
  where pu.org_id = p_org_id
    and pu.vehicle_id = p_vehicle_id
  for update;

  if v_purchase_cost is null then
    raise exception using errcode = '55000', message = 'Vehicle has no purchase record';
  end if;

  select coalesce(sum(e.amount), 0)::numeric(14,2)
  into v_expense_cost
  from public.expenses e
  where e.org_id = p_org_id
    and e.vehicle_id = p_vehicle_id
    and e.deleted_at is null
    and e.approval_status in ('Approved','Paid');

  v_total_cost := (v_purchase_cost + v_expense_cost)::numeric(14,2);
  v_gross_profit := (v_net_revenue - v_total_cost)::numeric(14,2);

  if v_expected_cost is not null
     and abs(v_expected_cost - v_total_cost) > 0.01 then
    raise exception using errcode = '40001', message = 'Vehicle cost changed after the sale preview';
  end if;
  if v_expected_profit is not null
     and abs(v_expected_profit - v_gross_profit) > 0.01 then
    raise exception using errcode = '40001', message = 'Expected profit changed after the sale preview';
  end if;

  if v_gross_profit < 0 and v_notes is null then
    raise exception using
      errcode = '22023',
      message = 'A below-cost sale requires an explanatory note';
  end if;

  -- Lock existing allocations before calculating distributions.
  perform 1
  from public.vehicle_profit_share_allocations a
  where a.org_id = p_org_id
    and a.vehicle_id = p_vehicle_id
  for update;

  select count(*) into v_allocation_count
  from public.vehicle_profit_share_allocations a
  where a.org_id = p_org_id
    and a.vehicle_id = p_vehicle_id;

  if v_allocation_count = 0 then
    insert into public.vehicle_profit_share_allocations (
      org_id, user_id, vehicle_id, partner_id, percentage
    )
    select
      p_org_id,
      v_actor,
      p_vehicle_id,
      p.id,
      p.default_profit_share_pct
    from public.partners p
    where p.org_id = p_org_id
      and p.status = 'active'
      and p.deleted_at is null;
  end if;

  if exists (
    select 1
    from public.vehicle_profit_share_allocations a
    left join public.partners p
      on p.id = a.partner_id
     and p.org_id = a.org_id
     and p.deleted_at is null
    where a.org_id = p_org_id
      and a.vehicle_id = p_vehicle_id
      and (
        p.id is null
        or a.percentage <= 0
        or a.percentage > 100
      )
  ) then
    raise exception using errcode = '23514', message = 'Invalid or cross-organization profit allocation';
  end if;

  select coalesce(sum(a.percentage), 0)
  into v_allocation_total
  from public.vehicle_profit_share_allocations a
  where a.org_id = p_org_id
    and a.vehicle_id = p_vehicle_id;

  if v_allocation_total > 100.0001 then
    raise exception using errcode = '23514', message = 'Profit allocation exceeds 100 percent';
  end if;

  insert into public.sales (
    org_id,
    user_id,
    vehicle_id,
    buyer_party_id,
    sale_date,
    sale_price,
    discount,
    buyer_charges,
    payment_status,
    delivery_status,
    delivered_at,
    delivery_location,
    odometer_at_sale,
    notes,
    status
  ) values (
    p_org_id,
    v_actor,
    p_vehicle_id,
    v_buyer_id,
    coalesce(
      nullif(p_sale->>'sale_date', '')::timestamptz,
      pg_catalog.now()
    ),
    v_sale_price,
    v_discount,
    v_buyer_charges,
    v_payment_status,
    v_delivery_status,
    case
      when v_delivery_status = 'Delivered' then pg_catalog.now()
      else null
    end,
    nullif(pg_catalog.btrim(p_sale->>'delivery_location'), ''),
    coalesce(
      nullif(p_sale->>'odometer_at_sale', '')::integer,
      v_vehicle.odometer
    ),
    v_notes,
    'Completed'
  )
  returning id into v_sale_id;

  insert into public.sale_payments (
    org_id,
    user_id,
    sale_id,
    amount,
    payment_method,
    reference,
    paid_at,
    notes
  ) values (
    p_org_id,
    v_actor,
    v_sale_id,
    v_net_revenue,
    coalesce(
      nullif(pg_catalog.btrim(p_sale->>'payment_method'), ''),
      'Cash'
    ),
    nullif(pg_catalog.btrim(p_sale->>'payment_reference'), ''),
    coalesce(
      nullif(p_sale->>'paid_at', '')::timestamptz,
      pg_catalog.now()
    ),
    nullif(pg_catalog.btrim(p_sale->>'payment_notes'), '')
  );

  update public.vehicles
  set current_status = 'SOLD',
      sold_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where id = p_vehicle_id
    and org_id = p_org_id;

  update public.listings
  set status = 'Sold'
  where vehicle_id = p_vehicle_id
    and org_id = p_org_id;

  insert into public.vehicle_status_history (
    org_id,
    user_id,
    vehicle_id,
    previous_status,
    new_status,
    reason
  ) values (
    p_org_id,
    v_actor,
    p_vehicle_id,
    v_vehicle.current_status,
    'SOLD',
    'Sale completed through confirmed assistant command'
  );

  v_is_loss := v_gross_profit < 0;
  v_abs_profit := abs(v_gross_profit);

  for v_alloc in
    select
      a.partner_id,
      a.percentage,
      coalesce(sum(i.amount), 0)::numeric(14,2) as principal
    from public.vehicle_profit_share_allocations a
    left join public.investments i
      on i.org_id = a.org_id
     and i.vehicle_id = a.vehicle_id
     and i.partner_id = a.partner_id
     and i.status in ('Received','Partially used','Fully used')
    where a.org_id = p_org_id
      and a.vehicle_id = p_vehicle_id
    group by a.partner_id, a.percentage
    order by a.partner_id
  loop
    v_principal := v_alloc.principal;
    v_profit_share := case
      when v_is_loss then 0
      else (v_abs_profit * v_alloc.percentage / 100)::numeric(14,2)
    end;
    v_loss_share := case
      when v_is_loss
        then (v_abs_profit * v_alloc.percentage / 100)::numeric(14,2)
      else 0
    end;
    v_total_entitlement := (
      v_principal + v_profit_share - v_loss_share
    )::numeric(14,2);

    insert into public.profit_distributions (
      org_id,
      user_id,
      vehicle_id,
      sale_id,
      partner_id,
      principal_return,
      profit_share,
      loss_share,
      total_entitlement,
      amount_paid,
      balance_payable,
      status
    ) values (
      p_org_id,
      v_actor,
      p_vehicle_id,
      v_sale_id,
      v_alloc.partner_id,
      v_principal,
      v_profit_share,
      v_loss_share,
      v_total_entitlement,
      0,
      v_total_entitlement,
      'Calculated'
    );
    v_distribution_count := v_distribution_count + 1;
  end loop;

  if not v_is_loss and v_allocation_total < 100 then
    v_unallocated_profit := (
      v_gross_profit * (100 - v_allocation_total) / 100
    )::numeric(14,2);
  end if;

  select u.email into v_actor_email
  from auth.users u
  where u.id = v_actor;

  insert into public.audit_logs (
    org_id,
    user_id,
    entity_type,
    entity_id,
    action,
    old_value,
    new_value,
    performed_by,
    reason
  ) values (
    p_org_id,
    v_actor,
    'vehicle',
    p_vehicle_id,
    'sold',
    jsonb_build_object(
      'status', v_vehicle.current_status,
      'updated_at', v_vehicle.updated_at
    ),
    jsonb_build_object(
      'status', 'SOLD',
      'sale_id', v_sale_id,
      'sale_price', v_sale_price,
      'net_revenue', v_net_revenue,
      'total_cost', v_total_cost,
      'gross_profit', v_gross_profit,
      'distribution_count', v_distribution_count
    ),
    coalesce(v_actor_email, v_actor::text),
    'Atomic sale completion through confirmed assistant action'
  );

  v_result := jsonb_build_object(
    'vehicle_id', p_vehicle_id,
    'sale_id', v_sale_id,
    'status', 'SOLD',
    'net_revenue', v_net_revenue,
    'total_vehicle_cost', v_total_cost,
    'gross_profit', v_gross_profit,
    'distribution_count', v_distribution_count,
    'allocation_total_pct', v_allocation_total,
    'unallocated_profit', v_unallocated_profit
  );

  perform public.assistant_write_security_audit(
    p_org_id,
    'business_command',
    'vehicle.complete_sale',
    'completed',
    jsonb_build_object(
      'actor_user_id', v_actor,
      'conversation_id', v_proposal.conversation_id,
      'run_id', v_proposal.run_id,
      'tool_call_id', v_proposal.tool_call_id,
      'proposal_id', v_proposal.id,
      'target_type', 'vehicle',
      'target_id', p_vehicle_id,
      'idempotency_key', p_idempotency_key,
      'before_redacted', jsonb_build_object(
        'status', v_vehicle.current_status,
        'updated_at', v_vehicle.updated_at
      ),
      'after_redacted', v_result,
      'details_redacted', jsonb_build_object(
        'buyer_party_id', v_buyer_id,
        'is_loss', v_is_loss,
        'payment_method', p_sale->>'payment_method'
      )
    )
  );

  perform public.assistant_finish_action(v_proposal.id, v_result);
  perform public.assistant_finish_idempotency(
    v_idempotency.id,
    v_result,
    'sale',
    v_sale_id
  );

  return v_result;
end;
$$;

revoke all on function public.assistant_complete_vehicle_sale(
  uuid, uuid, text, uuid, jsonb
) from public, anon;
grant execute on function public.assistant_complete_vehicle_sale(
  uuid, uuid, text, uuid, jsonb
) to authenticated;

comment on function public.assistant_create_vehicle_with_purchase(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb
) is
  'Confirmed/idempotent atomic vehicle onboarding. Proposal arguments must exactly match the canonical command payload.';

comment on function public.assistant_complete_vehicle_sale(
  uuid, uuid, text, uuid, jsonb
) is
  'Confirmed/idempotent atomic sale and partner-distribution ledger command. Records facts; does not transfer money.';
