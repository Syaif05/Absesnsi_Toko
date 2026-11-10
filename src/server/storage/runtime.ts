import 'server-only';
import { z } from 'zod';
import { SupabaseStorage } from './supabase';
export function storageRuntime() {
  const config=z.object({STORAGE_DRIVER:z.literal('supabase'),SUPABASE_URL:z.url(),SUPABASE_SERVICE_ROLE_KEY:z.string().min(20),SUPABASE_STORAGE_BUCKET:z.string().min(1)}).parse(process.env);
  return new SupabaseStorage(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,config.SUPABASE_STORAGE_BUCKET);
}
