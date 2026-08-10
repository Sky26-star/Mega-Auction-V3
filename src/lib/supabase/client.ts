// src/lib/supabase/client.ts

import { createBrowserClient } from '@supabase/ssr';
import { getEnv } from '../env';

export function createClient() {
  const env = getEnv();
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
