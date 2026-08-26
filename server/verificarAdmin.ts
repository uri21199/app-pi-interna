import { supabaseAdmin } from './lib/supabaseAdmin.ts';

// Verifica que el access token pertenezca a un usuario logueado cuyo
// militante vinculado tenga rol admin. Usado por los endpoints server-side
// que necesitan la service role key (ej. alta de militantes con contraseña
// elegida por el admin) para no confiar solo en el gate del lado del cliente.
export async function verificarAdmin(accessToken: string | undefined): Promise<void> {
  if (!accessToken) throw new Error('Falta token de autenticación');

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) throw new Error('Token inválido');

  const { data: militante } = await supabaseAdmin
    .from('militantes')
    .select('rol')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (militante?.rol !== 'admin') throw new Error('No autorizado: se requiere rol admin');
}
