/*
# Atomic assistant confirmation and command execution

Confirmation used to be one RPC and the business command a second RPC. A
business validation failure could therefore consume the one-time confirmation
without applying the requested change. These narrow wrappers execute both
steps in one PostgreSQL statement and transaction: any command exception also
rolls back the confirmation and its audit row.

Only the wrappers remain callable by authenticated clients. The underlying
confirmation and command functions stay available to the wrappers through
their security-definer owner context.
*/

begin;

create or replace function public.assistant_confirm_and_create_vehicle_with_purchase(
  p_proposal_id uuid,
  p_confirmation_token text,
  p_expected_argument_hash text,
  p_org_id uuid,
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
begin
  perform 1
  from public.assistant_confirm_action(
    p_proposal_id,
    p_confirmation_token,
    p_expected_argument_hash
  );

  return public.assistant_create_vehicle_with_purchase(
    p_org_id,
    p_proposal_id,
    p_idempotency_key,
    p_vehicle,
    p_purchase,
    p_payment,
    p_listing
  );
end;
$$;

create or replace function public.assistant_confirm_and_complete_vehicle_sale(
  p_proposal_id uuid,
  p_confirmation_token text,
  p_expected_argument_hash text,
  p_org_id uuid,
  p_idempotency_key text,
  p_vehicle_id uuid,
  p_sale jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.assistant_confirm_action(
    p_proposal_id,
    p_confirmation_token,
    p_expected_argument_hash
  );

  return public.assistant_complete_vehicle_sale(
    p_org_id,
    p_proposal_id,
    p_idempotency_key,
    p_vehicle_id,
    p_sale
  );
end;
$$;

revoke all on function public.assistant_confirm_action(
  uuid, text, text
) from authenticated;
revoke all on function public.assistant_create_vehicle_with_purchase(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb
) from authenticated;
revoke all on function public.assistant_complete_vehicle_sale(
  uuid, uuid, text, uuid, jsonb
) from authenticated;

revoke all on function public.assistant_confirm_and_create_vehicle_with_purchase(
  uuid, text, text, uuid, text, jsonb, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.assistant_confirm_and_create_vehicle_with_purchase(
  uuid, text, text, uuid, text, jsonb, jsonb, jsonb, jsonb
) to authenticated;

revoke all on function public.assistant_confirm_and_complete_vehicle_sale(
  uuid, text, text, uuid, text, uuid, jsonb
) from public, anon;
grant execute on function public.assistant_confirm_and_complete_vehicle_sale(
  uuid, text, text, uuid, text, uuid, jsonb
) to authenticated;

comment on function public.assistant_confirm_and_create_vehicle_with_purchase(
  uuid, text, text, uuid, text, jsonb, jsonb, jsonb, jsonb
) is
  'Atomically confirms an assistant proposal and onboards its purchased vehicle. Any command failure rolls back confirmation.';

comment on function public.assistant_confirm_and_complete_vehicle_sale(
  uuid, text, text, uuid, text, uuid, jsonb
) is
  'Atomically confirms an assistant proposal and completes its vehicle sale. Any command failure rolls back confirmation.';

commit;
