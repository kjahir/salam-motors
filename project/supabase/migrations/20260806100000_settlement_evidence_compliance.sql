/*
# Settlement payments as a compliance evidence entity

## Why
Purchase payments, expenses and investments can already have an
"evidence_required" compliance policy that flags a record missing a
supporting screenshot/receipt. Partner profit-settlement payments
(`profit_settlement_payments`, recorded via SettlementModal on the
Partners/Finance pages) never got the same treatment even though the
column for it (`proof_urls`, added 20260725080000) has existed all along.

Both `validate_compliance_policy_shape()` and `is_policy_violated()`
(20260727211000_business_security_hardening.sql) hard-code the accepted
`evidence_required` entities to `purchase_payment` / `expense` /
`investment` — so a policy with `params->>'entity' = 'settlement'` was
rejected outright by the validation trigger, even though the application
constant (`COMPLIANCE_EVIDENCE_ENTITIES` in constants.ts) already listed
it as a choice in the admin UI.

## Changes
- `validate_compliance_policy_shape()`: accepts `'settlement'` alongside
  the existing three entities.
- `is_policy_violated()`: adds a `settlement` branch. Unlike the other
  three entities, `profit_settlement_payments` has no `vehicle_id` column
  of its own — it hangs off `profit_distributions.id` via
  `distribution_id` — so the check joins through that table to reach the
  vehicle, mirroring the `purchase_payment` branch's join through
  `purchases`.

Both are `CREATE OR REPLACE` of existing functions with the same
signatures, so the trigger and callers that already reference them by
name pick up the new bodies with no further changes.
*/

create or replace function public.validate_compliance_policy_shape()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tolerance numeric;
begin
  if jsonb_typeof(new.params) <> 'object' then
    raise exception using errcode = '22023', message = 'Compliance params must be a JSON object';
  end if;

  if new.category not in (
    'document','financial_evidence','financial_reconciliation'
  ) then
    raise exception using errcode = '22023', message = 'Unsupported compliance category';
  end if;

  if new.severity not in ('Info','Warning','High','Critical') then
    raise exception using errcode = '22023', message = 'Unsupported compliance severity';
  end if;

  if new.rule_type = 'document_required' then
    if coalesce(new.params->>'document_type', '') = '' then
      raise exception using errcode = '22023', message = 'document_type is required';
    end if;
    if new.params ? 'accepted_statuses'
       and jsonb_typeof(new.params->'accepted_statuses') <> 'array' then
      raise exception using errcode = '22023', message = 'accepted_statuses must be an array';
    end if;
  elsif new.rule_type = 'evidence_required' then
    if coalesce(new.params->>'entity', '') not in (
      'purchase_payment','expense','investment','settlement'
    ) then
      raise exception using errcode = '22023', message = 'Unsupported evidence entity';
    end if;
  elsif new.rule_type = 'amount_reconciliation' then
    if coalesce(
      new.params->>'target',
      'purchase_payments_vs_purchase_price'
    ) <> 'purchase_payments_vs_purchase_price' then
      raise exception using errcode = '22023', message = 'Unsupported reconciliation target';
    end if;
    begin
      v_tolerance := coalesce((new.params->>'tolerance')::numeric, 0.01);
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'tolerance must be numeric';
    end;
    if v_tolerance < 0 then
      raise exception using errcode = '22023', message = 'tolerance cannot be negative';
    end if;
  else
    raise exception using errcode = '22023', message = 'Unsupported compliance rule type';
  end if;

  return new;
end;
$$;

create or replace function public.is_policy_violated(
  p_vehicle_id uuid,
  p_policy public.compliance_policies
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_policy public.compliance_policies%rowtype;
begin
  select v.org_id into v_org_id
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.deleted_at is null;

  if v_org_id is null
     or not public.is_active_org_staff(v_org_id) then
    return false;
  end if;

  select cp.* into v_policy
  from public.compliance_policies cp
  where cp.id = p_policy.id
    and cp.org_id = v_org_id
    and cp.is_active
    and cp.deleted_at is null;

  if not found then
    return false;
  end if;

  if v_policy.rule_type = 'document_required' then
    return not exists (
      select 1
      from public.vehicle_documents d
      where d.org_id = v_org_id
        and d.vehicle_id = p_vehicle_id
        and d.deleted_at is null
        and d.document_type = v_policy.params->>'document_type'
        and d.verification_status = any (
          case when v_policy.params ? 'accepted_statuses'
            then array(
              select jsonb_array_elements_text(
                v_policy.params->'accepted_statuses'
              )
            )
            else array['Verified','Uploaded']
          end
        )
    );
  elsif v_policy.rule_type = 'evidence_required' then
    if v_policy.params->>'entity' = 'purchase_payment' then
      return exists (
        select 1
        from public.purchase_payments pp
        join public.purchases pu
          on pu.id = pp.purchase_id
         and pu.org_id = pp.org_id
        where pu.org_id = v_org_id
          and pu.vehicle_id = p_vehicle_id
          and (
            pp.proof_urls is null
            or cardinality(pp.proof_urls) = 0
          )
      );
    elsif v_policy.params->>'entity' = 'expense' then
      return exists (
        select 1
        from public.expenses e
        where e.org_id = v_org_id
          and e.vehicle_id = p_vehicle_id
          and e.deleted_at is null
          and e.approval_status not in ('Draft','Rejected','Reversed')
          and (
            e.bill_urls is null
            or cardinality(e.bill_urls) = 0
          )
      );
    elsif v_policy.params->>'entity' = 'investment' then
      return exists (
        select 1
        from public.investments i
        where i.org_id = v_org_id
          and i.vehicle_id = p_vehicle_id
          and (
            i.proof_urls is null
            or cardinality(i.proof_urls) = 0
          )
      );
    elsif v_policy.params->>'entity' = 'settlement' then
      return exists (
        select 1
        from public.profit_settlement_payments psp
        join public.profit_distributions pd
          on pd.id = psp.distribution_id
         and pd.org_id = psp.org_id
        where pd.org_id = v_org_id
          and pd.vehicle_id = p_vehicle_id
          and (
            psp.proof_urls is null
            or cardinality(psp.proof_urls) = 0
          )
      );
    end if;
    return false;
  elsif v_policy.rule_type = 'amount_reconciliation' then
    return exists (
      select 1
      from public.purchases pu
      left join (
        select pp.org_id, pp.purchase_id, sum(pp.amount) as paid
        from public.purchase_payments pp
        where pp.org_id = v_org_id
        group by pp.org_id, pp.purchase_id
      ) pp
        on pp.purchase_id = pu.id
       and pp.org_id = pu.org_id
      where pu.org_id = v_org_id
        and pu.vehicle_id = p_vehicle_id
        and abs(
          coalesce(pp.paid, 0)
          - (
            pu.agreed_price
            + pu.broker_commission
            + pu.other_fee
          )
        ) > coalesce((v_policy.params->>'tolerance')::numeric, 0.01)
    );
  end if;

  return false;
end;
$$;
