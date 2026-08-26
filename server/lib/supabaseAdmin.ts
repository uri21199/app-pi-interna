import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno de la función.');
}

// Service role key: bypassa RLS. Solo se usa server-side, nunca se expone al cliente.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
