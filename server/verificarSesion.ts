import { supabaseAdmin } from './lib/supabaseAdmin.ts';

// A diferencia de verificarAdmin.ts, esto no exige rol admin: cualquier
// militante puede responder su propia disponibilidad de mesita. Devuelve su
// militanteId resuelto server-side a partir del token — el cliente nunca
// puede mandar un militanteId ajeno y que se le crea.
export async function verificarSesion(accessToken: string | undefined): Promise<{ militanteId: string }> {
  if (!accessToken) throw new Error('Falta token de autenticación');

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) throw new Error('Token inválido');

  const { data: militante } = await supabaseAdmin
    .from('militantes')
    .select('id')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (!militante) throw new Error('Tu cuenta todavía no está vinculada a ningún militante.');

  return { militanteId: militante.id };
}
