import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el entorno.');
}

// Cliente con la anon key: solo para la parte INTERNA de la app (Resumen/Admin),
// protegida por PasswordGate. La página pública /confirmar/:token NO debe usar
// este cliente — le pega a la función serverless en server/confirmar.ts,
// que es la única con permiso para leer/escribir con la service role key.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
