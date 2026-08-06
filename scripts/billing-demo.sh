#!/usr/bin/env bash
# Walk the Salam Motors org through each billing state on STAGING so the
# Billing page and banners can be seen in every condition.
#
# Staging only - it reads the pooler URL and password this repo already
# uses for `supabase db push`. It only ever touches org_subscriptions and
# subscription_plans; no vehicle, sale or party data is read or written.
#
# Usage:  ./scripts/billing-demo.sh <state>
#   healthy    active paid subscription, no banner
#   trial      14-day trial, no banner yet (too far out to warn)
#   trial-end  trial with 3 days left  -> blue "trial ending" banner
#   past-due   failed payment, 5 days of grace left -> amber banner, writes STILL work
#   lapsed     grace expired -> red banner, writes BLOCKED by the DB
#   reset      back to 'comped' (the state the migration left it in)
#   status     print current state without changing anything
set -euo pipefail

cd "$(dirname "$0")/../project"

ORG_NAME="Salam Motors"
PW=$(grep '^SUPABASE_DB_PASSWORD=' .env | cut -d= -f2-)
URL=$(sed "s|postgres.swgxitzcylokelhqlcfe@|postgres.swgxitzcylokelhqlcfe:${PW}@|" supabase/.temp/pooler-url)

run() { psql "$URL" -q -v ON_ERROR_STOP=1 -c "$1"; }

show() {
  psql "$URL" -q <<SQL
select o.name,
       s.status,
       p.code as plan,
       s.trial_ends_at::date  as trial_ends,
       s.grace_ends_at::date  as grace_ends,
       s.current_period_end::date as period_end,
       public.org_entitlements_internal(s.org_id) ->> 'access' as access
  from public.org_subscriptions s
  join public.organizations o on o.id = s.org_id
  left join public.subscription_plans p on p.id = s.plan_id
 where o.name = '${ORG_NAME}';
SQL
}

growth_plan="(select id from public.subscription_plans where code='growth')"

case "${1:-status}" in
  healthy)
    run "update public.org_subscriptions set status='active', plan_id=${growth_plan},
         billing_cycle='monthly', trial_ends_at=null, grace_ends_at=null,
         current_period_end=now()+interval '22 days', cancel_at_period_end=false,
         last_payment_at=now(), updated_at=now()
         where org_id=(select id from public.organizations where name='${ORG_NAME}');" ;;
  trial)
    run "update public.org_subscriptions set status='trialing', plan_id=${growth_plan},
         trial_ends_at=now()+interval '14 days', grace_ends_at=null,
         current_period_end=null, updated_at=now()
         where org_id=(select id from public.organizations where name='${ORG_NAME}');" ;;
  trial-end)
    run "update public.org_subscriptions set status='trialing', plan_id=${growth_plan},
         trial_ends_at=now()+interval '3 days', grace_ends_at=null,
         current_period_end=null, updated_at=now()
         where org_id=(select id from public.organizations where name='${ORG_NAME}');" ;;
  past-due)
    run "update public.org_subscriptions set status='past_due', plan_id=${growth_plan},
         billing_cycle='monthly', trial_ends_at=null,
         grace_ends_at=now()+interval '5 days',
         current_period_end=now()-interval '1 day',
         last_payment_error='Demo: UPI mandate could not be collected.', updated_at=now()
         where org_id=(select id from public.organizations where name='${ORG_NAME}');" ;;
  lapsed)
    run "update public.org_subscriptions set status='lapsed', plan_id=${growth_plan},
         trial_ends_at=null, grace_ends_at=now()-interval '1 day',
         current_period_end=now()-interval '8 days', updated_at=now()
         where org_id=(select id from public.organizations where name='${ORG_NAME}');" ;;
  reset)
    run "update public.org_subscriptions set status='comped', plan_id=null,
         billing_cycle=null, trial_ends_at=null, grace_ends_at=null,
         current_period_end=null, cancel_at_period_end=false, cancelled_at=null,
         last_payment_error=null, updated_at=now()
         where org_id=(select id from public.organizations where name='${ORG_NAME}');" ;;
  status) ;;
  *) echo "unknown state: $1"; sed -n '8,18p' "$0"; exit 1 ;;
esac

show
