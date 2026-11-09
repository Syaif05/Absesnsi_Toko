-- Keep extension routines out of the public Data API schema.
CREATE SCHEMA IF NOT EXISTS extensions;
--> statement-breakpoint
ALTER EXTENSION btree_gist SET SCHEMA extensions;
--> statement-breakpoint
-- Supabase's event trigger must not be callable by Data API roles.
-- Its owner can still execute it when PostgreSQL fires the event trigger.
DO $$ DECLARE r text; BEGIN
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rls_auto_enable' AND p.pronargs=0 AND p.prorettype='event_trigger'::regtype) THEN
  REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
   EXECUTE format('REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM %I',r);
  END LOOP;
 END IF;
END $$;
