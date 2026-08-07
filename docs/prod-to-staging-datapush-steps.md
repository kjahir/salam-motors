
backup 



SELECT 

    'TRUNCATE TABLE "' || schemaname || '"."' || relname || '" RESTART IDENTITY CASCADE;' AS truncate_query
FROM 
    pg_stat_user_tables    
WHERE 
    n_live_tup > 0 
    AND schemaname  NOT IN ('pg_catalog', 'information_schema')  --- = 'public' -- Excludes system tables NOT IN ('pg_catalog', 'information_schema')     
ORDER BY 
    n_live_tup DESC;
	

No truncate :
TRUNCATE TABLE public.assistant_messages RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assistant_capabilities RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assistant_intent_examples RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assistant_runs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assistant_tool_calls RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assistant_conversations RESTART IDENTITY CASCADE;
TRUNCATE TABLE auth.refresh_tokens RESTART IDENTITY CASCADE;
TRUNCATE TABLE auth.schema_migrations RESTART IDENTITY CASCADE;
TRUNCATE TABLE storage.migrations RESTART IDENTITY CASCADE;
TRUNCATE TABLE supabase_migrations.schema_migrations RESTART IDENTITY CASCADE;


TRUNCATE TABLE public.audit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.alerts RESTART IDENTITY CASCADE;
TRUNCATE TABLE storage.objects RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.expenses RESTART IDENTITY CASCADE;
TRUNCATE TABLE auth.mfa_amr_claims RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.vehicle_documents RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.inspection_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.vehicle_status_history RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.vehicle_profit_share_allocations RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.profit_distributions RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.vehicles RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.purchases RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.purchase_payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE auth.identities RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.vehicle_media RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.investments RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.compliance_policies RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.sale_payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.sales RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.parties RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.inspections RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.partners RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.profit_settlement_payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE storage.buckets RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.listings RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.memberships RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.stock_number_counters RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.organizations RESTART IDENTITY CASCADE;
TRUNCATE TABLE auth.one_time_tokens RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.app_settings RESTART IDENTITY CASCADE;
Delete from auth.users RESTART ;
Delete from auth.sessions

		   

restore 

