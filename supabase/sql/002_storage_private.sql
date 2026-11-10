-- Supabase only. Optional alternative to pnpm storage:setup.
-- Run after reviewing the target project; never make attendance photos public.
BEGIN;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('attendance-photos','attendance-photos',false,524288,ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
 IF EXISTS (SELECT FROM storage.buckets WHERE id='attendance-photos' AND public) THEN
  RAISE EXCEPTION 'Existing attendance-photos bucket is public; review its access before continuing';
 END IF;
END $$;
-- No public storage.objects policy: application backend handles authorization.
COMMIT;
SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='attendance-photos';
